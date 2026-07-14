import cron from 'node-cron'
import SunCalc from 'suncalc'
import { and, eq, isNotNull, lt } from 'drizzle-orm'
import { getDb } from '../db/index.js'
import { userSettings, whatsappSession, resolutions, umbrellaQuestions, interviewSession, questionAnswers } from '../db/schema.js'
import { sendSMS } from './whatsapp.js'
import { checkinWithLink, MORNING_AFTER_SKIP, SANDBOX_EXPIRY_REMINDER } from './whatsapp-messages.js'
import { computeResolutionProgress, todayJerusalem } from './resolutions.js'
import { composeTodaysQuestions } from './interview-composer.js'

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173'
const JERUSALEM_LAT = 31.7683
const JERUSALEM_LON = 35.2137

type SettingsRow = typeof userSettings.$inferSelect

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

// --- Per-user settings cache ---
// user_settings changes rarely (only via PATCH /api/settings). Caching with a
// 1-hour TTL means each tick reads from memory instead of Neon for known users.
// Call invalidateSettingsCache(userId) immediately after any write to user_settings
// so updates are reflected within the next tick rather than waiting for TTL expiry.
const settingsCache = new Map<string, { data: SettingsRow; fetchedAt: number }>()
const SETTINGS_TTL_MS = 60 * 60 * 1000 // 1 hour

export function invalidateSettingsCache(userId?: string): void {
  if (userId) {
    settingsCache.delete(userId)
  } else {
    settingsCache.clear()
  }
}

async function getSettingsForUser(userId: string): Promise<SettingsRow | null> {
  const cached = settingsCache.get(userId)
  if (cached && Date.now() - cached.fetchedAt < SETTINGS_TTL_MS) return cached.data
  const db = getDb()
  const [row] = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1)
  if (!row) return null
  settingsCache.set(userId, { data: row, fetchedAt: Date.now() })
  return row
}

// Fetches all users who have a phone number configured.
// Hits the DB every minute — intentional, so newly configured users are picked up promptly.
async function getAllUsersWithPhone(): Promise<SettingsRow[]> {
  const db = getDb()
  try {
    const all = await db.select({ id: userSettings.userId, phone: userSettings.phoneNumber }).from(userSettings)
    console.log(`[scheduler-diag] user_settings total rows=${all.length}; with phone=${all.filter(r => r.phone).length}`)
  } catch (e) {
    console.error('[scheduler-diag] failed to count user_settings:', (e as Error).message)
  }
  return db.select().from(userSettings).where(isNotNull(userSettings.phoneNumber))
}

async function getOrCreateSession(userId: string, date: string) {
  const db = getDb()
  const rows = await db
    .select()
    .from(whatsappSession)
    .where(and(eq(whatsappSession.userId, userId), eq(whatsappSession.date, date)))
  if (rows.length > 0) return rows[0]
  const inserted = await db.insert(whatsappSession).values({ userId, date }).returning()
  return inserted[0]
}

async function tickCheckin() {
  try {
    const { hhmm, date, dow } = jerusalemNow()
    const now = new Date()
    const inWindow = inShabbatWindow(now)
    const allUsers = await getAllUsersWithPhone()
    console.log(`[scheduler-diag] tickCheckin found ${allUsers.length} users with phone`)

    for (const settings of allUsers) {
      try {
        // shabbatMode is the user's stored preference; inShabbatWindow is the live
        // computed state — print both so one is never mistaken for the other.
        console.log(`[scheduler-diag] user=${settings.userId.slice(0, 8)} phone=${settings.phoneNumber ? settings.phoneNumber.slice(-4) : 'NULL'} checkinTime=${settings.checkinTime} hhmm=${hhmm} shabbatMode=${settings.shabbatMode} inShabbatWindow=${inWindow} session?=fetching`)
        if (!settings.phoneNumber) continue

        if (settings.shabbatMode && inWindow) continue

        const effectiveCheckinTime =
          dow === 6 && settings.saturdayCheckinTime
            ? settings.saturdayCheckinTime
            : settings.checkinTime

        // Short-circuit: nothing to do before the checkin window for this user.
        if (hhmm < effectiveCheckinTime) continue

        const db = getDb()
        const session = await getOrCreateSession(settings.userId, date)
        console.log(`[scheduler-diag]   session.state=${session.state}`)

        if (session.state === 'completed' || session.state === 'final_sent') continue

        if (session.state === 'pending') {
          const interviewUrl = `${FRONTEND_URL}/#/interview`
          const sid = await sendSMS(checkinWithLink(interviewUrl), settings.phoneNumber)
          console.log(`[scheduler-diag]   sendSMS returned sid=${sid ?? 'null'}`)
          if (sid) {
            await db
              .update(whatsappSession)
              .set({ state: 'snoozed', lastMessageAt: new Date() })
              .where(and(eq(whatsappSession.id, session.id), eq(whatsappSession.userId, settings.userId)))
          } else {
            console.log('[scheduler] Send failed — leaving state=pending, will retry next minute')
          }
        }
      } catch (err) {
        console.error(`[scheduler] tickCheckin error for user ${settings.userId}:`, err)
      }
    }
  } catch (err) {
    console.error('[scheduler] tickCheckin error:', err)
  }
}

async function tickMorning() {
  try {
    // Cheap time check before any I/O.
    const { hhmm, date } = jerusalemNow()
    if (hhmm !== '09:00') return

    const now = new Date()
    const prevDate = yesterday(date)
    const db = getDb()
    const allUsers = await getAllUsersWithPhone()

    for (const settings of allUsers) {
      try {
        if (!settings.phoneNumber) continue
        if (settings.shabbatMode && inShabbatWindow(now)) continue

        // interview_session is the authoritative signal — if completed_at is set, no skip needed
        const interviewRows = await db
          .select()
          .from(interviewSession)
          .where(and(eq(interviewSession.date, prevDate), eq(interviewSession.userId, settings.userId)))
        if (interviewRows[0]?.completedAt) continue

        // Belt-and-suspenders: if all of yesterday's questions have answers, treat as complete.
        // Guards against POST /complete failing after all answers were saved.
        const questionsDue = await composeTodaysQuestions(new Date(`${prevDate}T12:00:00Z`), settings.userId)
        if (questionsDue.length > 0) {
          const answersYesterday = await db
            .select()
            .from(questionAnswers)
            .where(and(
              eq(questionAnswers.interviewDate, prevDate),
              eq(questionAnswers.userId, settings.userId),
            ))
          if (answersYesterday.length >= questionsDue.length) continue
        }

        // Fall back to whatsapp_session state as secondary guard
        const rows = await db
          .select()
          .from(whatsappSession)
          .where(and(eq(whatsappSession.date, prevDate), eq(whatsappSession.userId, settings.userId)))

        if (rows.length === 0) continue
        if (rows[0].state !== 'completed') {
          await sendSMS(MORNING_AFTER_SKIP, settings.phoneNumber)
        }
      } catch (err) {
        console.error(`[scheduler] tickMorning error for user ${settings.userId}:`, err)
      }
    }
  } catch (err) {
    console.error('[scheduler] tickMorning error:', err)
  }
}

// Runs once per day at 00:01 Jerusalem time. Completes any active resolutions
// whose end_date has passed and records the final score.
// No per-user changes needed: resolutions.id is a UUID PK — querying all expired
// resolutions across all users is safe, with no cross-user data leakage.
async function tickResolutions() {
  try {
    // Cheap time check — getDb() returns the already-initialized client, no network call.
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
    const now = new Date()
    const allUsers = await getAllUsersWithPhone()

    for (const settings of allUsers) {
      try {
        if (!settings.phoneNumber) continue
        if (!settings.lastSandboxJoinAt) continue
        if (settings.shabbatMode && inShabbatWindow(now)) continue

        const hoursSinceJoin = (now.getTime() - new Date(settings.lastSandboxJoinAt).getTime()) / 3_600_000
        if (hoursSinceJoin < 60 || hoursSinceJoin >= 66) continue

        if (settings.last60hReminderAt) {
          const hoursSinceReminder = (now.getTime() - new Date(settings.last60hReminderAt).getTime()) / 3_600_000
          if (hoursSinceReminder < 24) continue
        }

        const sid = await sendSMS(SANDBOX_EXPIRY_REMINDER, settings.phoneNumber)
        if (sid) {
          const db = getDb()
          const reminderAt = new Date()
          await db
            .update(userSettings)
            .set({ last60hReminderAt: reminderAt })
            .where(eq(userSettings.userId, settings.userId))
          // Patch cache in-place so next tick sees the updated timestamp without a DB round-trip.
          settingsCache.set(settings.userId, {
            data: { ...settings, last60hReminderAt: reminderAt },
            fetchedAt: Date.now(),
          })
          console.log(`[scheduler] Sent 60h sandbox expiry reminder to user ${settings.userId}`)
        }
      } catch (err) {
        console.error(`[scheduler] tickSandboxReminder error for user ${settings.userId}:`, err)
      }
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

  console.log('[scheduler-diag] starting at', new Date().toISOString())

  cron.schedule('* * * * *', async () => {
    const { hhmm, date } = jerusalemNow()
    console.log(`[scheduler-diag] tick hhmm=${hhmm} date=${date}`)
    await tickCheckin()
    await tickMorning()
    await tickSandboxReminder()
    await tickResolutions()
  })

  console.log('[scheduler] Started (runs every minute)')
}
