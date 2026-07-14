import twilio from 'twilio'
import { sql } from 'drizzle-orm'
import { getDb } from '../db/index.js'

const DAILY_SMS_LIMIT = parseInt(process.env.DAILY_SMS_LIMIT ?? '50', 10)

// Normalize any stored/legacy phone value to bare E.164.
// Handles the formats that have historically reached user_settings.phone_number:
// 'whatsapp:+972...' (old sandbox convention), '050...' (Israeli local), and
// values with spaces/dashes. Returns null when the result is not valid E.164.
export function normalizePhone(raw: string): string | null {
  let p = raw.trim().replace(/^whatsapp:/i, '').replace(/[\s()-]/g, '')
  if (/^05\d{8}$/.test(p)) p = `+972${p.slice(1)}`
  return /^\+[1-9]\d{6,14}$/.test(p) ? p : null
}

function getClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!sid || !token) return null
  return twilio(sid, token)
}

async function getTodaySmsCount(): Promise<number> {
  try {
    const db = getDb()
    const result = await db.execute(
      sql`SELECT COUNT(*)::int AS cnt FROM api_usage WHERE kind = 'sms' AND day_utc = CURRENT_DATE`
    )
    return parseInt(String(result.rows[0]?.cnt ?? '0'), 10)
  } catch {
    return 0 // fail open — don't suppress sends when DB is unavailable
  }
}

async function recordSmsUsage(): Promise<void> {
  try {
    const db = getDb()
    const today = new Date().toISOString().split('T')[0]
    await db.execute(
      sql`INSERT INTO api_usage (kind, occurred_at, day_utc) VALUES ('sms', NOW(), ${today}::date)`
    )
  } catch (err) {
    console.error('[messaging] Failed to record SMS usage:', err)
  }
}

export async function sendSMS(text: string, to?: string): Promise<string | null> {
  const todayCount = await getTodaySmsCount()
  console.log(`[sms-diag] todayCount=${todayCount} limit=${DAILY_SMS_LIMIT}`)
  if (todayCount >= DAILY_SMS_LIMIT) {
    console.warn(`[SMS CAP] Daily SMS limit reached (${todayCount}/${DAILY_SMS_LIMIT}), suppressing send`)
    return null
  }

  const client = getClient()
  console.log(`[sms-diag] twilioClient=${client ? 'ok' : 'null'} sid?=${!!process.env.TWILIO_ACCOUNT_SID} token?=${!!process.env.TWILIO_AUTH_TOKEN}`)
  if (!client) {
    console.warn('[messaging] Twilio env vars not set — skipping send')
    return null
  }

  const from = process.env.TWILIO_SMS_FROM ?? process.env.TWILIO_WHATSAPP_FROM
  const rawDestination = to ?? process.env.USER_SMS_NUMBER ?? process.env.USER_WHATSAPP_NUMBER
  console.log(`[sms-diag] from=${from ? 'set' : 'MISSING'} destination=${rawDestination ? rawDestination.slice(-4) : 'MISSING'}`)
  if (!from || !rawDestination) {
    console.warn('[messaging] No from/to configured — skipping send')
    return null
  }

  // Normalize the destination and force its channel to match `from`: a
  // whatsapp: sender needs a whatsapp: recipient, an SMS sender a bare E.164
  // one. Twilio hard-rejects mixed channels, so never trust stored format.
  const normalized = normalizePhone(rawDestination)
  if (!normalized) {
    console.error(`[messaging] Destination ...${rawDestination.slice(-4)} is not a valid phone number — skipping send`)
    return null
  }
  const destination = from.toLowerCase().startsWith('whatsapp:') ? `whatsapp:${normalized}` : normalized

  try {
    const statusCallback = process.env.PUBLIC_URL
      ? `${process.env.PUBLIC_URL}/webhook/whatsapp-status`
      : undefined
    console.log(`[sms-diag] attempting twilio.messages.create from=...${from?.slice(-4)} to=...${destination.slice(-4)}`)
    const msg = await client.messages.create({ from, to: destination, body: text, statusCallback })
    console.log(`[messaging] Sent message SID=${msg.sid}`)
    await recordSmsUsage()
    return msg.sid
  } catch (err) {
    console.error('[messaging] Send failed:', err)
    console.error('[sms-diag] twilio error code=', (err as any)?.code, 'status=', (err as any)?.status, 'moreInfo=', (err as any)?.moreInfo)
    return null
  }
}
