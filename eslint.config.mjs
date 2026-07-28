import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

/**
 * ESLint flat config.
 *
 * Strategy (Phase 0.4): the legacy violation set is large and ~91 of the
 * errors are behavioural (react-hooks strict) or typing debt (`any`) in
 * feature code. We do NOT mass-fix them here — instead the gate is a
 * monotonically-decreasing budget enforced by `npm run lint:gate`
 * (scripts/lint-gate.mjs), the same proven pattern as `typecheck:strict`.
 * `npm run lint` stays the raw reporter; rule *severities* are kept honest
 * (not downgraded to hide debt). New structural rules below are `warn`
 * (autofixable / burned down per page); Prettier owns formatting.
 */
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // Structural rules (ratcheted as warnings — autofix/burn-down per page).
  {
    rules: {
      "import/order": [
        "warn",
        {
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
          groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
        },
      ],
      // Use `lib/alerts/logger` instead of raw console (Phase 0.6 shipped
      // the logger). Stays `warn` to ratchet the 23 legacy raw console
      // calls down per-page rather than fail the build today.
      "no-console": ["warn", { allow: ["warn", "error"] }],
      // Low-signal stylistic rule (apostrophes/quotes in JSX text are fine);
      // disabled deliberately — not masking a correctness issue.
      "react/no-unescaped-entities": "off",

      // Forbid Tailwind arbitrary-value colour classes (e.g. `bg-[#fff]`,
      // `text-[#abc]`) — use the design tokens declared in
      // `app/globals.css @theme` instead (`bg-surface`, `text-text-muted`,
      // `bg-brand-fg`, …). Phase 0.5; ratcheted `warn`, burned down per page.
      "no-restricted-syntax": [
        "warn",
        {
          selector:
            "Literal[value=/(?:^|\\s)(?:bg|text|border|from|to|via|ring|outline|fill|stroke|caret|decoration|divide|accent|placeholder|shadow)-\\[#/]",
          message:
            "Use a design token instead of an arbitrary colour value (e.g. `bg-brand-fg` instead of `bg-[#000]`). Tokens live in app/globals.css @theme.",
        },
      ],
    },
  },

  // Playwright e2e: fixtures take a param literally named `use`, which the
  // React Hooks rule misreads as a hook call. e2e is not React.
  {
    files: ["tests/e2e/**/*.{ts,tsx}"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
    },
  },

  // Layer boundary: lib/ should stay pure + app-agnostic (no React, no app/).
  // `warn` (ratcheted): ~21 existing violations are real debt (e.g. React
  // render code under lib/branding/*.tsx) — fixed when those modules are
  // hardened, not bulk-moved here.
  {
    files: ["lib/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "warn",
        {
          patterns: [
            {
              group: ["@/app/*", "@/app/**", "**/app/**"],
              message: "lib/ must stay app-agnostic — do not import from app/.",
            },
            {
              group: ["@/components/*", "@/components/**"],
              message: "lib/ must not import React components.",
            },
          ],
        },
      ],
    },
  },

  // Tooling / tests are not app code — relax app-oriented rules.
  {
    files: [
      "tests/**/*.{ts,tsx}",
      "scripts/**/*.{ts,mts,mjs}",
      "*.config.{ts,mts,mjs}",
      "vitest.setup.ts",
    ],
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "no-restricted-imports": "off",
    },
  },

  // Prettier last — disables stylistic rules that would fight the formatter.
  prettier,

  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Recursive so nested build output (e.g. a local git worktree under
    // .claude/worktrees/*/.next) is never linted, not just the top-level dir.
    "**/.next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
    "types/database.ts",
    // Local Claude tooling scratch (git-ignored worktrees, brainstorm dumps).
    ".claude/worktrees/**",
    ".superpowers/**",
  ]),
]);

export default eslintConfig;
