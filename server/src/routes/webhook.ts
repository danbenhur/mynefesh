import { Router } from 'express'
import { eq } from 'drizzle-orm'
import { getDb } from '../db/index.js'
import { whatsappSession } from '../db/schema.js'
import { sendWhatsApp } from '../lib/whatsapp.js'
import { SNOOZE_FOLLOWUP, FINAL, CHECKIN_THANKS } from '../lib/whatsapp-messages.js'

const router = Router()

const TWIML_OK = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'

function todayJerusalem(): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

router.post('/whatsapp', async (req, res) => {
  res.set('Content-Type', 'text/xml')

  try {
    const body = String(req.body?.Body ?? '').trim().toLowerCase()
    const db = getDb()
    const date = todayJerusalem()

    const rows = await db
      .select()
      .from(whatsappSession)
      .where(eq(whatsappSession.date, date))

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
      const sid = await sendWhatsApp(CHECKIN_THANKS)
      if (sid) {
        await db
          .update(whatsappSession)
          .set({ state: 'completed', lastMessageAt: new Date() })
          .where(eq(whatsappSession.id, session.id))
      } else {
        console.log('[webhook] Thanks send failed — state unchanged, user can reply again')
      }
    } else {
      // treat any reply that isn't a done keyword as a snooze
      const newCount = session.snoozeCount + 1
      if (newCount >= 3) {
        const sid = await sendWhatsApp(FINAL)
        if (sid) {
          await db
            .update(whatsappSession)
            .set({ state: 'final_sent', snoozeCount: newCount, lastMessageAt: new Date() })
            .where(eq(whatsappSession.id, session.id))
        } else {
          console.log('[webhook] Final send failed — state unchanged, will retry on next snooze reply')
        }
      } else {
        const sid = await sendWhatsApp(SNOOZE_FOLLOWUP)
        if (sid) {
          await db
            .update(whatsappSession)
            .set({ snoozeCount: newCount, lastMessageAt: new Date() })
            .where(eq(whatsappSession.id, session.id))
        } else {
          console.log('[webhook] Snooze followup send failed — snooze_count unchanged, user can reply again')
        }
      }
    }
  } catch (err) {
    console.error('[webhook] Error processing WhatsApp message:', err)
  }

  res.send(TWIML_OK)
})

export default router
