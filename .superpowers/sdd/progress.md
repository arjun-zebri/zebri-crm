# Branding Editor Redesign — SDD progress ledger

Branch: feature/proposals-phase-a
Plan: .claude/docs/branding-editor-redesign-plan.md
Scope this run: P0 -> P8 (FULL plan, no checkpoint) then final whole-branch review

## Completed tasks
Task P0.1: complete (commits 4cb8f27..f46bb61, review clean)
Task P0.2: complete (commit de3fea2, review clean)
Task P0.3: complete (commit 9765be7, review clean, integration 3/3 local, no field drops)
Task P0.4: complete (commit bc419b7, review clean) -- P0 phase done
Task P1.1: complete (commit 9501369 + lint fix, review clean, 40 fonts)
Task P1.2: complete (commit 514fc56, review clean)
Task P1.3: complete (commit 1a7c50e, review clean) -- P1 phase done
Task P2.1+P2.2: complete (commit dc8d1c9, review clean, 834 tests, back-compat solid) -- P2 phase done
Task P3.1: complete (commit 7a26ea0, review clean, gate ratcheted 341->340)
Task P3.2: complete (commit 7f6380e, review clean, colour picking preserved via ColorPopover)
Task P3.3: complete (commit 23b4edb, review clean, density persisted, Themes removed) -- P3 phase done
Task P4.1: complete (commit fbfb3a6, review clean, 11 tests, exact per-surface matrix)
Task P4.2: complete (commit b964c8f + lint fix 84d9ec7, review clean, per-block storage key verified)
Task P4.3: complete (commit d992b48, review clean) -- P4 phase done
Note: P5 consolidated into P5.1 + P5.B (text-family) + P5.C (chrome) + P5.D (commerce+action).
Task P5.1: complete (commit 5823cee + lint fix 9aa0fdd, review clean, no-op fast path preserved, gate 340->334)

## Minor findings (for final review)
- P0.1: build-public-branding.test covers 7/12 new fields; add assertions for body_case/button_size/button_radius/heading_letter_spacing/body_line_height.
- P1.2: TextStyleDefaults.textTransform TSDoc says 'Typically none' (informal).
- P3.1: TextField still uses raw <input> (inherited from old InfoSection); could move to <Input> primitive.
- P5.1: toolbar duplicates outer-style control panels for spacer (could extract shared condition).
- P4.2/P4.3 gap: adding image+spacer to blocks-by-surface arrays broke the P4.1 exact-array test; those tasks only ran their own test, not the full suite. Fixed in P5.B (test updated), caught by controller full-suite run.
