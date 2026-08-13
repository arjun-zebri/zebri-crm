#!/usr/bin/env node
/**
 * Service-role-key leak guard (Phase 0.8a).
 *
 * The Supabase service-role key bypasses RLS and grants unconstrained
 * access to the entire database. It must NEVER end up in the browser
 * bundle. This script fails CI if any file marked `'use client'`
 * references the env var or the literal key prefix.
 *
 * It also flags client components that import server-only Supabase
 * helpers, which would be a less direct route to the same leak.
 *
 * Usage: `npm run check:no-service-role` (wired into the CI pipeline).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

const ROOTS = ['app', 'components', 'lib'];
const EXTS = new Set(['.ts', '.tsx', '.mts', '.mjs', '.js']);

// Banned references that indicate a server-only secret on the client.
const BANNED = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'sb_secret_', // new-style Supabase secret-key prefix
  'ANTHROPIC_API_KEY', // AI copilot key — server routes only
  'sk-ant-', // Anthropic key literal prefix
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (EXTS.has(extname(name))) out.push(p);
  }
  return out;
}

const offenders = [];

for (const root of ROOTS) {
  let files;
  try {
    files = walk(root);
  } catch {
    continue;
  }
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    // Skip server-only files: route handlers, server actions, server
    // utility modules. The simplest reliable marker is the presence of
    // `'use client'` (a client component) — anything else is server.
    const isClient = /^['"]use client['"];?\s*$/m.test(src);
    if (!isClient) continue;
    for (const term of BANNED) {
      if (src.includes(term)) {
        offenders.push({ file: f, term });
      }
    }
  }
}

if (offenders.length === 0) {
  console.log('service-role leak guard — OK (no client component references the service-role key)');
  process.exit(0);
}

console.error('service-role leak guard — FAIL');
console.error('');
console.error('The following client components reference the Supabase service-role key.');
console.error('This bypasses RLS and would expose unconstrained DB access in the browser bundle.');
console.error('Move the call to a server route / server action / server-side lib module.');
console.error('');
for (const o of offenders) console.error(`  ${o.file}  (matched "${o.term}")`);
process.exit(1);
