/**
 * Executing one automated step.
 *
 * The type switch that turns a step into an {@link ActionResult}. Every
 * branch reuses the automations engine: `action` steps go through the
 * action registry, `wait` through `computeWaitWakeAt`, `branch` through
 * `evaluateBranch`. Nothing here re-implements behaviour that already
 * works; the step model is the only thing that changed.
 *
 * Manual step types (`todo`, `appointment`) never reach this module. They
 * sit in `pending` until the MC ticks them, which is exactly what gates
 * the automated steps anchored behind them.
 *
 * @module lib/workflows/execute-step
 */

import { getActionSpec } from '@/lib/automations/actions';
import {
  branchConfigSchema,
  evaluateBranch,
  evaluateWaitAction,
  waitConfigSchema,
} from '@/lib/automations/conditions';
import { configErrorMessage } from '@/lib/automations/config-errors';
import { nextAllowedSendAt, resolveQuietHours } from '@/lib/automations/quiet-hours';
import type {
  ActionResult,
  ActionType,
  BranchActionConfig,
  RunContext,
  WaitActionConfig,
} from '@/types/automations';
import type { WorkflowStepRow } from '@/types/workflows';

/** A branch step also reports which way it went. */
export interface StepOutcome {
  result: ActionResult;
  /** Set only for branch steps: the path taken. */
  branchPath?: 'yes' | 'no';
}

/** Quiet-hours window for the step's template, if it declares one. */
export interface QuietHoursOverride {
  start: string | null;
  end: string | null;
}

/**
 * Push a sleep out of the MC's quiet hours.
 *
 * Only sleeps are moved, and only sleeps caused by an explicit wait: an
 * approval gate has its own expiry and must not be silently shifted.
 */
function applyQuietHours(
  result: ActionResult,
  ctx: RunContext,
  respect: boolean | undefined,
  override: QuietHoursOverride | null,
): ActionResult {
  if (!respect || result.kind !== 'sleep' || result.reason !== 'wait') return result;
  const window = resolveQuietHours(
    override?.start ?? null,
    override?.end ?? null,
    ctx.mc,
    ctx.couple?.timezone ?? null,
  );
  if (!window) return result;
  const wake = new Date(result.wakeAt);
  const corrected = nextAllowedSendAt(wake, window);
  if (corrected.getTime() === wake.getTime()) return result;
  return { ...result, wakeAt: corrected.toISOString(), reason: 'quiet_hours' };
}

/**
 * Run one automated step and report what happened.
 *
 * Never throws: a handler blowing up becomes an `error` result, so one
 * bad step cannot take the tick down with it.
 */
export async function executeStep(
  step: WorkflowStepRow,
  ctx: RunContext,
  quietHours: QuietHoursOverride | null,
): Promise<StepOutcome> {
  const config = (step.config ?? {}) as Record<string, unknown>;

  try {
    switch (step.type) {
      case 'wait': {
        const parsed = waitConfigSchema.safeParse(config);
        if (!parsed.success) {
          return {
            result: { kind: 'error', message: configErrorMessage('Wait', parsed.error) },
          };
        }
        const waitConfig = parsed.data as WaitActionConfig;
        return {
          result: applyQuietHours(
            evaluateWaitAction(waitConfig, ctx),
            ctx,
            parsed.data.respectQuietHours,
            quietHours,
          ),
        };
      }

      case 'branch': {
        const parsed = branchConfigSchema.safeParse(config);
        if (!parsed.success) {
          return {
            result: { kind: 'error', message: configErrorMessage('Branch', parsed.error) },
          };
        }
        const path = evaluateBranch((parsed.data as BranchActionConfig).predicate, ctx);
        return { result: { kind: 'ok', output: { branch_taken: path } }, branchPath: path };
      }

      case 'action': {
        // The action slug lives in config.actionType; the rest of config is
        // the handler's own schema. That indirection is what lets every
        // existing handler and composer work untouched.
        const actionType = config['actionType'];
        if (typeof actionType !== 'string') {
          return {
            result: { kind: 'error', message: 'step has no actionType in its config' },
          };
        }
        const spec = getActionSpec(actionType as ActionType);
        if (!spec) {
          return { result: { kind: 'error', message: `unknown action ${actionType}` } };
        }
        const parsed = spec.configSchema.safeParse(config);
        if (!parsed.success) {
          return {
            result: {
              kind: 'error',
              message: configErrorMessage(spec.ui.label, parsed.error),
            },
          };
        }
        const result = await spec.handler(ctx, parsed.data as never);
        return {
          result: applyQuietHours(result, ctx, true, quietHours),
        };
      }

      default:
        return {
          result: {
            kind: 'error',
            message: `step type ${step.type} is not executable by the engine`,
          },
        };
    }
  } catch (err) {
    return {
      result: {
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }
}
