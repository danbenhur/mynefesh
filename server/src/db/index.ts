import { drizzle } from 'drizzle-orm/node-postgres'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema.js'

type DB = NodePgDatabase<typeof schema>

let pool: Pool | undefined
let instance: DB | undefined

// Lazy — only creates the pool on first call so the server starts without DATABASE_URL in dev.
// Every route handler that uses getDb() must be inside a try/catch returning 500 on failure.
function getPool(): Pool {
  if (pool) return pool
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Provide a Neon (or other Postgres) connection string.\n' +
      'Example: DATABASE_URL=postgresql://user:pass@host/dbname?sslmode=require'
    )
  }
  pool = new Pool({ connectionString: url })
  return pool
}

export function getDb(): DB {
  if (instance) return instance
  instance = drizzle(getPool(), { schema })
  return instance
}

// Exported so connect-pg-simple can share the same pool as Drizzle.
// Returns null when DATABASE_URL is absent (local dev without DB).
export function getPgPool(): Pool | null {
  if (!process.env.DATABASE_URL) return null
  return getPool()
}
