import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema.js'

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is not set. Provide a Neon (or other Postgres) connection string.\n' +
    'Example: DATABASE_URL=postgresql://user:pass@host/dbname?sslmode=require'
  )
}

const pool = new Pool({ connectionString: databaseUrl })

export const db = drizzle(pool, { schema })
