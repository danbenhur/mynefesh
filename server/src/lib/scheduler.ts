import cron from 'node-cron'
import { eq } from 'drizzle-orm'
import { getDb } from '../db/index.js'
import { userSettings, whatsappSession } from '../db/schema.js'
import { sendWhatsApp } from './whatsapp.js'
import { INITIAL, MORNING_AFTER_SKIP, SANDBOX_EXPIRY_REMINDER } from './whatsapp-messages.js'

function jerusalemNow(): { hhmm: string; date: string } {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(now)

  const get = (t: string) => parts.find(p => p.type === t)?.value ?? ''
  const hhmm = `${get('hour')}:${get('minute')}`
  const date = `${get('year')}-${get('month')}-${get('day')}`
  return { hhmm, date }
}

function yesterday(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`)
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

async function getOrCreateSettings() {
  const db = getDb()
  const rows = await db.select().from(userSettings).limit(1)
  if (rows.length > 0) return rows[0]
  const inserted = await db.insert(userSettings).values({}).returning()
  return inserted[0]
}

async function getOrCreateSession(date: string) {
  const db = getDb()
  const rows = await db.select().from(whatsappSession).where(eq(whatsappSession.date, date))
  if (rows.length > 0) return rows[0]
  const inserted = await db.insert(whatsappSession).values({ date }).returning()
  return inserted[0]
}

async function tickCheckin() {
  try {
    const db = getDb()
    const settings = await getOrCreateSettings()
    const { hhmm, date } = jerusalemNow()

    const session = await getOrCreateSession(date)

    if (session.state === 'completed' || session.state === 'final_sent') return

    if (session.state === 'pending' && hhmm >= settings.checkinTime) {
      const sid = await sendWhatsApp(INITIAL)
      if (sid) {
        await db
          .update(whatsappSession)
          .set({ state: 'snoozed', lastMessageAt: new Date() })
          .where(eq(whatsappSession.id, session.id))
      } else {
        console.log('[scheduler] Send failed — leaving state=pending, will retry next minute')
      }
    }
  } catch (err) {
    console.error('[scheduler] tickCheckin error:', err)
  }
}

async function tickMorning() {
  try {
    const { hhmm, date } = jerusalemNow()
    if (hhmm !== '09:00') return

    const prevDate = yesterday(date)
    const db = getDb()
    const rows = await db
      .select()
      .from(whatsappSession)
      .where(eq(whatsappSession.date, prevDate))

    if (rows.length === 0) return
    const prev = rows[0]
    if (prev.state !== 'completed') {
      await sendWhatsApp(MORNING_AFTER_SKIP)
    }
  } catch (err) {
    console.error('[scheduler] tickMorning error:', err)
  }
}

async function tickSandboxReminder() {
  try {
    const settings = await getOrCreateSettings()
    if (!settings.lastSandboxJoinAt) return

    const hoursSinceJoin = (Date.now() - new Date(settings.lastSandboxJoinAt).getTime()) / 3_600_000
    if (hoursSinceJoin < 60 || hoursSinceJoin >= 66) return

    if (settings.last60hReminderAt) {
      const hoursSinceReminder = (Date.now() - new Date(settings.last60hReminderAt).getTime()) / 3_600_000
      if (hoursSinceReminder < 24) return
    }

    const sid = await sendWhatsApp(SANDBOX_EXPIRY_REMINDER)
    if (sid) {
      const db = getDb()
      await db
        .update(userSettings)
        .set({ last60hReminderAt: new Date() })
        .where(eq(userSettings.id, settings.id))
      console.log('[scheduler] Sent 60h sandbox expiry reminder')
    }
  } catch (err) {
    console.error('[scheduler] tickSandboxReminder error:', err)
  }
}

export function startScheduler() {
  if (!process.env.DATABASE_URL) {
    console.log('[scheduler] No DATABASE_URL — scheduler disabled')
    return
  }

  cron.schedule('* * * * *', async () => {
    await tickCheckin()
    await tickMorning()
    await tickSandboxReminder()
  })

  console.log('[scheduler] Started (runs every minute)')
}
