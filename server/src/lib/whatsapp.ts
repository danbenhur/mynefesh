import twilio from 'twilio'

function getClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!sid || !token) return null
  return twilio(sid, token)
}

export async function sendSMS(text: string): Promise<string | null> {
  const client = getClient()
  if (!client) {
    console.warn('[messaging] Twilio env vars not set — skipping send')
    return null
  }

  const from = process.env.TWILIO_SMS_FROM ?? process.env.TWILIO_WHATSAPP_FROM
  const to = process.env.USER_SMS_NUMBER ?? process.env.USER_WHATSAPP_NUMBER
  if (!from || !to) {
    console.warn('[messaging] No from/to configured (set TWILIO_SMS_FROM + USER_SMS_NUMBER) — skipping send')
    return null
  }

  try {
    const statusCallback = process.env.PUBLIC_URL
      ? `${process.env.PUBLIC_URL}/webhook/whatsapp-status`
      : undefined
    const msg = await client.messages.create({ from, to, body: text, statusCallback })
    console.log(`[messaging] Sent message SID=${msg.sid}`)
    return msg.sid
  } catch (err) {
    console.error('[messaging] Send failed:', err)
    return null
  }
}
