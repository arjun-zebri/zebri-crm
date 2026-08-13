/**
 * Anthropic client + tool-use loop for the AI copilot.
 *
 * This is the ONLY module that touches the `@anthropic-ai/sdk`, so
 * swapping providers later is a one-file change. The loop is
 * dependency-injected (anything with a `create` returning an
 * Anthropic-shaped message) so unit tests script responses without
 * the SDK.
 *
 * Model calls run on `claude-opus-5` (env-overridable) with:
 *   - explicit prompt caching on the system prompt (`cache_control`,
 *     5-minute TTL — the catalogue prefix is identical per request),
 *   - the server-side refusal fallback default enabled, so a safety
 *     classifier decline is retried on Anthropic's recommended
 *     fallback model inside the same call,
 *   - all tool results returned in a single user message, per the
 *     Messages API contract.
 *
 * Each model turn is a non-streaming completion; the surrounding SSE
 * stream still updates the panel live at event granularity.
 *
 * @module lib/automations/ai-copilot/llm-client
 */
import Anthropic from '@anthropic-ai/sdk'

import {
  COPILOT_TOOL_PARAMETERS,
  type CopilotToolName,
  type ToolResult,
} from './tool-executors'

/**
 * Model id — env-overridable so ops can move versions without a
 * deploy. Haiku 4.5 chosen for cost (~2–4¢ per multi-step question vs
 * ~25–30¢ on Opus 5); bump via ANTHROPIC_MODEL if draft quality on
 * branching flows needs it.
 */
export const COPILOT_MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5'

/**
 * Cap on response tokens per model turn. Generous relative to the
 * short replies the copilot produces because on thinking-by-default
 * models (an `ANTHROPIC_MODEL` override to Opus 5) `max_tokens`
 * bounds thinking AND text together. Within Haiku 4.5's 64K ceiling.
 */
const MAX_TOKENS_PER_TURN = 16_000

/**
 * Models whose safety classifiers support the server-side refusal
 * fallback parameter. Sending `fallbacks` to other models (e.g. the
 * Haiku default) is rejected, so it attaches conditionally.
 */
const FALLBACK_CAPABLE_MODELS = new Set(['claude-opus-5', 'claude-fable-5'])

/** Content blocks we consume from an Anthropic response. */
export interface AnthropicContentBlock {
  type: string
  text?: string
  id?: string
  name?: string
  input?: unknown
}

/** Response shape the loop needs (subset of an Anthropic Message). */
export interface AnthropicMessageLike {
  content: AnthropicContentBlock[]
  stop_reason: string | null
}

/** One conversation turn in Messages API format. */
export interface CopilotChatMessage {
  role: 'user' | 'assistant'
  content: string | Array<Record<string, unknown>>
}

/** Minimal client surface — satisfied by the adapter below and tests. */
export interface CopilotModelClient {
  create(req: Record<string, unknown>): Promise<AnthropicMessageLike>
}

/** Events emitted while a turn runs (mirrored onto the SSE stream). */
export type CopilotTurnEvent =
  | { type: 'message'; text: string }
  | { type: 'tool_call'; tool: string; input?: unknown }
  | { type: 'tool_result'; tool: string; ok: boolean; data?: unknown; error?: string }
  | { type: 'error'; message: string }

let cachedClient: Anthropic | null = null

/**
 * Lazy server-side Anthropic client (reads ANTHROPIC_API_KEY once),
 * adapted to {@link CopilotModelClient}. Uses the beta surface so the
 * server-side `fallbacks: "default"` refusal handling applies.
 */
export function getAnthropicClient(): CopilotModelClient {
  if (!cachedClient) cachedClient = new Anthropic()
  const client = cachedClient
  return {
    create: async (req) => {
      const fallback = FALLBACK_CAPABLE_MODELS.has(String(req.model))
        ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' }
        : {}
      return (await client.beta.messages.create({
        ...req,
        ...fallback,
      } as never)) as unknown as AnthropicMessageLike
    },
  }
}

/** Map the executor tool set into Anthropic tool definitions. */
export function buildCopilotToolDefinitions(): Array<{
  name: CopilotToolName
  description: string
  input_schema: Record<string, unknown>
}> {
  const descriptions: Record<CopilotToolName, string> = {
    read_automation:
      'Read the current automation: name, status, trigger, and the ordered list of steps with their ids. Call this before any edit.',
    set_trigger: 'Set or replace the automation trigger. Config must match the trigger type schema.',
    add_action:
      'Add a step to the automation. Inserting on an occupied parent slot splices the chain (the old child re-attaches to the new step).',
    update_action_config: 'Replace a step config (full replacement) and/or its label.',
    remove_action: 'Delete a step; its children re-attach to its parent.',
    list_email_templates:
      "List the user's saved email templates as {id, name}. Call this to resolve a template mentioned by name into the templateId that send_email needs. Never ask the user for a template id.",
  }
  return (Object.keys(COPILOT_TOOL_PARAMETERS) as CopilotToolName[]).map((name) => ({
    name,
    description: descriptions[name],
    input_schema: COPILOT_TOOL_PARAMETERS[name],
  }))
}

/** Options for {@link runCopilotTurn}. */
export interface RunCopilotTurnOptions {
  client: CopilotModelClient
  /** Stable system prompt (cached via cache_control). */
  system: string
  /** Conversation history + the new user message. */
  messages: CopilotChatMessage[]
  /** Executes one validated tool call (route wires the executors in). */
  executeTool: (name: CopilotToolName, input: unknown) => Promise<ToolResult>
  /** Receives each event as it happens (route encodes onto the SSE stream). */
  onEvent: (event: CopilotTurnEvent) => void
  model?: string
  /** Hard cap on model round-trips per user message. */
  maxIterations?: number
}

/**
 * Drive one user message through the tool-use loop: request a
 * completion, execute every `tool_use` block, return the results in a
 * single user message, and repeat until the model answers in plain
 * text or the iteration cap trips.
 */
export async function runCopilotTurn(options: RunCopilotTurnOptions): Promise<void> {
  const { client, executeTool, onEvent } = options
  const maxIterations = options.maxIterations ?? 8
  const messages: CopilotChatMessage[] = [...options.messages]
  const tools = buildCopilotToolDefinitions()

  for (let i = 0; i < maxIterations; i += 1) {
    const response = await client.create({
      model: options.model ?? COPILOT_MODEL,
      max_tokens: MAX_TOKENS_PER_TURN,
      system: [{ type: 'text', text: options.system, cache_control: { type: 'ephemeral' } }],
      messages,
      tools,
    })

    if (response.stop_reason === 'refusal') {
      onEvent({
        type: 'error',
        message: "I can't help with that request. Try rephrasing what you want the automation to do.",
      })
      return
    }

    for (const block of response.content) {
      if (block.type === 'text' && block.text) onEvent({ type: 'message', text: block.text })
    }

    const toolUses = response.content.filter((b) => b.type === 'tool_use')
    if (response.stop_reason !== 'tool_use' || toolUses.length === 0) return

    // Echo the assistant turn verbatim, then answer every tool_use in
    // ONE user message — splitting results across messages is against
    // the Messages API contract.
    messages.push({
      role: 'assistant',
      content: response.content as unknown as Array<Record<string, unknown>>,
    })

    const resultBlocks: Array<Record<string, unknown>> = []
    for (const call of toolUses) {
      const name = call.name as CopilotToolName
      onEvent({ type: 'tool_call', tool: name, input: call.input })
      const result = await executeTool(name, call.input ?? {})
      onEvent(
        result.ok
          ? { type: 'tool_result', tool: name, ok: true, data: result.data }
          : { type: 'tool_result', tool: name, ok: false, error: result.error },
      )
      resultBlocks.push({
        type: 'tool_result',
        tool_use_id: call.id,
        content: JSON.stringify(result),
      })
    }
    messages.push({ role: 'user', content: resultBlocks })
  }

  onEvent({
    type: 'error',
    message: 'Stopped after too many steps. The changes so far are on the canvas; send a follow-up to continue.',
  })
}
