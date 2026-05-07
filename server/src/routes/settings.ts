import { Router } from 'express'
import { z } from 'zod'
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

router.get('/', async (_req, res) => {
  try {
    const row = await getSingletonRow()
    res.json({
      checkinTime: row.checkinTime,
      phoneNumber: row.phoneNumber ?? '',
      timezone: row.timezone,
    })
  } catch (err) {
    console.error('[settings] GET error:', err)
    res.status(500).json({ error: 'Failed to load settings' })
  }
})

const patchSchema = z.object({
  checkinTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'checkinTime must be HH:MM (00:00–23:59)')
    .optional(),
  phoneNumber: z
    .string()
    .refine(v => v === '' || v.startsWith('+') || v.startsWith('whatsapp:+'), {
      message: 'phoneNumber must start with + or whatsapp:+',
    })
    .optional(),
})

router.patch('/', async (req, res) => {
  const parsed = patchSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }

  try {
    const row = await getSingletonRow()
    const updates: Partial<typeof row> = { updatedAt: new Date() }
    if (parsed.data.checkinTime !== undefined) updates.checkinTime = parsed.data.checkinTime
    if (parsed.data.phoneNumber !== undefined) updates.phoneNumber = parsed.data.phoneNumber || null

    const updated = await getDb()
      .update(userSettings)
      .set(updates)
      .where(eq(userSettings.id, row.id))
      .returning()

    res.json({
      checkinTime: updated[0].checkinTime,
      phoneNumber: updated[0].phoneNumber ?? '',
      timezone: updated[0].timezone,
    })
  } catch (err) {
    console.error('[settings] PATCH error:', err)
    res.status(500).json({ error: 'Failed to save settings' })
  }
})

export default router
