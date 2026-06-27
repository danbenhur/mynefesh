import { Router } from 'express'
import { z } from 'zod'
import { and, eq, isNull } from 'drizzle-orm'
import { getDb } from '../db/index.js'
import { allowedEmails } from '../db/schema.js'
import { requireAdmin } from '../auth.js'
import type { AuthUser } from '../auth.js'

const router = Router()

// All admin routes require admin email
router.use(requireAdmin)

// GET /api/admin/invites — list all (including revoked)
router.get('/invites', async (_req, res) => {
  try {
    const db = getDb()
    const rows = await db.select().from(allowedEmails).orderBy(allowedEmails.invitedAt)
    res.json(rows.map(r => ({
      id: r.id,
      email: r.email,
      notes: r.notes,
      invitedAt: r.invitedAt,
      revokedAt: r.revokedAt ?? null,
    })))
  } catch (err) {
    console.error('[admin] GET /invites error:', err)
    res.status(500).json({ error: 'Failed to fetch invites' })
  }
})

const InviteSchema = z.object({
  email: z.string().email(),
  notes: z.string().max(500).optional(),
})

// POST /api/admin/invites — add an email to the allowlist
router.post('/invites', async (req, res) => {
  const parse = InviteSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten() })
    return
  }
  try {
    const db = getDb()
    const user = req.user as AuthUser
    const [row] = await db
      .insert(allowedEmails)
      .values({
        email: parse.data.email.toLowerCase().trim(),
        invitedBy: user.id,
        notes: parse.data.notes ?? null,
      })
      .onConflictDoNothing()
      .returning()

    if (!row) {
      // email already exists — look it up to return current state
      const [existing] = await db
        .select()
        .from(allowedEmails)
        .where(eq(allowedEmails.email, parse.data.email.toLowerCase().trim()))
        .limit(1)
      res.status(200).json({ id: existing.id, email: existing.email, notes: existing.notes, invitedAt: existing.invitedAt, revokedAt: existing.revokedAt ?? null })
      return
    }

    res.status(201).json({ id: row.id, email: row.email, notes: row.notes, invitedAt: row.invitedAt, revokedAt: null })
  } catch (err) {
    console.error('[admin] POST /invites error:', err)
    res.status(500).json({ error: 'Failed to add invite' })
  }
})

// DELETE /api/admin/invites/:id — revoke (soft delete)
router.delete('/invites/:id', async (req, res) => {
  try {
    const db = getDb()
    const [row] = await db
      .update(allowedEmails)
      .set({ revokedAt: new Date() })
      .where(and(eq(allowedEmails.id, req.params.id), isNull(allowedEmails.revokedAt)))
      .returning()

    if (!row) {
      res.status(404).json({ error: 'Invite not found or already revoked' })
      return
    }

    res.json({ ok: true, revokedAt: row.revokedAt })
  } catch (err) {
    console.error('[admin] DELETE /invites/:id error:', err)
    res.status(500).json({ error: 'Failed to revoke invite' })
  }
})

export default router
