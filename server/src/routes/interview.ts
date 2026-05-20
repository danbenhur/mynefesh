import { Router } from 'express'
import { z } from 'zod'
import { and, desc, eq, gte } from 'drizzle-orm'
import { getDb } from '../db/index.js'
import { interviewSession, questionAnswers, umbrellaQuestions } from '../db/schema.js'
import { composeTodaysQuestions } from '../lib/interview-composer.js'

const router = Router()

function jerusalemDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date)
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

// GET /api/interview/today
router.get('/today', async (_req, res) => {
  try {
    const db = getDb()
    const today = jerusalemDate(new Date())
    const questions = await composeTodaysQuestions(new Date())

    // Get or create today's session
    let rows = await db
      .select()
      .from(interviewSession)
      .where(eq(interviewSession.date, today))

    let session = rows[0]
    if (!session) {
      const inserted = await db
        .insert(interviewSession)
        .values({ date: today, startedAt: new Date() })
        .returning()
      session = inserted[0]
    } else if (!session.startedAt) {
      const updated = await db
        .update(interviewSession)
        .set({ startedAt: new Date() })
        .where(eq(interviewSession.id, session.id))
        .returning()
      session = updated[0]
    }

    res.json({
      questions,
      session: {
        id: session.id,
        date: session.date,
        startedAt: session.startedAt,
        completedAt: session.completedAt,
        currentIndex: session.currentIndex,
      },
    })
  } catch (err) {
    console.error('GET /api/interview/today:', err)
    res.status(500).json({ error: 'Failed to load interview' })
  }
})

const AnswerSchema = z.object({
  questionId: z.string().uuid(),
  answerText: z.string().optional(),
  answerScale: z.number().int().optional(),
  answerBoolean: z.enum(['yes', 'no', 'partial']).optional(),
  answerOptions: z.array(z.string()).optional(),
  comment: z.string().max(2000).nullable().optional(),
}).refine(
  d => d.answerText !== undefined || d.answerScale !== undefined || d.answerBoolean !== undefined || d.answerOptions !== undefined,
  { message: 'At least one answer field required' },
)

// POST /api/interview/answer
router.post('/answer', async (req, res) => {
  const parse = AnswerSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten() })
    return
  }

  try {
    const db = getDb()
    const today = jerusalemDate(new Date())
    const { questionId, answerText, answerScale, answerBoolean, answerOptions, comment } = parse.data

    // Load question to compute normalized value and validate multi_select options
    const [q] = await db
      .select()
      .from(umbrellaQuestions)
      .where(eq(umbrellaQuestions.id, questionId))

    if (!q) {
      res.status(404).json({ error: 'Question not found' })
      return
    }

    // Validate multi_select options
    if (q.answerType === 'multi_select') {
      if (!answerOptions) {
        res.status(400).json({ error: 'answerOptions required for multi_select questions' })
        return
      }
      const validOptions = (q.options as string[] | null) ?? []
      const invalid = answerOptions.filter(o => !validOptions.includes(o))
      if (invalid.length > 0) {
        res.status(400).json({ error: `Invalid options: ${invalid.join(', ')}` })
        return
      }
    }

    let answerNormalized: number | null = null
    if (q.answerType === 'scale' && answerScale !== undefined && q.scaleMin != null && q.scaleMax != null) {
      const range = q.scaleMax - q.scaleMin
      answerNormalized = range > 0 ? (answerScale - q.scaleMin) / range : 0
    } else if (q.answerType === 'boolean') {
      if (answerBoolean === 'yes') answerNormalized = 1
      else if (answerBoolean === 'no') answerNormalized = 0
    } else if (q.answerType === 'boolean_partial') {
      if (answerBoolean === 'yes') answerNormalized = 1
      else if (answerBoolean === 'partial') answerNormalized = 0.5
      else if (answerBoolean === 'no') answerNormalized = 0
    } else if (q.answerType === 'multi_select' && answerOptions) {
      const totalOptions = ((q.options as string[] | null) ?? []).length
      answerNormalized = totalOptions > 0 ? answerOptions.length / totalOptions : 0
    }

    // Upsert answer (one answer per question per interview date)
    const existing = await db
      .select()
      .from(questionAnswers)
      .where(and(eq(questionAnswers.questionId, questionId), eq(questionAnswers.interviewDate, today)))

    let answer
    if (existing[0]) {
      const updated = await db
        .update(questionAnswers)
        .set({ answerText, answerScale, answerBoolean, answerOptions, answerNormalized, comment: comment ?? null })
        .where(eq(questionAnswers.id, existing[0].id))
        .returning()
      answer = updated[0]
    } else {
      const inserted = await db
        .insert(questionAnswers)
        .values({ questionId, interviewDate: today, answerText, answerScale, answerBoolean, answerOptions, answerNormalized, comment: comment ?? null })
        .returning()
      answer = inserted[0]
    }

    // Advance session index
    const sessionRows = await db
      .select()
      .from(interviewSession)
      .where(eq(interviewSession.date, today))

    if (sessionRows[0]) {
      await db
        .update(interviewSession)
        .set({ currentIndex: sessionRows[0].currentIndex + 1 })
        .where(eq(interviewSession.id, sessionRows[0].id))
    }

    res.status(201).json({
      id: answer.id,
      questionId: answer.questionId,
      interviewDate: answer.interviewDate,
      answerNormalized: answer.answerNormalized,
    })
  } catch (err) {
    console.error('POST /api/interview/answer:', err)
    res.status(500).json({ error: 'Failed to save answer' })
  }
})

// POST /api/interview/complete
router.post('/complete', async (_req, res) => {
  try {
    const db = getDb()
    const today = jerusalemDate(new Date())

    const rows = await db
      .select()
      .from(interviewSession)
      .where(eq(interviewSession.date, today))

    if (!rows[0]) {
      res.status(404).json({ error: 'No session for today' })
      return
    }

    const [updated] = await db
      .update(interviewSession)
      .set({ completedAt: new Date() })
      .where(eq(interviewSession.id, rows[0].id))
      .returning()

    res.json({
      id: updated.id,
      date: updated.date,
      completedAt: updated.completedAt,
    })
  } catch (err) {
    console.error('POST /api/interview/complete:', err)
    res.status(500).json({ error: 'Failed to complete session' })
  }
})

// GET /api/interview/history?days=30
router.get('/history', async (req, res) => {
  try {
    const db = getDb()
    const days = Math.min(parseInt(String(req.query.days ?? '30'), 10) || 30, 365)
    const since = new Date()
    since.setDate(since.getDate() - days)
    const sinceStr = since.toISOString().slice(0, 10)

    const sessions = await db
      .select()
      .from(interviewSession)
      .where(gte(interviewSession.date, sinceStr))
      .orderBy(desc(interviewSession.date))

    const answers = await db
      .select()
      .from(questionAnswers)
      .where(gte(questionAnswers.interviewDate, sinceStr))
      .orderBy(desc(questionAnswers.interviewDate))

    res.json({
      sessions: sessions.map(s => ({
        id: s.id,
        date: s.date,
        startedAt: s.startedAt,
        completedAt: s.completedAt,
        currentIndex: s.currentIndex,
      })),
      answers: answers.map(a => ({
        id: a.id,
        questionId: a.questionId,
        interviewDate: a.interviewDate,
        answerText: a.answerText,
        answerScale: a.answerScale,
        answerBoolean: a.answerBoolean,
        answerOptions: a.answerOptions,
        answerNormalized: a.answerNormalized,
        comment: a.comment,
      })),
    })
  } catch (err) {
    console.error('GET /api/interview/history:', err)
    res.status(500).json({ error: 'Failed to fetch history' })
  }
})

export default router
