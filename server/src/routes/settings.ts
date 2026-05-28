import { Router } from 'express'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { getDb } from '../db/index.js'
import { userSettings, whatsappSession } from '../db/schema.js'
import { invalidateSettingsCache } from '../lib/scheduler.js'

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
      shabbatMode: row.shabbatMode,
      saturdayCheckinTime: row.saturdayCheckinTime ?? null,
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
  shabbatMode: z.boolean().optional(),
  saturdayCheckinTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'saturdayCheckinTime must be HH:MM')
    .nullable()
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
    if (parsed.data.shabbatMode !== undefined) updates.shabbatMode = parsed.data.shabbatMode
    if (parsed.data.saturdayCheckinTime !== undefined) updates.saturdayCheckinTime = parsed.data.saturdayCheckinTime

    const updated = await getDb()
      .update(userSettings)
      .set(updates)
      .where(eq(userSettings.id, row.id))
      .returning()

    // When checkinTime changes, reset today's session if it's snoozed so the
    // evening tick can still fire. Skip completed/final_sent (already done for today).
    if (parsed.data.checkinTime !== undefined) {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Jerusalem',
        year: 'numeric', month: '2-digit', day: '2-digit',
      }).formatToParts(new Date()).reduce(
        (acc, p) => p.type === 'literal' ? acc : { ...acc, [p.type]: p.value },
        {} as Record<string, string>
      )
      const today = `${parts.year}-${parts.month}-${parts.day}`

      const existing = await getDb()
        .select({ state: whatsappSession.state })
        .from(whatsappSession)
        .where(eq(whatsappSession.date, today))

      if (existing.length > 0 && existing[0].state === 'snoozed') {
        await getDb()
          .update(whatsappSession)
          .set({ state: 'pending', snoozeCount: 0, lastMessageAt: null, nextSendAt: null })
          .where(eq(whatsappSession.date, today))
      }
    }

    invalidateSettingsCache()

    res.json({
      checkinTime: updated[0].checkinTime,
      phoneNumber: updated[0].phoneNumber ?? '',
      timezone: updated[0].timezone,
      shabbatMode: updated[0].shabbatMode,
      saturdayCheckinTime: updated[0].saturdayCheckinTime ?? null,
    })
  } catch (err) {
    console.error('[settings] PATCH error:', err)
    res.status(500).json({ error: 'Failed to save settings' })
  }
})

export default router
