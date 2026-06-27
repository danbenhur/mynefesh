import { Router } from 'express'
import { eq } from 'drizzle-orm'
import { getDb } from '../db/index.js'
import { userSettings } from '../db/schema.js'

const router = Router()

router.get('/status', async (req, res) => {
  try {
    const db = getDb()
    const userId = req.user!.id
    const rows = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1)

    if (rows.length === 0) {
      res.json({ sandboxStatus: 'unknown', lastSandboxJoinAt: null, lastDeliveryFailureAt: null })
      return
    }

    const row = rows[0]
    res.json({
      sandboxStatus: row.sandboxStatus,
      lastSandboxJoinAt: row.lastSandboxJoinAt ?? null,
      lastDeliveryFailureAt: row.lastDeliveryFailureAt ?? null,
    })
  } catch (err) {
    console.error('[sandbox] GET /status error:', err)
    res.status(500).json({ error: 'Failed to load sandbox status' })
  }
})

router.post('/joined', async (req, res) => {
  try {
    const db = getDb()
    const userId = req.user!.id
    const updated = await db
      .update(userSettings)
      .set({ sandboxStatus: 'active', lastSandboxJoinAt: new Date(), updatedAt: new Date() })
      .where(eq(userSettings.userId, userId))
      .returning()

    if (updated.length === 0) {
      res.status(404).json({ error: 'No settings row found for user' })
      return
    }

    res.json({ ok: true, lastSandboxJoinAt: updated[0].lastSandboxJoinAt })
  } catch (err) {
    console.error('[sandbox] POST /joined error:', err)
    res.status(500).json({ error: 'Failed to update sandbox status' })
  }
})

export default router
