import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import * as schema from '../../src/db/schema.js'
import { users, allowedEmails, userSettings } from '../../src/db/schema.js'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'

const { Pool } = pg

let _pool: InstanceType<typeof Pool> | null = null
function getTestPool() {
  if (!_pool) {
    _pool = new Pool({ connectionString: process.env.DATABASE_URL })
  }
  return _pool
}

export function getTestDb() {
  return drizzle(getTestPool(), { schema })
}

export async function seedUser(email: string, name?: string) {
  const db = getTestDb()
  const id = randomUUID()
  const [user] = await db
    .insert(users)
    .values({
      id,
      googleId: `test-${id}`,
      email: email.toLowerCase().trim(),
      name: name ?? `Test ${email}`,
      isSandboxUser: false,
    })
    .returning()
  await db.insert(userSettings).values({ userId: user.id }).onConflictDoNothing()
  return user
}

export async function cleanupUsers(emails: string[]) {
  const db = getTestDb()
  for (const email of emails) {
    const [u] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1)
    if (u) await db.delete(users).where(eq(users.id, u.id))
  }
}

export async function cleanupAllowedEmail(email: string) {
  const db = getTestDb()
  await db.delete(allowedEmails).where(eq(allowedEmails.email, email.toLowerCase().trim()))
}

export async function seedAllowedEmail(email: string, revokedAt?: Date) {
  const db = getTestDb()
  const [row] = await db
    .insert(allowedEmails)
    .values({ email: email.toLowerCase().trim(), revokedAt: revokedAt ?? null })
    .onConflictDoNothing()
    .returning()
  return row
}
