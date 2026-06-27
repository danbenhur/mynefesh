import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { join } from 'path'
import { getDb } from '../src/db/index.js'

// Runs once before all test files.
// Requires TEST_DATABASE_URL (or DATABASE_URL) to be set.
// process.cwd() = server/ (where npm test is invoked); inherited by vitest fork workers.
const migrationsFolder = join(process.cwd(), 'drizzle')

async function setup() {
  if (!process.env.DATABASE_URL && !process.env.TEST_DATABASE_URL) {
    throw new Error('TEST_DATABASE_URL (or DATABASE_URL) is required for integration tests')
  }
  // Point getDb() at the test database
  if (process.env.TEST_DATABASE_URL && !process.env.DATABASE_URL) {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
  }
  await migrate(getDb(), { migrationsFolder })
}

await setup()
