import { Router } from 'express'
import { desc } from 'drizzle-orm'
import { getDb } from '../db/index.js'
import { whatsappSession, userSettings } from '../db/schema.js'

const router = Router()

function debugPayload() {
  const db = getDb()
  return Promise.all([
    db.select().from(whatsappSession).orderBy(desc(whatsappSession.date)).limit(3),
    db.select().from(userSettings).limit(1),
  ])
}

function envPresence() {
  return {
    TWILIO_ACCOUNT_SID: !!process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: !!process.env.TWILIO_AUTH_TOKEN,
    TWILIO_WHATSAPP_FROM: !!process.env.TWILIO_WHATSAPP_FROM,
    USER_WHATSAPP_NUMBER: !!process.env.USER_WHATSAPP_NUMBER,
  }
}

function jerusalemNow() {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(new Date())
}

// Auth-gated version
router.get('/whatsapp-status', async (_req, res) => {
  try {
    const [sessions, settings] = await debugPayload()
    res.json({
      settings: settings[0] ?? null,
      sessions,
      serverTime: new Date().toISOString(),
      serverTimeJerusalem: jerusalemNow(),
      env: envPresence(),
    })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

// Temporary unauthenticated version — REMOVE AFTER DEBUGGING
router.get('/whatsapp-status-public', async (_req, res) => {
  try {
    const [sessions, settings] = await debugPayload()
    const s = settings[0] ?? null
    res.json({
      settings: s ? {
        checkinTime: s.checkinTime,
        phoneNumber: s.phoneNumber,
        timezone: s.timezone,
      } : null,
      sessions: sessions.map(row => ({
        date: row.date,
        state: row.state,
        snoozeCount: row.snoozeCount,
        lastMessageAt: row.lastMessageAt,
      })),
      serverTime: new Date().toISOString(),
      serverTimeJerusalem: jerusalemNow(),
      env: envPresence(),
    })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

export default router
