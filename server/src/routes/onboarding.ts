import { Router } from 'express'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { getDb } from '../db/index.js'
import { users, umbrellas } from '../db/schema.js'

const router = Router()

const CompleteSchema = z.object({
  umbrellas: z.array(z.object({
    name: z.string().min(1).max(100),
    icon: z.string().max(10).default(''),
  })).min(1).max(10),
})

// POST /api/onboarding/complete
// Sets onboarding_completed_at and seeds the user's starter umbrellas.
// Idempotent: if called again, re-seeds (does NOT duplicate; umbrellas are purely additive).
router.post('/complete', async (req, res) => {
  const parse = CompleteSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten() })
    return
  }

  try {
    const db = getDb()
    const userId = req.user!.id

    // Seed umbrellas first (additive — OK to call again)
    if (parse.data.umbrellas.length > 0) {
      await db.insert(umbrellas).values(
        parse.data.umbrellas.map((u, i) => ({
          name: u.name,
          icon: u.icon,
          userId,
          position: i,
        }))
      )
    }

    // Mark onboarding complete
    await db
      .update(users)
      .set({ onboardingCompletedAt: new Date() })
      .where(eq(users.id, userId))

    res.json({ ok: true })
  } catch (err) {
    console.error('[onboarding] POST /complete error:', err)
    res.status(500).json({ error: 'Failed to complete onboarding' })
  }
})

export default router
