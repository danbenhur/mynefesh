import { Router } from 'express'
import { desc } from 'drizzle-orm'
import { getDb } from '../db/index.js'
import { whatsappSession, userSettings } from '../db/schema.js'

const router = Router()

// Temporary diagnostic endpoint — remove after debugging
router.get('/whatsapp-status', async (_req, res) => {
  try {
    const db = getDb()

    const [sessions, settings] = await Promise.all([
      db.select().from(whatsappSession).orderBy(desc(whatsappSession.date)).limit(5),
      db.select().from(userSettings).limit(1),
    ])

    res.json({
      settings: settings[0] ?? null,
      sessions,
      serverTime: new Date().toISOString(),
      serverTimeJerusalem: new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Jerusalem',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
      }).format(new Date()),
    })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

export default router
