import { Router } from 'express'
import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { getDb } from '../db/index.js'
import { userSettings, whatsappSession } from '../db/schema.js'
import { invalidateSettingsCache } from '../lib/scheduler.js'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const db = getDb()
    const [row] = await db.select().from(userSettings)
      .where(eq(userSettings.userId, req.user!.id)).limit(1)
    if (!row) {
      res.status(404).json({ error: 'Settings not found' })
      return
    }
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
    .regex(/^\+[1-9]\d{6,14}$/, 'phone must be E.164 format (+972...)')
    .optional()
    .or(z.literal(''))
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
    const db = getDb()
    const patch: Record<string, unknown> = { updatedAt: new Date() }
    if (parsed.data.checkinTime !== undefined) patch.checkinTime = parsed.data.checkinTime
    if (parsed.data.phoneNumber !== undefined) patch.phoneNumber = parsed.data.phoneNumber || null
    if (parsed.data.shabbatMode !== undefined) patch.shabbatMode = parsed.data.shabbatMode
    if (parsed.data.saturdayCheckinTime !== undefined) patch.saturdayCheckinTime = parsed.data.saturdayCheckinTime

    const updated = await db
      .update(userSettings)
      .set(patch)
      .where(eq(userSettings.userId, req.user!.id))
      .returning()

    if (updated.length === 0) {
      res.status(404).json({ error: 'Settings not found' })
      return
    }

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

      const existing = await db
        .select({ state: whatsappSession.state })
        .from(whatsappSession)
        .where(and(eq(whatsappSession.date, today), eq(whatsappSession.userId, req.user!.id)))

      if (existing.length > 0 && existing[0].state === 'snoozed') {
        await db
          .update(whatsappSession)
          .set({ state: 'pending', snoozeCount: 0, lastMessageAt: null, nextSendAt: null })
          .where(and(eq(whatsappSession.date, today), eq(whatsappSession.userId, req.user!.id)))
      }
    }

    invalidateSettingsCache(req.user!.id)

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
