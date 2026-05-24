import cron from 'node-cron'
import SunCalc from 'suncalc'
import { and, eq, lt } from 'drizzle-orm'
import { getDb } from '../db/index.js'
import { userSettings, whatsappSession, resolutions, umbrellaQuestions, interviewSession, questionAnswers } from '../db/schema.js'
import { sendSMS } from './whatsapp.js'
import { checkinWithLink, MORNING_AFTER_SKIP, SANDBOX_EXPIRY_REMINDER } from './whatsapp-messages.js'
import { computeResolutionProgress, todayJerusalem } from './resolutions.js'
import { composeTodaysQuestions } from './interview-composer.js'

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173'
const JERUSALEM_LAT = 31.7683
const JERUSALEM_LON = 35.2137

function jerusalemNow(): { hhmm: string; date: string; dow: number } {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
    weekday: 'short',
  }).formatToParts(now)

  const get = (t: string) => parts.find(p => p.type === t)?.value ?? ''
  const hhmm = `${get('hour')}:${get('minute')}`
  const date = `${get('year')}-${get('month')}-${get('day')}`
  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const dow = WEEKDAYS.indexOf(get('weekday'))
  return { hhmm, date, dow: dow >= 0 ? dow : 0 }
}

// Returns a Date set to noon UTC on the given Jerusalem calendar date components,
// safe to pass to SunCalc regardless of DST offset.
function jeruCalendarNoon(now: Date): { year: number; month: number; day: number; dow: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric', month: '2-digit', day: '2-digit',
    weekday: 'short',
  }).formatToParts(now)
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? ''
  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return {
    year: parseInt(get('year')),
    month: parseInt(get('month')),
    day: parseInt(get('day')),
    dow: WEEKDAYS.indexOf(get('weekday')),
  }
}

// True when `now` falls between (Friday sunset - 1h) and (Saturday sunset + 1h)
// using actual Jerusalem sunset times from SunCalc.
function inShabbatWindow(now: Date): boolean {
  const { year, month, day, dow } = jeruCalendarNoon(now)
  if (dow !== 5 && dow !== 6) return false

  // Build noon-UTC dates for Friday and Saturday of this Shabbat.
  const todayNoon = new Date(Date.UTC(year, month - 1, day, 10, 0, 0))
  const fridayNoon = dow === 5 ? todayNoon : new Date(todayNoon.getTime() - 86_400_000)
  const saturdayNoon = dow === 6 ? todayNoon : new Date(todayNoon.getTime() + 86_400_000)

  const friSunset = SunCalc.getTimes(fridayNoon, JERUSALEM_LAT, JERUSALEM_LON).sunset
  const satSunset = SunCalc.getTimes(saturdayNoon, JERUSALEM_LAT, JERUSALEM_LON).sunset

  const windowStart = new Date(friSunset.getTime() - 60 * 60 * 1000)
  const windowEnd = new Date(satSunset.getTime() + 60 * 60 * 1000)

  return now >= windowStart && now <= windowEnd
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
    const { hhmm, date, dow } = jerusalemNow()
    const now = new Date()

    if (settings.shabbatMode && inShabbatWindow(now)) {
      console.log('[scheduler] shabbat_mode_skip (checkin)')
      return
    }

    const session = await getOrCreateSession(date)

    if (session.state === 'completed' || session.state === 'final_sent') return

    // On Saturday, honour the override time if set (allows firing after Shabbat ends)
    const effectiveCheckinTime =
      dow === 6 && settings.saturdayCheckinTime
        ? settings.saturdayCheckinTime
        : settings.checkinTime

    if (session.state === 'pending' && hhmm >= effectiveCheckinTime) {
      const interviewUrl = `${FRONTEND_URL}/#/interview`
      const sid = await sendSMS(checkinWithLink(interviewUrl))
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

    const settings = await getOrCreateSettings()
    if (settings.shabbatMode && inShabbatWindow(new Date())) {
      console.log('[scheduler] shabbat_mode_skip (morning)')
      return
    }

    const prevDate = yesterday(date)
    const db = getDb()

    // interview_session is the authoritative signal — if completed_at is set, no skip needed
    const interviewRows = await db
      .select()
      .from(interviewSession)
      .where(eq(interviewSession.date, prevDate))
    if (interviewRows[0]?.completedAt) {
      console.log('[scheduler] tickMorning: yesterday interview completed, skip morning reminder')
      return
    }

    // Belt-and-suspenders: if all of yesterday's questions have answers, treat as complete.
    // Guards against POST /complete failing after all answers were saved.
    const questionsDue = await composeTodaysQuestions(new Date(`${prevDate}T12:00:00Z`))
    if (questionsDue.length > 0) {
      const answersYesterday = await db
        .select()
        .from(questionAnswers)
        .where(eq(questionAnswers.interviewDate, prevDate))
      if (answersYesterday.length >= questionsDue.length) {
        console.log('[scheduler] tickMorning: all questions answered for yesterday (completedAt missing), skip morning reminder')
        return
      }
    }

    // Fall back to whatsapp_session state as secondary guard
    const rows = await db
      .select()
      .from(whatsappSession)
      .where(eq(whatsappSession.date, prevDate))

    if (rows.length === 0) return
    const prev = rows[0]
    if (prev.state !== 'completed') {
      await sendSMS(MORNING_AFTER_SKIP)
    }
  } catch (err) {
    console.error('[scheduler] tickMorning error:', err)
  }
}

// Runs once per day at 00:01 Jerusalem time. Completes any active resolutions
// whose end_date has passed and records the final score.
async function tickResolutions() {
  try {
    const db = getDb()
    const { hhmm } = jerusalemNow()
    if (hhmm !== '00:01') return

    const today = todayJerusalem()
    const expired = await db
      .select()
      .from(resolutions)
      .where(and(eq(resolutions.status, 'active'), lt(resolutions.endDate, today)))

    for (const r of expired) {
      const [q] = await db
        .select({ answerType: umbrellaQuestions.answerType })
        .from(umbrellaQuestions)
        .where(eq(umbrellaQuestions.id, r.questionId))
      const progress = await computeResolutionProgress(
        { questionId: r.questionId, startDate: String(r.startDate), endDate: String(r.endDate), successThreshold: r.successThreshold },
        q?.answerType ?? 'boolean',
      )
      await db
        .update(resolutions)
        .set({ status: 'completed', finalScore: progress.percentage, updatedAt: new Date() })
        .where(eq(resolutions.id, r.id))
      console.log(`[scheduler] Resolution ${r.id} auto-completed with score ${progress.percentage}%`)
    }
  } catch (err) {
    console.error('[scheduler] tickResolutions error:', err)
  }
}

async function tickSandboxReminder() {
  try {
    const settings = await getOrCreateSettings()
    if (!settings.lastSandboxJoinAt) return

    if (settings.shabbatMode && inShabbatWindow(new Date())) {
      console.log('[scheduler] shabbat_mode_skip (sandbox reminder)')
      return
    }

    const hoursSinceJoin = (Date.now() - new Date(settings.lastSandboxJoinAt).getTime()) / 3_600_000
    if (hoursSinceJoin < 60 || hoursSinceJoin >= 66) return

    if (settings.last60hReminderAt) {
      const hoursSinceReminder = (Date.now() - new Date(settings.last60hReminderAt).getTime()) / 3_600_000
      if (hoursSinceReminder < 24) return
    }

    const sid = await sendSMS(SANDBOX_EXPIRY_REMINDER)
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
    await tickResolutions()
  })

  console.log('[scheduler] Started (runs every minute)')
}
