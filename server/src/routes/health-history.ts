import { Router } from 'express'
import { z } from 'zod'
import { eq, and, gte, desc } from 'drizzle-orm'
import { getDb } from '../db/index.js'
import { healthHistory } from '../db/schema.js'

const router = Router()

// GET /api/health-history?umbrella=:id&days=30
router.get('/', async (req, res) => {
  const umbrellaId = req.query.umbrella as string | undefined
  if (!umbrellaId) {
    res.status(400).json({ error: 'umbrella query param required' })
    return
  }
  const days = Math.max(1, parseInt(req.query.days as string) || 30)
  const since = new Date()
  since.setDate(since.getDate() - days)
  try {
    const db = getDb()
    const rows = await db.select()
      .from(healthHistory)
      .where(and(
        eq(healthHistory.userId, req.user!.id),
        eq(healthHistory.umbrellaId, umbrellaId),
        gte(healthHistory.recordedAt, since),
      ))
      .orderBy(desc(healthHistory.recordedAt))
    res.json(rows.map(h => ({
      date: h.recordedAt.toISOString().split('T')[0],
      score: h.score,
    })))
  } catch (err) {
    console.error('GET /health-history:', err)
    res.status(500).json({ error: 'Failed to fetch health history' })
  }
})

const CreateSchema = z.object({
  umbrellaId: z.string().uuid(),
  score: z.number().int().min(0).max(100),
  recordedAt: z.string().optional(),
})

// POST /api/health-history
router.post('/', async (req, res) => {
  const parse = CreateSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten() })
    return
  }
  try {
    const db = getDb()
    const [row] = await db.insert(healthHistory).values({
      userId: req.user!.id,
      umbrellaId: parse.data.umbrellaId,
      score: parse.data.score,
      recordedAt: parse.data.recordedAt ? new Date(parse.data.recordedAt) : new Date(),
    }).returning()
    res.status(201).json({
      date: row.recordedAt.toISOString().split('T')[0],
      score: row.score,
    })
  } catch (err) {
    console.error('POST /health-history:', err)
    res.status(500).json({ error: 'Failed to record health score' })
  }
})

export default router
