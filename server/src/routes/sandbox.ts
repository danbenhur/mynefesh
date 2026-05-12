import { Router } from 'express'
import { eq } from 'drizzle-orm'
import { getDb } from '../db/index.js'
import { userSettings } from '../db/schema.js'

const router = Router()

async function getSingletonRow() {
  const db = getDb()
  const rows = await db.select().from(userSettings).limit(1)
  if (rows.length > 0) return rows[0]
  const inserted = await db.insert(userSettings).values({}).returning()
  return inserted[0]
}

router.get('/status', async (_req, res) => {
  try {
    const row = await getSingletonRow()
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

router.post('/joined', async (_req, res) => {
  try {
    const row = await getSingletonRow()
    const updated = await getDb()
      .update(userSettings)
      .set({ sandboxStatus: 'active', lastSandboxJoinAt: new Date(), updatedAt: new Date() })
      .where(eq(userSettings.id, row.id))
      .returning()
    res.json({ ok: true, lastSandboxJoinAt: updated[0].lastSandboxJoinAt })
  } catch (err) {
    console.error('[sandbox] POST /joined error:', err)
    res.status(500).json({ error: 'Failed to update sandbox status' })
  }
})

export default router
