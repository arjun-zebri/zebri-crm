/**
 * A step's config as the runner will actually see it.
 *
 * Several actions declare their copy as Zod `.default()` values — the
 * post-event emails carry a whole subject and body that way. Those
 * defaults are applied when the **runner** parses the config, not
 * when the step is created, so the stored config for a freshly added
 * step is often `{}`.
 *
 * That is fine for sending and wrong for showing: a compose modal
 * reading the raw config opens blank, and the card summarising it
 * says "no subject yet", while the email that would go out is fully
 * written. Anything rendering a step's config should read it through
 * here.
 *
 * @module lib/automations/action-defaults
 */

import { getActionSpec } from './actions'

/**
 * Fill in whatever the action's schema would default.
 *
 * Falls back to the config untouched when the action is unknown or
 * the config does not parse — a half-configured step is still one the
 * MC has to be able to open and finish.
 */
export function configWithDefaults(
  actionType: string,
  config: Record<string, unknown>,
): Record<string, unknown> {
  const spec = getActionSpec(actionType as Parameters<typeof getActionSpec>[0])
  if (!spec) return config
  const parsed = spec.configSchema.safeParse(config)
  return parsed.success ? (parsed.data as Record<string, unknown>) : config
}
