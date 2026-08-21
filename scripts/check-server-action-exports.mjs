#!/usr/bin/env node
/**
 * CI gate: a Next.js 'use server' module may only export async functions.
 *
 * Type-only exports (interface / type) are erased at compile time and are
 * fine; VALUE exports (const / let / var / class / non-async function)
 * crash at runtime with "A 'use server' file can only export async
 * functions, found object". Vitest and tsc never enforce the directive,
 * so this greps for the violation the way check-no-service-role-in-client
 * guards its own foot-gun. Zod schemas shared with tests belong in a
 * plain sibling module (see app/(dashboard)/calendar/*-schemas.ts).
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const files = execSync(
  `grep -rl --include='*.ts' --include='*.tsx' "^'use server'" app lib`,
  { encoding: 'utf8' },
)
  .trim()
  .split('\n')
  .filter(Boolean);

const violations = [];
const nonAsyncFunction = /^export\s+function\s/;

for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (/^export\s+(const|let|var|class)\s/.test(line) || nonAsyncFunction.test(line)) {
      violations.push(`${file}:${i + 1}: ${line.trim()}`);
    }
  });
}

if (violations.length > 0) {
  console.error("Value exports found in 'use server' modules (runtime crash in Next.js):");
  for (const v of violations) console.error(`  ${v}`);
  process.exit(1);
}
console.log(`server-action exports OK (${files.length} 'use server' modules checked)`);
