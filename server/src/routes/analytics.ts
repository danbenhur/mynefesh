import { Router } from 'express'
import {
  getAllUmbrellaHealthScores,
  getUmbrellaDailyTrend,
  getQuestionDailyTrend,
} from '../lib/analytics.js'

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

export default router
