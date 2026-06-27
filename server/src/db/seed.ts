import { getDb } from './index.js'
import { umbrellas, tasks, reminders, healthHistory, users, userSettings } from './schema.js'
import { sql, eq } from 'drizzle-orm'

// Seed data matches the shape from client/src/data/umbrellas.ts.
// Clears all tables first (truncate cascade), then re-inserts — fully idempotent.
// Requires SEED_USER_EMAIL env var pointing to an existing user in the users table.

async function seed() {
  const db = getDb()
  console.log('Seeding database...')

  const seedEmail = process.env.SEED_USER_EMAIL ?? process.env.ALLOWED_GOOGLE_EMAIL
  if (!seedEmail) {
    console.error('SEED_USER_EMAIL (or ALLOWED_GOOGLE_EMAIL) is required. Set it to Dan\'s email.')
    process.exit(1)
  }

  const [seedUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, seedEmail.toLowerCase().trim()))
    .limit(1)

  if (!seedUser) {
    console.error(`No user found with email ${seedEmail}. Log in via Google OAuth first.`)
    process.exit(1)
  }

  const userId = seedUser.id
  console.log(`Seeding for userId: ${userId}`)

  // Clear in safe order: truncate umbrellas cascades to
  // tasks, reminders, healthHistory via onDelete: cascade
  await db.execute(sql`TRUNCATE chat_messages RESTART IDENTITY CASCADE`)
  await db.execute(sql`DELETE FROM umbrellas WHERE user_id = ${userId}`)

  // Insert top-level (parent) umbrellas first, then children
  const [people] = await db.insert(umbrellas).values({
    name: 'People', icon: '👨‍👩‍👧‍👦', userId, parentId: null, healthScore: 72, position: 0,
  }).returning()

  const [money] = await db.insert(umbrellas).values({
    name: 'Money', icon: '💰', userId, parentId: null, healthScore: 55, position: 1,
  }).returning()

  const [kids] = await db.insert(umbrellas).values({
    name: 'Kids', icon: '🧒', userId, parentId: null, healthScore: 78, position: 2,
  }).returning()

  const [spirituality] = await db.insert(umbrellas).values({
    name: 'Spirituality', icon: '✨', userId, parentId: null, healthScore: 83, position: 3,
  }).returning()

  const [health] = await db.insert(umbrellas).values({
    name: 'Health', icon: '💪', userId, parentId: null, healthScore: 61, position: 4,
  }).returning()

  // Children
  await db.insert(umbrellas).values({
    name: 'Wife', icon: '💑', userId, parentId: people.id, healthScore: 80, position: 0,
  }).returning()

  await db.insert(umbrellas).values({
    name: 'Community', icon: '🕍', userId, parentId: people.id, healthScore: 65, position: 1,
  }).returning()

  const [income] = await db.insert(umbrellas).values({
    name: 'Income', icon: '📈', userId, parentId: money.id, healthScore: 60, position: 0,
  }).returning()

  await db.insert(umbrellas).values({
    name: 'Expenses', icon: '📉', userId, parentId: money.id, healthScore: 50, position: 1,
  }).returning()

  const [learning] = await db.insert(umbrellas).values({
    name: 'Learning', icon: '📖', userId, parentId: spirituality.id, healthScore: 88, position: 0,
  }).returning()

  const [davening] = await db.insert(umbrellas).values({
    name: 'Davening', icon: '🙏', userId, parentId: spirituality.id, healthScore: 77, position: 1,
  }).returning()

  const [exercise] = await db.insert(umbrellas).values({
    name: 'Exercise', icon: '🏃', userId, parentId: health.id, healthScore: 55, position: 0,
  }).returning()

  const [nutrition] = await db.insert(umbrellas).values({
    name: 'Nutrition', icon: '🥗', userId, parentId: health.id, healthScore: 68, position: 1,
  }).returning()

  // Tasks
  await db.insert(tasks).values([
    {
      userId, umbrellaId: money.id, title: 'Pay city bills',
      status: 'todo', priority: 'high', dueAt: new Date('2026-05-01'), position: 0,
    },
    {
      userId, umbrellaId: spirituality.id, title: 'Prepare Chassidus shiur',
      status: 'in-progress', priority: 'high', dueAt: new Date('2026-04-29'), position: 0,
    },
    {
      userId, umbrellaId: health.id, title: 'Schedule annual blood test',
      status: 'todo', priority: 'medium', dueAt: null, position: 0,
    },
  ])

  // Reminders
  await db.insert(reminders).values([
    {
      userId,
      umbrellaId: people.id,
      message: 'Check in with a close friend this week',
      triggerAt: new Date('2026-04-30'),
      isRecurring: true,
    },
    {
      userId,
      umbrellaId: kids.id,
      message: 'Ask the kids how their day went',
      triggerAt: new Date('2026-04-27'),
      isRecurring: true,
    },
    {
      userId,
      umbrellaId: health.id,
      message: "You haven't done your annual blood test — let's schedule it",
      triggerAt: new Date('2026-04-28'),
      isRecurring: false,
    },
  ])

  // Health history (sparkline data)
  const historyUmbrellas = [
    { umbrella: people,       rows: [{ date: '2026-04-20', score: 68 }, { date: '2026-04-27', score: 72 }] },
    { umbrella: money,        rows: [{ date: '2026-04-20', score: 50 }, { date: '2026-04-27', score: 55 }] },
    { umbrella: income,       rows: [{ date: '2026-04-20', score: 55 }, { date: '2026-04-27', score: 60 }] },
    { umbrella: kids,         rows: [{ date: '2026-04-20', score: 74 }, { date: '2026-04-27', score: 78 }] },
    { umbrella: spirituality, rows: [{ date: '2026-04-20', score: 78 }, { date: '2026-04-27', score: 83 }] },
    { umbrella: learning,     rows: [{ date: '2026-04-20', score: 85 }, { date: '2026-04-27', score: 88 }] },
    { umbrella: davening,     rows: [{ date: '2026-04-20', score: 72 }, { date: '2026-04-27', score: 77 }] },
    { umbrella: health,       rows: [{ date: '2026-04-20', score: 58 }, { date: '2026-04-27', score: 61 }] },
    { umbrella: exercise,     rows: [{ date: '2026-04-20', score: 50 }, { date: '2026-04-27', score: 55 }] },
    { umbrella: nutrition,    rows: [{ date: '2026-04-20', score: 65 }, { date: '2026-04-27', score: 68 }] },
  ]

  for (const { umbrella, rows } of historyUmbrellas) {
    await db.insert(healthHistory).values(
      rows.map(r => ({ userId, umbrellaId: umbrella.id, score: r.score, recordedAt: new Date(r.date) }))
    )
  }

  console.log('Done. Seeded umbrellas, tasks, reminders, health history.')
  process.exit(0)
}

seed().catch(err => {
  console.error('Seed failed:', err)
  process.exit(1)
})
