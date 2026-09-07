# Zebri AI Copilot — Natural-Language Automations

> Status: **Phase A implemented** (2026-08-07, branch
> `feature/ai-copilot-phase-a`) — infra + create/edit tools, route,
> panel wiring, migration, unit + integration tests. Still gated
> behind `SHOW_ZEBRI_AI` until Phase C launch polish.
> Phases B (read_runs/read_audit_log explain tools) and C (template
> chips, e2e, flag flip) are not yet built.
>
> **Paths in this doc were repointed on 2026-09-06.** The
> automations → workflows rename moved the route to
> `app/api/ai/workflow-copilot`, the modules to
> `lib/workflows/ai-copilot/`, and the panel to
> `app/(dashboard)/workflows/[id]/ai-copilot-bar.tsx`, and this file
> still named the old ones. So did the client's `fetch`, which meant
> every message 404'd and the panel said only "Something went wrong.
> Please try again." `COPILOT_ENDPOINT` in `use-copilot-chat.ts` is now
> the single place that path is written, and
> `tests/unit/app/workflows/copilot-endpoint.test.ts` asserts it
> resolves to a route file on disk. The route's own integration test
> imports `POST` and calls it directly, which is correct for testing
> the handler and is exactly why it could never catch a wrong URL.

## Why

Setting automations up by hand is the pain point for non-technical
Wedding MCs (the pain Dubsado is famous for). Horizontal tools (Zapier
Copilot, Make "Maia", n8n AI builder) have proven natural-language →
workflow as an interaction pattern; no wedding-vendor CRM does it.
HoneyBook AI is email-drafting assist only, Dubsado and 17hats have no
AI, Wedy Pro does AI lead response but not NL workflow construction.
Zebri would be first-in-category with a UX pattern the big horizontal
tools already validated.

The groundwork exists: the automations engine (trigger + action DAG,
event bus, cron tick, runner, run history, audit log) is complete, and
`app/(dashboard)/workflows/[id]/ai-copilot-bar.tsx` is a fully
built chat panel awaiting an LLM. No LLM integration exists anywhere
in the codebase yet — that is the new work.

## Product decisions (locked)

| Decision | Choice |
|---|---|
| Interaction model | NL-assisted builder: the AI drafts onto the visible, editable ReactFlow canvas; the user reviews and activates manually. The AI never activates anything. |
| Capabilities | Create from scratch · edit existing · explain automations & runs · suggest MC templates |
| Architecture | One conversational agent (Anthropic Claude API + tool use); tools mutate the draft through the existing Zod validation |
| Access | All subscribed users (`isSubscribed()` from `@/lib/auth/entitlements`); per-user burst limit + persisted daily message cap |
| Provider | Anthropic API via `@anthropic-ai/sdk` — `claude-haiku-4-5` by default for cost (~2–4¢ per multi-step question; env-overridable via `ANTHROPIC_MODEL`, e.g. to `claude-opus-5` for maximum draft quality at ~25–30¢). Explicit prompt caching (`cache_control`) on the stable catalogue prefix; server-side refusal fallback (`fallbacks: "default"`) attaches automatically when the selected model supports it (Opus 5 / Fable tier). `ANTHROPIC_API_KEY` server-side only. The provider call is isolated in one module (`llm-client.ts`) so switching providers later is a one-file change (proven: this feature started on OpenAI and swapped in one file). |

## Architecture

```
User types NL in copilot panel
  → POST /api/ai/workflow-copilot (SSE stream)
    → gates: auth → isSubscribed() → burst rate limit → daily cap
    → Claude (claude-haiku-4-5 default, tool-use loop)
        tools: set_trigger · add_action · update_action_config ·
               remove_action · read_automation · read_runs · read_audit_log
    → each tool call: validate against the existing per-type Zod
      config schemas → apply to draft rows via shared lib functions
      (user-scoped Supabase client, RLS enforced)
    → stream events down: text deltas · tool_call · tool_result
  → panel renders chat; canvas refetches/patches on tool_result
User reviews the draft on the canvas → activates manually
```

The AI only ever authors the same validated JSON the canvas builder
produces; the deterministic engine runs it unchanged.

## Implementation phases (one PR each, all behind `SHOW_ZEBRI_AI`)

### Phase A — infra + create-from-scratch

New:
- `app/api/ai/workflow-copilot/route.ts` — POST, gates, drives the
  function-calling loop, SSE response. Extend the
  `scripts/check-no-service-role-in-client.mjs` CI-guard pattern to
  also forbid `ANTHROPIC_API_KEY` in client files.
- `lib/workflows/ai-copilot/llm-client.ts` — the only file that
  imports `@anthropic-ai/sdk`: model id constant, the tool-use loop,
  tool definition marshalling, refusal handling. Keeps the provider
  swappable without touching the route or executors.
- `lib/workflows/ai-copilot/tool-schemas.ts` — Zod input schemas for
  the 7 tools; `add_action.config` re-validated against the per-type
  action config schema from the registry (waits/branches against
  `conditions.ts` schemas).
- `lib/workflows/ai-copilot/tool-executors.ts` — one executor per
  tool, `{ automationId, userId, supabase }`; reuses the mutation
  logic behind the canvas server actions in
  `app/(dashboard)/automations/actions.ts`; node positions come from
  the existing `auto-layout.ts` (the AI never sets `position_x/y`).
- `lib/workflows/ai-copilot/system-prompt.ts` — stable cached
  prefix: MC domain framing, serialized launch-visible catalogue
  (`launch-catalogue.ts` + registries), template-variable reference,
  worked NL→tool-call examples, safety rules. Volatile
  current-automation state goes in messages after the cached prefix.
- `lib/workflows/ai-copilot/stream.ts` — SSE event encoding
  (`message_delta` / `tool_call` / `tool_result` / `error`).

Modified:
- `ai-copilot-bar.tsx` — new props (`automationId`,
  `automationStatus`, `onActionsChanged`); wire `onSubmit` to the
  route; ephemeral client-side conversation state with a hard token
  bound + "start new conversation" affordance.
- `[id]/page.tsx` — pass the new props.

Anthropic specifics: Messages API tool use — loop while
`stop_reason === 'tool_use'`, echo the assistant turn verbatim, and
return every `tool_result` block in a single user message. System
prompt is byte-stable and carries `cache_control: {type: 'ephemeral'}`
so the catalogue prefix caches. `max_tokens` is generous (16k) so a
thinking-by-default model override (Opus 5) has headroom — the cap
bounds thinking + text together there. `stop_reason === 'refusal'`
maps to a friendly error; on fallback-capable models (Opus 5/Fable)
the server-side `fallbacks: "default"` beta retries declines on
Anthropic's recommended fallback model first.

Cost controls:
- Burst: `inMemoryLimiter({ windowMs: 60_000, max: 20 })` keyed by
  user id (`lib/api/rate-limit.ts`).
- Daily cap: **DB-backed counter** — the in-memory limiter is
  per-process/best-effort on Vercel, too leaky for a paid-API cap.
  Migration: `ai_copilot_usage (user_id, day, message_count)` with
  owner RLS; increment + check in the route (~100 messages/day).
- `sendAlert()` on route errors and on daily-cap hits.

Tests: unit (tool executors incl. invalid-config rejection, prompt
builder); integration (401 unauth, 403 unsubscribed, 429 burst +
daily, cross-tenant RLS denial, add_action row lands).

### Phase B — edit existing + explain

- `read_automation` / `read_runs` / `read_audit_log` executors
  (user-scoped client only; RLS does tenant isolation).
- Draft-only guard on every mutating tool: non-draft status returns a
  refusal the AI relays ("Pause this automation first"); panel shows
  an inline "Pause to edit" state when active. Read tools work in any
  status.
- Integration tests for run/audit reads + cross-tenant denial.

### Phase C — templates + polish + launch

- Empty-state suggestion chips (static curated list of 4 MC
  automations; no extra LLM call).
- Daily-cap UX (disabled composer + message), error toasts, prompt
  refinement.
- Playwright e2e (desktop + Pixel 5 + iPhone 12) with a mocked
  Anthropic client fixture returning canned tool-call sequences.
- Flip `SHOW_ZEBRI_AI = true`; update `.claude/docs/automations.md`,
  `page-specs.md`, `alerts.md`, `security.md` in the same PR.

## Safety properties

1. The AI only authors schema the existing Zod validation accepts —
   invalid configs fail the tool call.
2. Mutations only on `draft` automations; activation is always human.
3. All DB access through the user-scoped Supabase client (RLS); no
   service-role usage anywhere in the path.
4. `ANTHROPIC_API_KEY` server-side only, CI-guarded.
5. Subscribed-only + burst limit + persisted daily cap bound spend.

## Second surface: drafting one email

`POST /api/ai/draft-email` (`lib/workflows/ai-draft.ts`) rewrites the
message held at the review gate: one instruction ("warmer", "mention the
venue changed") applied to the copy already on screen, returned as a
subject and body for the MC to read.

It is deliberately not the copilot. No tools, no workflow access, no
send: it takes text and returns text. The step id is read through the
caller's RLS-scoped client and is the tenant guard.

Same gates as the copilot, and the **same daily cap** —
`DAILY_MESSAGE_CAP` moved to `lib/workflows/ai-copilot/limits.ts` and
both surfaces increment `increment_ai_copilot_usage`, so an MC cannot
run up an Anthropic bill through whichever surface is cheaper to loop.

The system prompt spends most of its length ruling out corporate warmth
(exclamation marks, "excited to partner with you", em dashes) and
protecting `{{variables}}`: breaking one breaks the send. `parseDraft`
falls back to the copy that went in rather than throwing, so an
off-format reply costs a re-press and never blanks an email.

## Out of scope

- AI activating/pausing automations; autonomous runtime agents.
- Persisted chat history; voice input; AI-generated suggestion chips.
- Editing active automations in place (pause-first is the model).
