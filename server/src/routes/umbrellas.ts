import { Router } from 'express'
import { z } from 'zod'
import { and, eq, isNull } from 'drizzle-orm'
import { getDb } from '../db/index.js'
import { umbrellas, tasks, reminders, healthHistory } from '../db/schema.js'
import { getAllUmbrellaHealthScores } from '../lib/analytics.js'

const router = Router()

type UmbrellaRow = typeof umbrellas.$inferSelect
type TaskRow = typeof tasks.$inferSelect
type ReminderRow = typeof reminders.$inferSelect
type HistoryRow = typeof healthHistory.$inferSelect

function taskShape(t: TaskRow) {
  return {
    id: t.id,
    umbrellaId: t.umbrellaId,
    title: t.title,
    status: t.status,
    priority: t.priority,
    dueDate: t.dueAt ? t.dueAt.toISOString().split('T')[0] : undefined,
    position: t.position,
  }
}

function reminderShape(r: ReminderRow) {
  return {
    id: r.id,
    umbrellaId: r.umbrellaId,
    message: r.message,
    triggerDate: r.triggerAt.toISOString().split('T')[0],
    isRecurring: r.isRecurring,
  }
}

function historyShape(h: HistoryRow) {
  return {
    date: h.recordedAt.toISOString().split('T')[0],
    score: h.score,
  }
}

function umbrellaShape(
  u: UmbrellaRow,
  uTasks: TaskRow[],
  uReminders: ReminderRow[],
  uHistory: HistoryRow[],
  computedHealthScore: number | null = null,
) {
  return {
    id: u.id,
    name: u.name,
    icon: u.icon,
    parentId: u.parentId,
    // deprecated: prefer computedHealthScore (derived from interview answers)
    healthScore: u.healthScore,
    computedHealthScore,
    notes: u.notes,
    position: u.position,
    archivedAt: u.archivedAt ? u.archivedAt.toISOString() : null,
    updatedAt: u.updatedAt.toISOString(),
    tasks: uTasks.map(taskShape),
    reminders: uReminders.map(reminderShape),
    history: uHistory.map(historyShape),
    children: [], // client assembles tree from parentId
  }
}

// GET /api/umbrellas — flat list; client builds tree from parentId
// ?include=archived returns all including archived; default excludes archived
router.get('/', async (req, res) => {
  try {
    const db = getDb()
    const includeArchived = req.query.include === 'archived'

    const userId = req.user!.id
    const [allUmbrellas, allTasks, allReminders, allHistory, healthScores] = await Promise.all([
      includeArchived
        ? db.select().from(umbrellas).where(eq(umbrellas.userId, userId))
        : db.select().from(umbrellas).where(and(isNull(umbrellas.archivedAt), eq(umbrellas.userId, userId))),
      db.select().from(tasks).where(eq(tasks.userId, userId)),
      db.select().from(reminders).where(eq(reminders.userId, userId)),
      db.select().from(healthHistory).where(eq(healthHistory.userId, userId)),
      getAllUmbrellaHealthScores(14, userId),
    ])
    const result = allUmbrellas
      .sort((a, b) => a.position - b.position)
      .map(u => umbrellaShape(
        u,
        allTasks.filter(t => t.umbrellaId === u.id),
        allReminders.filter(r => r.umbrellaId === u.id),
        allHistory.filter(h => h.umbrellaId === u.id),
        healthScores[u.id] ?? null,
      ))
    res.json(result)
  } catch (err) {
    console.error('GET /umbrellas:', err)
    res.status(500).json({ error: 'Failed to fetch umbrellas' })
  }
})

const CreateSchema = z.object({
  name: z.string().min(1),
  icon: z.string().default(''),
  parentId: z.string().uuid().nullable().optional(),
  healthScore: z.number().int().min(0).max(100).default(50),
  notes: z.array(z.string()).default([]),
  position: z.number().int().default(0),
})

// POST /api/umbrellas
router.post('/', async (req, res) => {
  const parse = CreateSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten() })
    return
  }
  try {
    const db = getDb()
    const [row] = await db.insert(umbrellas).values({ ...parse.data, userId: req.user!.id }).returning()
    res.status(201).json(umbrellaShape(row, [], [], [], null))
  } catch (err) {
    console.error('POST /umbrellas:', err)
    res.status(500).json({ error: 'Failed to create umbrella' })
  }
})

const PatchSchema = z.object({
  name: z.string().min(1).optional(),
  icon: z.string().optional(),
  parentId: z.string().uuid().nullable().optional(),
  healthScore: z.number().int().min(0).max(100).optional(),
  notes: z.array(z.string()).optional(),
  position: z.number().int().optional(),
  archivedAt: z.string().datetime().nullable().optional(),
}).strict()

// PATCH /api/umbrellas/:id
router.patch('/:id', async (req, res) => {
  const parse = PatchSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten() })
    return
  }
  if (Object.keys(parse.data).length === 0) {
    res.status(400).json({ error: 'No fields to update' })
    return
  }
  try {
    const db = getDb()
    const umbrellaId = req.params.id

    // Ownership check
    const [owned] = await db.select({ id: umbrellas.id })
      .from(umbrellas)
      .where(and(eq(umbrellas.id, umbrellaId), eq(umbrellas.userId, req.user!.id)))
      .limit(1)
    if (!owned) { res.status(404).json({ error: 'Umbrella not found' }); return }

    if (parse.data.parentId) {
      const newParentId = parse.data.parentId
      // umbrellaId already declared above

      const allRows = await db.select({ id: umbrellas.id, parentId: umbrellas.parentId }).from(umbrellas)
      const parentMap = new Map<string, string | null>()
      for (const r of allRows) parentMap.set(r.id, r.parentId ?? null)

      // cycle check: walk up from new parent — if we reach this umbrella it's a cycle
      let cursor: string | null = newParentId
      while (cursor !== null) {
        if (cursor === umbrellaId) {
          res.status(400).json({ error: 'Cannot move umbrella under its own descendant' })
          return
        }
        cursor = parentMap.get(cursor) ?? null
      }

      // depth check: umbrella lands at depth = (depth of new parent) + 1
      let depth = 1
      cursor = newParentId
      while (cursor !== null) {
        depth++
        cursor = parentMap.get(cursor) ?? null
      }
      if (depth > 5) {
        res.status(400).json({ error: 'Maximum hierarchy depth exceeded' })
        return
      }
    }

    const { archivedAt, ...rest } = parse.data
    const updates: Record<string, unknown> = { ...rest, updatedAt: new Date() }
    if (archivedAt !== undefined) {
      updates.archivedAt = archivedAt ? new Date(archivedAt) : null
    }

    const [row] = await db.update(umbrellas)
      .set(updates)
      .where(and(eq(umbrellas.id, umbrellaId), eq(umbrellas.userId, req.user!.id)))
      .returning()
    if (!row) { res.status(404).json({ error: 'Umbrella not found' }); return }
    res.json(umbrellaShape(row, [], [], []))
  } catch (err) {
    console.error('PATCH /umbrellas/:id:', err)
    res.status(500).json({ error: 'Failed to update umbrella' })
  }
})

// DELETE /api/umbrellas/:id — cascade removes all child data via FK
router.delete('/:id', async (req, res) => {
  try {
    const db = getDb()
    // Ownership check: returns 404 whether the row doesn't exist or belongs to another user
    const [owned] = await db.select({ id: umbrellas.id })
      .from(umbrellas)
      .where(and(eq(umbrellas.id, req.params.id), eq(umbrellas.userId, req.user!.id)))
      .limit(1)
    if (!owned) { res.status(404).json({ error: 'Umbrella not found' }); return }

    const [row] = await db.delete(umbrellas)
      .where(and(eq(umbrellas.id, req.params.id), eq(umbrellas.userId, req.user!.id)))
      .returning()
    if (!row) { res.status(404).json({ error: 'Umbrella not found' }); return }
    res.status(204).end()
  } catch (err) {
    console.error('DELETE /umbrellas/:id:', err)
    res.status(500).json({ error: 'Failed to delete umbrella' })
  }
})

export default router
