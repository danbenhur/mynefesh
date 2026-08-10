import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { and, eq } from 'drizzle-orm'
import { getTestDb, seedUser, cleanupUsers } from './helpers/db.js'
import { userSettings, whatsappSession } from '../src/db/schema.js'
import { enqueueDeliveryCheck, processDeliveryChecks } from '../src/lib/scheduler.js'

const EMAIL = 'delivery-verify@example.com'
const PHONE = '+972500000042'

let userId: string
let sessionId: string

function todayJerusalem() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

// now() far in the future so every enqueued check is past the 5-minute delay.
// HOUR_1 for first runs; HOUR_2 for follow-up runs so entries re-enqueued at
// HOUR_1 (retry attempts) are themselves past the delay gate.
const BASE = Date.now()
const HOUR_1 = () => BASE + 60 * 60_000
const HOUR_2 = () => BASE + 120 * 60_000

beforeAll(async () => {
  const db = getTestDb()
  const u = await seedUser(EMAIL, 'Delivery Verify')
  userId = u.id
  await db.update(userSettings).set({ phoneNumber: PHONE }).where(eq(userSettings.userId, userId))
  const [session] = await db
    .insert(whatsappSession)
    .values({ userId, date: todayJerusalem(), state: 'snoozed', snoozeCount: 0, lastMessageAt: new Date() })
    .returning()
  sessionId = session.id
})

afterAll(async () => {
  const db = getTestDb()
  await db.delete(whatsappSession).where(eq(whatsappSession.userId, userId))
  await cleanupUsers([EMAIL])
})

describe('Delivery verification & retry', () => {
  it('resends once when the message is undelivered and the session is still open', async () => {
    const sent: Array<{ text: string; to: string | undefined }> = []
    enqueueDeliveryCheck({ sid: 'SMoriginal', userId, sessionId, phone: PHONE, text: 'checkin', sentAt: Date.now(), attempt: 1 })

    await processDeliveryChecks({
      fetchStatus: async () => ({ status: 'undelivered', errorCode: 30008 }),
      send: async (text, to) => { sent.push({ text, to }); return 'SMretry' },
      now: HOUR_1,
    })

    expect(sent).toEqual([{ text: 'checkin', to: PHONE }])

    // The retry was re-enqueued as attempt 2 (sentAt = HOUR_1). Run again an
    // hour later with another failure — the cap must prevent a third send.
    await processDeliveryChecks({
      fetchStatus: async () => ({ status: 'undelivered', errorCode: 30008 }),
      send: async (text, to) => { sent.push({ text, to }); return 'SMretry2' },
      now: HOUR_2,
    })
    expect(sent).toHaveLength(1)

    // And the capped entry was removed: nothing left to fetch.
    let fetched = 0
    await processDeliveryChecks({
      fetchStatus: async () => { fetched++; return { status: 'undelivered', errorCode: null } },
      send: async () => 'SMnope',
      now: HOUR_2,
    })
    expect(fetched).toBe(0)
  })

  it('does nothing when the message was delivered', async () => {
    const sent: string[] = []
    enqueueDeliveryCheck({ sid: 'SMdelivered', userId, sessionId, phone: PHONE, text: 'checkin', sentAt: Date.now(), attempt: 1 })

    await processDeliveryChecks({
      fetchStatus: async () => ({ status: 'delivered', errorCode: null }),
      send: async (text) => { sent.push(text); return 'SMx' },
      now: HOUR_1,
    })
    expect(sent).toHaveLength(0)

    // Queue drained: a second run must not fetch or send anything
    let fetched = 0
    await processDeliveryChecks({
      fetchStatus: async () => { fetched++; return { status: 'undelivered', errorCode: null } },
      send: async () => 'SMy',
      now: HOUR_1,
    })
    expect(fetched).toBe(0)
  })

  it('does not resend when the user completed the check-in in the meantime', async () => {
    const db = getTestDb()
    await db
      .update(whatsappSession)
      .set({ state: 'completed' })
      .where(and(eq(whatsappSession.id, sessionId), eq(whatsappSession.userId, userId)))

    const sent: string[] = []
    enqueueDeliveryCheck({ sid: 'SMlate', userId, sessionId, phone: PHONE, text: 'checkin', sentAt: Date.now(), attempt: 1 })

    await processDeliveryChecks({
      fetchStatus: async () => ({ status: 'undelivered', errorCode: 30008 }),
      send: async (text) => { sent.push(text); return 'SMz' },
      now: HOUR_1,
    })
    expect(sent).toHaveLength(0)
  })
})
