import { Router } from 'express'
import { and, eq } from 'drizzle-orm'
import { getDb } from '../db/index.js'
import { whatsappSession } from '../db/schema.js'

const router = Router()

function todayJerusalem(): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

// Resets today's session to pending so the scheduler retries tonight.
router.post('/reset-today', async (req, res) => {
  try {
    const db = getDb()
    const userId = req.user!.id
    const date = todayJerusalem()

    const rows = await db
      .select()
      .from(whatsappSession)
      .where(and(eq(whatsappSession.userId, userId), eq(whatsappSession.date, date)))

    if (rows.length === 0) {
      res.status(404).json({ error: 'No session for today yet' })
      return
    }

    const updated = await db
      .update(whatsappSession)
      .set({ state: 'pending', snoozeCount: 0, lastMessageAt: null })
      .where(and(eq(whatsappSession.userId, userId), eq(whatsappSession.date, date)))
      .returning()

    res.json({ ok: true, session: updated[0] })
  } catch (err) {
    console.error('[whatsapp-admin] reset-today error:', err)
    res.status(500).json({ error: 'Failed to reset session' })
  }
})

export default router
