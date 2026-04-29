import { drizzle } from 'drizzle-orm/node-postgres'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema.js'

type DB = NodePgDatabase<typeof schema>

let instance: DB | undefined

// Lazy — only creates the pool on first call so the server starts without DATABASE_URL in dev.
// Every route handler that uses getDb() must be inside a try/catch returning 500 on failure.
export function getDb(): DB {
  if (instance) return instance
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Provide a Neon (or other Postgres) connection string.\n' +
      'Example: DATABASE_URL=postgresql://user:pass@host/dbname?sslmode=require'
    )
  }
  instance = drizzle(new Pool({ connectionString: url }), { schema })
  return instance
}
