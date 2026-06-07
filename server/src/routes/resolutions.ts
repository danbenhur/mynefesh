import { Router } from 'express'
import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { getDb } from '../db/index.js'
import { resolutions, umbrellaQuestions } from '../db/schema.js'
import { computeResolutionProgress, todayJerusalem } from '../lib/resolutions.js'

type ResRow = typeof resolutions.$inferSelect

function resShape(r: ResRow, progress?: Awaited<ReturnType<typeof computeResolutionProgress>> | null) {
  return {
    id: r.id,
    umbrellaId: r.umbrellaId,
    questionId: r.questionId,
    title: r.title,
    startDate: r.startDate,
    endDate: r.endDate,
    successThreshold: r.successThreshold,
    status: r.status,
    finalScore: r.finalScore,
    createdAt: r.createdAt,
    progress: progress ?? null,
  }
}

async function loadQuestionType(questionId: string): Promise<string | null> {
  const db = getDb()
  const [q] = await db
    .select({ answerType: umbrellaQuestions.answerType })
    .from(umbrellaQuestions)
    .where(eq(umbrellaQuestions.id, questionId))
  return q?.answerType ?? null
}

// Mounted at /api/umbrellas — handles GET /:umbrellaId/resolutions
export const umbrellaResolutionsRouter = Router()

umbrellaResolutionsRouter.get('/:umbrellaId/resolutions', async (req, res) => {
  try {
    const db = getDb()
    const rows = await db
      .select()
      .from(resolutions)
      .where(eq(resolutions.umbrellaId, req.params.umbrellaId))

    // Load question types in one batch query
    const questionIds = [...new Set(rows.map(r => r.questionId))]
    const questions = await Promise.all(
      questionIds.map(id => db
        .select({ id: umbrellaQuestions.id, answerType: umbrellaQuestions.answerType })
        .from(umbrellaQuestions)
        .where(eq(umbrellaQuestions.id, id))
        .then(qs => qs[0])
      )
    )
    const typeMap: Record<string, string> = {}
    for (const q of questions) {
      if (q) typeMap[q.id] = q.answerType
    }

    const results = await Promise.all(rows.map(async r => {
      if (r.status !== 'active') return resShape(r)
      const qType = typeMap[r.questionId] ?? 'boolean'
      const progress = await computeResolutionProgress(
        { questionId: r.questionId, startDate: String(r.startDate), endDate: String(r.endDate), successThreshold: r.successThreshold },
        qType,
      )
      return resShape(r, progress)
    }))

    res.json(results)
  } catch (err) {
    console.error('GET /umbrellas/:id/resolutions:', err)
    res.status(500).json({ error: 'Failed to fetch resolutions' })
  }
})

// Mounted at /api/resolutions — handles POST, PATCH/:id, GET/:id/progress
export const resolutionsRouter = Router()

const CreateSchema = z.object({
  umbrellaId: z.string().uuid(),
  questionId: z.string().uuid().optional(),
  newQuestion: z.object({
    text: z.string().min(1),
    answerType: z.enum(['boolean', 'boolean_partial', 'scale']),
    scaleMin: z.number().int().optional(),
    scaleMax: z.number().int().optional(),
  }).optional(),
  title: z.string().min(1),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  successThreshold: z.number().int().positive().nullable().optional(),
}).refine(
  d => d.questionId !== undefined || d.newQuestion !== undefined,
  { message: 'Either questionId or newQuestion is required' },
).refine(
  d => d.startDate < d.endDate,
  { message: 'startDate must be before endDate' },
)

resolutionsRouter.post('/', async (req, res) => {
  const parse = CreateSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten() })
    return
  }

  let step = 'init'
  let savedResolutionId: string | null = null

  try {
    const db = getDb()
    const { umbrellaId, questionId: bodyQuestionId, newQuestion, title, startDate, endDate, successThreshold } = parse.data

    let questionId = bodyQuestionId!
    let questionAnswerType: string

    step = 'question'
    if (newQuestion) {
      const qRows = await db
        .insert(umbrellaQuestions)
        .values({
          umbrellaId,
          text: newQuestion.text,
          cadence: 'daily',
          answerType: newQuestion.answerType,
          scaleMin: newQuestion.answerType === 'scale' ? (newQuestion.scaleMin ?? 1) : null,
          scaleMax: newQuestion.answerType === 'scale' ? (newQuestion.scaleMax ?? 10) : null,
          enabled: true,
        })
        .returning()
      const q = qRows[0]
      if (!q) throw new Error('umbrellaQuestions INSERT returned empty RETURNING')
      questionId = q.id
      questionAnswerType = q.answerType
      console.log('[POST /resolutions] step=question-insert ok questionId=%s', questionId)
    } else {
      const qType = await loadQuestionType(questionId)
      if (!qType) {
        res.status(404).json({ error: 'Question not found' })
        return
      }
      questionAnswerType = qType
      console.log('[POST /resolutions] step=question-lookup ok questionId=%s type=%s', questionId, questionAnswerType)
    }

    if (questionAnswerType === 'scale' && successThreshold == null) {
      res.status(400).json({ error: 'successThreshold is required for scale questions' })
      return
    }
    if (questionAnswerType !== 'scale' && successThreshold != null) {
      res.status(400).json({ error: 'successThreshold is only valid for scale questions' })
      return
    }

    step = 'resolution-insert'
    const resRows = await db
      .insert(resolutions)
      .values({ umbrellaId, questionId, title, startDate, endDate, successThreshold: successThreshold ?? null })
      .returning()
    const row = resRows[0]
    if (!row) throw new Error('resolutions INSERT returned empty RETURNING — data may be committed; refresh to verify')
    savedResolutionId = row.id
    console.log('[POST /resolutions] step=resolution-insert ok id=%s', row.id)

    step = 'serialize'
    res.status(201).json(resShape(row))
  } catch (err) {
    const errStr = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    console.error(`[POST /resolutions] step=${step} savedResolutionId=${savedResolutionId} FAILED:`, err)
    if (step === 'serialize' && savedResolutionId) {
      // Resolution IS committed — 500 would mislead the client into thinking it failed
      res.status(500).json({ error: `serialize-error (resolution ${savedResolutionId} was saved — refresh to see it): ${errStr}` })
    } else {
      res.status(500).json({ error: `step=${step}: ${errStr}` })
    }
  }
})

const PatchSchema = z.object({
  title: z.string().min(1).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(['abandoned']).optional(),
}).strict()

resolutionsRouter.patch('/:id', async (req, res) => {
  const parse = PatchSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten() })
    return
  }
  try {
    const db = getDb()
    const [existing] = await db
      .select()
      .from(resolutions)
      .where(eq(resolutions.id, req.params.id))

    if (!existing) {
      res.status(404).json({ error: 'Resolution not found' })
      return
    }

    const updates: Partial<typeof resolutions.$inferInsert & { updatedAt: Date }> = { updatedAt: new Date() }
    if (parse.data.title) updates.title = parse.data.title
    if (parse.data.endDate) updates.endDate = parse.data.endDate

    if (parse.data.status === 'abandoned') {
      if (existing.status !== 'active') {
        res.status(400).json({ error: 'Only active resolutions can be abandoned' })
        return
      }
      const qType = await loadQuestionType(existing.questionId)
      const progress = await computeResolutionProgress(
        { questionId: existing.questionId, startDate: String(existing.startDate), endDate: String(existing.endDate), successThreshold: existing.successThreshold },
        qType ?? 'boolean',
      )
      updates.status = 'abandoned'
      updates.finalScore = progress.percentage
    }

    const [row] = await db
      .update(resolutions)
      .set(updates)
      .where(eq(resolutions.id, req.params.id))
      .returning()

    res.json(resShape(row))
  } catch (err) {
    console.error('PATCH /resolutions/:id:', err)
    res.status(500).json({ error: 'Failed to update resolution' })
  }
})

resolutionsRouter.get('/:id/progress', async (req, res) => {
  try {
    const db = getDb()
    const [r] = await db
      .select()
      .from(resolutions)
      .where(eq(resolutions.id, req.params.id))

    if (!r) {
      res.status(404).json({ error: 'Resolution not found' })
      return
    }

    const qType = await loadQuestionType(r.questionId)
    const progress = await computeResolutionProgress(
      { questionId: r.questionId, startDate: String(r.startDate), endDate: String(r.endDate), successThreshold: r.successThreshold },
      qType ?? 'boolean',
    )
    res.json(progress)
  } catch (err) {
    console.error('GET /resolutions/:id/progress:', err)
    res.status(500).json({ error: 'Failed to compute progress' })
  }
})
