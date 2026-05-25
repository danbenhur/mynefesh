#!/usr/bin/env node
/**
 * Build-time guard: verifies that every _journal.json entry has a matching .sql file
 * and every .sql file has a matching journal entry. Fails loudly (exit 1) on desync
 * so a broken migration set never reaches the deploy pipeline.
 *
 * Run automatically as the first step of `npm run build`.
 */

import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const drizzleDir = join(__dirname, '..', 'drizzle')
const journalPath = join(drizzleDir, 'meta', '_journal.json')

let journal
try {
  journal = JSON.parse(readFileSync(journalPath, 'utf8'))
} catch (err) {
  console.error(`[check-migrations] FAIL: Cannot read journal at ${journalPath}`)
  console.error(err.message)
  process.exit(1)
}

const entries = journal.entries ?? []

// Build sets for cross-checking
const journalTags = new Set(entries.map(e => e.tag))
const sqlFiles = new Set(
  readdirSync(drizzleDir)
    .filter(f => f.endsWith('.sql'))
    .map(f => f.replace(/\.sql$/, ''))
)

let ok = true

// Every journal entry must have a .sql file
for (const tag of journalTags) {
  if (!sqlFiles.has(tag)) {
    console.error(`[check-migrations] FAIL: journal entry "${tag}" has no matching .sql file`)
    ok = false
  }
}

// Every .sql file must have a journal entry
for (const tag of sqlFiles) {
  if (!journalTags.has(tag)) {
    console.error(`[check-migrations] FAIL: file "${tag}.sql" has no matching journal entry`)
    ok = false
  }
}

// Count must match
if (journalTags.size !== sqlFiles.size) {
  console.error(
    `[check-migrations] FAIL: journal has ${journalTags.size} entries but drizzle/ has ${sqlFiles.size} .sql files`
  )
  ok = false
}

// Indices must be sequential starting at 0
const sorted = [...entries].sort((a, b) => a.idx - b.idx)
for (let i = 0; i < sorted.length; i++) {
  if (sorted[i].idx !== i) {
    console.error(
      `[check-migrations] FAIL: journal index gap — expected idx ${i}, found ${sorted[i].idx} (tag: ${sorted[i].tag})`
    )
    ok = false
  }
}

if (!ok) {
  console.error(
    '\n[check-migrations] Migration set is out of sync. Run `npx drizzle-kit generate` to create migrations properly — never hand-write .sql files or journal entries.'
  )
  process.exit(1)
}

console.log(`[check-migrations] OK — ${journalTags.size} migrations in sync`)
