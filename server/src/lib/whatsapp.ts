import twilio from 'twilio'

function getClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!sid || !token) return null
  return twilio(sid, token)
}

export async function sendWhatsApp(text: string): Promise<string | null> {
  const client = getClient()
  if (!client) {
    console.warn('[whatsapp] Twilio env vars not set — skipping send')
    return null
  }

  const from = process.env.TWILIO_WHATSAPP_FROM
  const to = process.env.USER_WHATSAPP_NUMBER
  if (!from || !to) {
    console.warn('[whatsapp] TWILIO_WHATSAPP_FROM or USER_WHATSAPP_NUMBER not set — skipping send')
    return null
  }

  try {
    const statusCallback = process.env.PUBLIC_URL
      ? `${process.env.PUBLIC_URL}/webhook/whatsapp-status`
      : undefined
    const msg = await client.messages.create({ from, to, body: text, statusCallback })
    console.log(`[whatsapp] Sent message SID=${msg.sid}`)
    return msg.sid
  } catch (err) {
    console.error('[whatsapp] Send failed:', err)
    return null
  }
}
