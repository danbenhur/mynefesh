import { Router } from 'express'
import { z } from 'zod'
import { and, desc, eq, gte, ne } from 'drizzle-orm'
import { getDb } from '../db/index.js'
import { interviewSession, questionAnswers, umbrellaQuestions, whatsappSession } from '../db/schema.js'
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

function jerusalemHHMM(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(date)
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? ''
  return `${get('hour')}:${get('minute')}`
}

function yesterdayStr(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`)
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

// Returns the effective interview date for the current request.
// Grace window: if Jerusalem time is before 06:00 and the most recent open
// whatsapp_session is from yesterday, bind the interview to that session's date.
// This ensures a check-in answered at e.g. 00:30 is recorded for the previous day.
async function getEffectiveInterviewDate(userId: string): Promise<string> {
  const now = new Date()
  const today = jerusalemDate(now)

  if (jerusalemHHMM(now) < '06:00') {
    const db = getDb()
    const openSessions = await db
      .select({ date: whatsappSession.date })
      .from(whatsappSession)
      .where(and(
        eq(whatsappSession.userId, userId),
        ne(whatsappSession.state, 'completed'),
        ne(whatsappSession.state, 'final_sent'),
      ))
      .orderBy(desc(whatsappSession.date))
      .limit(1)

    if (openSessions.length > 0 && String(openSessions[0].date) === yesterdayStr(today)) {
      return yesterdayStr(today)
    }
  }

  return today
}

// GET /api/interview/today
router.get('/today', async (req, res) => {
  try {
    const db = getDb()
    const today = await getEffectiveInterviewDate(req.user!.id)
    const questions = await composeTodaysQuestions(new Date(`${today}T12:00:00Z`), req.user!.id)

    // Get or create today's session (scoped to this user)
    let rows = await db
      .select()
      .from(interviewSession)
      .where(and(eq(interviewSession.date, today), eq(interviewSession.userId, req.user!.id)))

    let session = rows[0]
    if (!session) {
      const inserted = await db
        .insert(interviewSession)
        .values({ date: today, startedAt: new Date(), userId: req.user!.id })
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
    const today = await getEffectiveInterviewDate(req.user!.id)
    const { questionId, answerText, answerScale, answerBoolean, answerOptions, comment } = parse.data

    // Load question to compute normalized value and validate multi_select options
    // Also verifies the question belongs to this user
    const [q] = await db
      .select()
      .from(umbrellaQuestions)
      .where(and(eq(umbrellaQuestions.id, questionId), eq(umbrellaQuestions.userId, req.user!.id)))

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
    if (q.answerType === 'scale' && answerScale !== undefined) {
      // Fall back to 1-5 (same defaults the UI uses) when scale bounds aren't set on the question
      const min = q.scaleMin ?? 1
      const max = q.scaleMax ?? 5
      const range = max - min
      answerNormalized = range > 0 ? (answerScale - min) / range : 0
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
      .where(and(
        eq(questionAnswers.questionId, questionId),
        eq(questionAnswers.interviewDate, today),
        eq(questionAnswers.userId, req.user!.id),
      ))

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
        .values({ questionId, interviewDate: today, answerText, answerScale, answerBoolean, answerOptions, answerNormalized, comment: comment ?? null, userId: req.user!.id })
        .returning()
      answer = inserted[0]
    }

    // Advance session index (scoped to this user)
    const sessionRows = await db
      .select()
      .from(interviewSession)
      .where(and(eq(interviewSession.date, today), eq(interviewSession.userId, req.user!.id)))

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
router.post('/complete', async (req, res) => {
  try {
    const db = getDb()
    const today = await getEffectiveInterviewDate(req.user!.id)

    const rows = await db
      .select()
      .from(interviewSession)
      .where(and(eq(interviewSession.date, today), eq(interviewSession.userId, req.user!.id)))

    if (!rows[0]) {
      res.status(404).json({ error: 'No session for today' })
      return
    }

    const [updated] = await db
      .update(interviewSession)
      .set({ completedAt: new Date() })
      .where(and(eq(interviewSession.id, rows[0].id), eq(interviewSession.userId, req.user!.id)))
      .returning()

    // Keep whatsapp_session in sync so morning-skip logic has a consistent view
    const wsRows = await db
      .select()
      .from(whatsappSession)
      .where(and(eq(whatsappSession.date, today), eq(whatsappSession.userId, req.user!.id)))
    if (wsRows[0] && (wsRows[0].state === 'pending' || wsRows[0].state === 'snoozed')) {
      await db
        .update(whatsappSession)
        .set({ state: 'completed' })
        .where(and(eq(whatsappSession.id, wsRows[0].id), eq(whatsappSession.userId, req.user!.id)))
    }

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
      .where(and(gte(interviewSession.date, sinceStr), eq(interviewSession.userId, req.user!.id)))
      .orderBy(desc(interviewSession.date))

    const answers = await db
      .select()
      .from(questionAnswers)
      .where(and(gte(questionAnswers.interviewDate, sinceStr), eq(questionAnswers.userId, req.user!.id)))
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
