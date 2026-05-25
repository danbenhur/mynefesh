// Validates that drizzle/meta/_journal.json is in sync with drizzle/*.sql files.
// Run automatically as part of the server build. Exits 1 on any drift.

import { readFileSync, readdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const drizzleDir = join(__dirname, '..', 'drizzle')
const journalPath = join(drizzleDir, 'meta', '_journal.json')

interface JournalEntry {
  idx: number
  tag: string
  when: number
}

const journal: { entries: JournalEntry[] } = JSON.parse(readFileSync(journalPath, 'utf8'))
const journalTags = new Set(journal.entries.map(e => e.tag))

// All NNNN_*.sql files in drizzle/ (excluding subdirs)
const sqlFileTags = new Set(
  readdirSync(drizzleDir)
    .filter(f => /^\d{4}_.*\.sql$/.test(f))
    .map(f => f.replace(/\.sql$/, ''))
)

let failed = false

for (const tag of journalTags) {
  if (!sqlFileTags.has(tag)) {
    console.error(`[check-migrations] MISSING FILE: ${tag}.sql is in the journal but not on disk`)
    failed = true
  }
}

for (const tag of sqlFileTags) {
  if (!journalTags.has(tag)) {
    console.error(`[check-migrations] UNTRACKED FILE: ${tag}.sql exists on disk but has no journal entry`)
    console.error(`  Run "npm run db:generate" to regenerate the journal, or add the entry to _journal.json.`)
    failed = true
  }
}

if (failed) {
  console.error('[check-migrations] FAILED — resolve drift before building.')
  process.exit(1)
}

console.log(`[check-migrations] OK — ${journal.entries.length} migration(s) in sync.`)
