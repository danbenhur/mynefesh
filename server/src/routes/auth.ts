import { Router } from 'express'
import passport from 'passport'
import { eq, and, isNull } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { getDb } from '../db/index.js'
import { users, allowedEmails, userSettings } from '../db/schema.js'
import { isAdminEmail, type AuthUser } from '../auth.js'

const router = Router()

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }))

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false }),
  async (req, res) => {
    const googleProfile = req.user as AuthUser  // shape from Passport strategy
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173'
    try {
      const email = googleProfile.email.toLowerCase().trim()

      // --- Allowlist check ---
      const isAdmin = isAdminEmail(email)
      let isInvited = false
      if (!isAdmin) {
        const db = getDb()
        const [row] = await db
          .select({ id: allowedEmails.id })
          .from(allowedEmails)
          .where(and(eq(allowedEmails.email, email), isNull(allowedEmails.revokedAt)))
          .limit(1)
        isInvited = !!row
      }

      if (!isAdmin && !isInvited) {
        console.warn('[auth] denied login for:', email)
        res.redirect(`${frontendUrl}/?auth_error=access-denied`)
        return
      }

      // --- Find or create user ---
      const db = getDb()
      const [user] = await db
        .insert(users)
        .values({
          id: randomUUID(),
          googleId: googleProfile.google_id,
          email,
          name: googleProfile.name,
          picture: googleProfile.picture,
        })
        .onConflictDoUpdate({
          target: users.email,
          // name + picture update on every login (captures Google profile changes — intentional)
          // email and id are never overwritten
          set: {
            googleId: googleProfile.google_id,
            name: googleProfile.name,
            picture: googleProfile.picture,
          },
        })
        .returning()

      // --- Ensure settings row exists for this user ---
      await db
        .insert(userSettings)
        .values({ userId: user.id })
        .onConflictDoNothing()

      // --- Serialize our UUID into the session (NOT Google's profile ID) ---
      const sessionUser: AuthUser = {
        id: user.id,
        google_id: user.googleId ?? '',
        email: user.email,
        name: user.name,
        picture: user.picture ?? null,
      }

      req.login(sessionUser, (loginErr) => {
        if (loginErr) {
          console.error('[auth/google/callback] req.login error:', loginErr)
          res.redirect(`${frontendUrl}/?auth_error=login-failed`)
          return
        }
        req.session.save((saveErr) => {
          if (saveErr) {
            console.error('[auth/google/callback] session.save error:', saveErr)
            res.redirect(`${frontendUrl}/?auth_error=session-save-failed`)
            return
          }
          res.redirect(frontendUrl)
        })
      })
    } catch (err) {
      console.error('[auth/google/callback] unexpected error:', err)
      res.redirect(`${frontendUrl}/?auth_error=login-failed`)
    }
  }
)

router.get('/me', async (req, res) => {
  if (!req.isAuthenticated()) {
    res.json({ authenticated: false })
    return
  }
  const user = req.user as AuthUser
  const db = getDb()
  let onboarding_completed_at: string | null = null
  try {
    const [userRow] = await db
      .select({ onboardingCompletedAt: users.onboardingCompletedAt })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1)
    onboarding_completed_at = userRow?.onboardingCompletedAt?.toISOString() ?? null
  } catch (err) {
    console.error('[auth/me] DB lookup failed, returning session data only:', err)
  }

  res.json({
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.picture,
      onboarding_completed_at,
      is_admin: isAdminEmail(user.email),
    },
  })
})

router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) { res.status(500).json({ error: 'Logout error' }); return }
    req.session.destroy(() => { res.json({ ok: true }) })
  })
})

export default router
