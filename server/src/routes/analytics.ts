import { Router } from 'express'
import { and, eq, gte } from 'drizzle-orm'
import {
  getAllUmbrellaHealthScores,
  getUmbrellaDailyTrend,
  getQuestionDailyTrend,
} from '../lib/analytics.js'
import {
  getCombo,
  getStacked,
  getByQuestion,
  getGoals,
} from '../lib/timeseries.js'
import type { Granularity } from '../lib/timeseries.js'
import { getDb } from '../db/index.js'
import { questionAnswers, umbrellaQuestions } from '../db/schema.js'

const router = Router()

// GET /api/analytics/umbrellas/health?days=14
router.get('/umbrellas/health', async (req, res) => {
  try {
    const days = Math.min(parseInt(String(req.query.days ?? '14'), 10) || 14, 365)
    const scores = await getAllUmbrellaHealthScores(days)
    res.json(scores)
  } catch (err) {
    console.error('GET /api/analytics/umbrellas/health:', err)
    res.status(500).json({ error: 'Failed to compute health scores' })
  }
})

// GET /api/analytics/umbrellas/:id/trend?days=42
router.get('/umbrellas/:id/trend', async (req, res) => {
  try {
    const days = Math.min(parseInt(String(req.query.days ?? '42'), 10) || 42, 365)
    const trend = await getUmbrellaDailyTrend(req.params.id, days)
    res.json(trend)
  } catch (err) {
    console.error('GET /api/analytics/umbrellas/:id/trend:', err)
    res.status(500).json({ error: 'Failed to compute trend' })
  }
})

// GET /api/analytics/questions/:id/trend?days=90
router.get('/questions/:id/trend', async (req, res) => {
  try {
    const days = Math.min(parseInt(String(req.query.days ?? '90'), 10) || 90, 365)
    const trend = await getQuestionDailyTrend(req.params.id, days)
    res.json(trend)
  } catch (err) {
    console.error('GET /api/analytics/questions/:id/trend:', err)
    res.status(500).json({ error: 'Failed to compute question trend' })
  }
})

// GET /api/analytics/questions/:id/multi-trend?days=90
// Returns per-option total selection counts for a multi_select question.
router.get('/questions/:id/multi-trend', async (req, res) => {
  try {
    const db = getDb()
    const days = Math.min(parseInt(String(req.query.days ?? '90'), 10) || 90, 365)
    const since = new Date()
    since.setDate(since.getDate() - days)
    const sinceStr = since.toISOString().slice(0, 10)

    const [q] = await db
      .select({ options: umbrellaQuestions.options })
      .from(umbrellaQuestions)
      .where(eq(umbrellaQuestions.id, req.params.id))

    if (!q) { res.status(404).json({ error: 'Question not found' }); return }

    const options = (q.options as string[] | null) ?? []
    if (options.length === 0) { res.json([]); return }

    const rows = await db
      .select({ answerOptions: questionAnswers.answerOptions })
      .from(questionAnswers)
      .where(and(
        eq(questionAnswers.questionId, req.params.id),
        gte(questionAnswers.interviewDate, sinceStr),
      ))

    const counts: Record<string, number> = {}
    for (const row of rows) {
      if (!row.answerOptions) continue
      for (const opt of row.answerOptions) {
        counts[opt] = (counts[opt] ?? 0) + 1
      }
    }

    res.json(options.map(option => ({ option, total: counts[option] ?? 0 })))
  } catch (err) {
    console.error('GET /api/analytics/questions/:id/multi-trend:', err)
    res.status(500).json({ error: 'Failed to compute multi-select trend' })
  }
})

// GET /api/analytics/timeseries?slice=combo|stacked|question|goal|movingavg&granularity=day|week|month|year
// Auth required (handled by middleware in index.ts for all /api/analytics routes).
// movingavg returns the same data as combo — the client applies the moving-average smoothing on the line.
router.get('/timeseries', async (req, res) => {
  try {
    const slice       = String(req.query.slice ?? 'combo')
    const granularity = String(req.query.granularity ?? 'week') as Granularity

    const VALID_SLICES = ['combo', 'stacked', 'question', 'goal', 'movingavg']
    const VALID_GRANS  = ['day', 'week', 'month', 'year']

    if (!VALID_SLICES.includes(slice) || !VALID_GRANS.includes(granularity)) {
      res.status(400).json({ error: 'Invalid slice or granularity' })
      return
    }

    let data
    switch (slice) {
      case 'stacked':              data = await getStacked(granularity); break
      case 'question':             data = await getByQuestion();         break
      case 'goal':                 data = await getGoals();              break
      default: /* combo + movingavg */ data = await getCombo(granularity); break
    }

    res.json(data)
  } catch (err) {
    console.error('GET /api/analytics/timeseries:', err)
    res.status(500).json({ error: 'Failed to compute timeseries' })
  }
})

export default router
