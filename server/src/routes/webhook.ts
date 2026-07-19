import { Router } from 'express'
import type { Request, Response, NextFunction } from 'express'
import { eq, and } from 'drizzle-orm'
import twilio from 'twilio'
import { getDb } from '../db/index.js'
import { whatsappSession, userSettings } from '../db/schema.js'
import { sendSMS } from '../lib/whatsapp.js'
import { SNOOZE_FOLLOWUP, FINAL, CHECKIN_THANKS } from '../lib/whatsapp-messages.js'

const router = Router()

function verifyTwilioSignature(req: Request, res: Response, next: NextFunction): void {
  const authToken = process.env.TWILIO_AUTH_TOKEN
  if (!authToken) {
    console.warn('[webhook] TWILIO_AUTH_TOKEN not set — skipping signature verification (dev mode)')
    next()
    return
  }

  const signature = req.headers['x-twilio-signature'] as string | undefined
  if (!signature) {
    res.sendStatus(403)
    return
  }

  const publicUrl = (process.env.PUBLIC_URL ?? '').replace(/\/$/, '')
  const url = publicUrl + req.originalUrl

  const isValid = twilio.validateRequest(authToken, signature, url, req.body as Record<string, string>)
  if (!isValid) {
    console.warn(`[webhook] Invalid Twilio signature for ${req.originalUrl}`)
    res.sendStatus(403)
    return
  }

  next()
}

const TWIML_OK = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'

function todayJerusalem(): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

async function handleInboundMessage(req: Request, res: Response) {
  res.set('Content-Type', 'text/xml')

  try {
    // Strip Twilio's "whatsapp:" prefix; stored phone numbers are always E.164
    const rawFrom = String(req.body?.From ?? '')
    const phone = rawFrom.replace(/^whatsapp:/i, '').trim()

    const db = getDb()
    const [settingsRow] = await db
      .select({ userId: userSettings.userId, phoneNumber: userSettings.phoneNumber })
      .from(userSettings)
      .where(eq(userSettings.phoneNumber, phone))
      .limit(1)

    if (!settingsRow) {
      console.warn('[webhook] inbound from unknown phone %s — dropping', phone)
      res.send(TWIML_OK)
      return
    }

    const userId = settingsRow.userId
    const userPhone = settingsRow.phoneNumber! // we just looked it up, so it exists
    const date = todayJerusalem()
    const body = String(req.body?.Body ?? '').trim().toLowerCase()

    const rows = await db
      .select()
      .from(whatsappSession)
      .where(and(eq(whatsappSession.userId, userId), eq(whatsappSession.date, date)))

    if (rows.length === 0) {
      res.send(TWIML_OK)
      return
    }

    const session = rows[0]

    if (session.state === 'completed' || session.state === 'final_sent') {
      res.send(TWIML_OK)
      return
    }

    const isDone = ['done', 'בוצע', 'finished', 'סיימתי', 'גמרתי'].includes(body)

    if (isDone) {
      const sid = await sendSMS(CHECKIN_THANKS, userPhone)
      if (sid) {
        await db
          .update(whatsappSession)
          .set({ state: 'completed', lastMessageAt: new Date() })
          .where(and(eq(whatsappSession.id, session.id), eq(whatsappSession.userId, userId)))
      } else {
        console.log('[webhook] Thanks send failed — state unchanged, user can reply again')
      }
    } else {
      // treat any reply that isn't a done keyword as a snooze
      const newCount = session.snoozeCount + 1
      if (newCount >= 3) {
        const sid = await sendSMS(FINAL, userPhone)
        if (sid) {
          await db
            .update(whatsappSession)
            .set({ state: 'final_sent', snoozeCount: newCount, lastMessageAt: new Date() })
            .where(and(eq(whatsappSession.id, session.id), eq(whatsappSession.userId, userId)))
        } else {
          console.log('[webhook] Final send failed — state unchanged, will retry on next snooze reply')
        }
      } else {
        const sid = await sendSMS(SNOOZE_FOLLOWUP, userPhone)
        if (sid) {
          await db
            .update(whatsappSession)
            .set({ snoozeCount: newCount, lastMessageAt: new Date() })
            .where(and(eq(whatsappSession.id, session.id), eq(whatsappSession.userId, userId)))
        } else {
          console.log('[webhook] Snooze followup send failed — snooze_count unchanged, user can reply again')
        }
      }
    }
  } catch (err) {
    console.error('[webhook] Error processing inbound message:', err)
  }

  res.send(TWIML_OK)
}

async function handleDeliveryStatus(req: Request, res: Response) {
  try {
    const messageStatus = String(req.body?.MessageStatus ?? '')
    const rawTo = String(req.body?.To ?? '')
    // Log every callback receipt — during the July 2026 incident we couldn't
    // tell whether callbacks were arriving at all (docs/specs/002).
    console.log(`[webhook] delivery status callback: ${messageStatus} for ...${rawTo.slice(-4)}`)

    if (messageStatus === 'failed' || messageStatus === 'undelivered') {
      const isWhatsApp = /^whatsapp:/i.test(rawTo)
      const phone = rawTo.replace(/^whatsapp:/i, '').trim()

      const db = getDb()
      if (phone) {
        // sandbox 'expired' is a WhatsApp-sandbox concept — a failed plain SMS
        // (carrier issue like 30008) must not trigger the sandbox-renewal banner.
        await db
          .update(userSettings)
          .set({
            lastDeliveryFailureAt: new Date(),
            ...(isWhatsApp ? { sandboxStatus: 'expired' } : {}),
            updatedAt: new Date(),
          })
          .where(eq(userSettings.phoneNumber, phone))
        console.log(`[webhook] Delivery failure (${messageStatus}) for ${phone}${isWhatsApp ? ' — sandbox marked expired' : ''}`)
      } else {
        console.warn('[webhook] Delivery failure with no To phone — cannot scope update')
      }
    }
  } catch (err) {
    console.error('[webhook] delivery-status callback error:', err)
  }
  res.sendStatus(204)
}

// SMS routes (new)
router.post('/sms', verifyTwilioSignature, handleInboundMessage)
router.post('/sms-status', verifyTwilioSignature, handleDeliveryStatus)

// WhatsApp routes kept for backward compat — same handlers
router.post('/whatsapp', verifyTwilioSignature, handleInboundMessage)
router.post('/whatsapp-status', verifyTwilioSignature, handleDeliveryStatus)

export default router
