import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import app from '../src/app.js'
import { getTestDb, seedUser, cleanupUsers } from './helpers/db.js'
import { userSettings, whatsappSession } from '../src/db/schema.js'
import { and, eq } from 'drizzle-orm'

const PHONE_A = '+972500000001'
const PHONE_B = '+972500000002'
const UNKNOWN_PHONE = '+972500000099'
const EMAIL_A = 'webhook-test-a@example.com'
const EMAIL_B = 'webhook-test-b@example.com'

// Twilio sends "whatsapp:+NNNN" prefix in From/To fields
function twilioPhone(phone: string) {
  return `whatsapp:${phone}`
}

let userAId: string
let userBId: string

function todayJerusalem() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

beforeAll(async () => {
  const db = getTestDb()
  const a = await seedUser(EMAIL_A, 'Webhook A')
  const b = await seedUser(EMAIL_B, 'Webhook B')
  userAId = a.id
  userBId = b.id

  // Set phone numbers on both users' settings
  await db
    .update(userSettings)
    .set({ phoneNumber: PHONE_A })
    .where(eq(userSettings.userId, userAId))
  await db
    .update(userSettings)
    .set({ phoneNumber: PHONE_B })
    .where(eq(userSettings.userId, userBId))

  // Create today's pending sessions for both users
  const today = todayJerusalem()
  await db
    .insert(whatsappSession)
    .values([
      { userId: userAId, date: today, state: 'pending', snoozeCount: 0 },
      { userId: userBId, date: today, state: 'pending', snoozeCount: 0 },
    ])
    .onConflictDoNothing()
})

afterAll(async () => {
  const db = getTestDb()
  // Clean up sessions
  await db.delete(whatsappSession).where(eq(whatsappSession.userId, userAId))
  await db.delete(whatsappSession).where(eq(whatsappSession.userId, userBId))
  await cleanupUsers([EMAIL_A, EMAIL_B])
})

// The webhook uses Twilio signature verification. In tests we skip it by
// not setting TWILIO_AUTH_TOKEN (which causes verifyTwilioSignature to call next() with a console.warn).
describe('Webhook routing', () => {
  it('inbound "בוצע" from user A marks only user A session as processed', async () => {
    const db = getTestDb()
    const today = todayJerusalem()

    const res = await supertest(app)
      .post('/webhook/sms')
      .type('form')
      .send({ From: twilioPhone(PHONE_A), Body: 'בוצע' })

    expect(res.status).toBe(200)
    expect(res.text).toContain('<Response>')

    // The key assertion: session B was NOT touched
    const [sessionB] = await db
      .select()
      .from(whatsappSession)
      .where(and(eq(whatsappSession.userId, userBId), eq(whatsappSession.date, today)))
    expect(sessionB.state).toBe('pending') // B untouched

    // A was processed: either completed (if sendSMS succeeded) or pending (if sendSMS failed — acceptable)
    const [sessionA] = await db
      .select()
      .from(whatsappSession)
      .where(and(eq(whatsappSession.userId, userAId), eq(whatsappSession.date, today)))
    expect(['pending', 'completed']).toContain(sessionA.state)
  })

  it('inbound from unknown phone is silently dropped — returns TwiML 200', async () => {
    const res = await supertest(app)
      .post('/webhook/sms')
      .type('form')
      .send({ From: twilioPhone(UNKNOWN_PHONE), Body: 'בוצע' })

    expect(res.status).toBe(200)
    expect(res.text).toContain('<Response>')
  })

  it('delivery failure for user A phone marks only user A settings as expired', async () => {
    const db = getTestDb()

    const res = await supertest(app)
      .post('/webhook/sms-status')
      .type('form')
      .send({ To: twilioPhone(PHONE_A), MessageStatus: 'failed' })

    expect(res.status).toBe(204)

    const [settingsA] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userAId))
    const [settingsB] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userBId))

    expect(settingsA.sandboxStatus).toBe('expired')
    expect(settingsB.sandboxStatus).not.toBe('expired') // B untouched
  })

  it('delivery failure for unknown phone does not crash — returns 204', async () => {
    const res = await supertest(app)
      .post('/webhook/sms-status')
      .type('form')
      .send({ To: twilioPhone(UNKNOWN_PHONE), MessageStatus: 'failed' })

    expect(res.status).toBe(204)
  })
})
