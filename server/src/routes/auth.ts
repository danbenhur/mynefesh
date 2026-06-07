import { Router } from 'express'
import passport from 'passport'
import type { AuthUser } from '../auth.js'

const router = Router()

// GET /auth/google — kick off OAuth dance
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }))

// GET /auth/google/callback — Google redirects here after authorization
router.get(
  '/google/callback',
  // session: false so we inspect the profile before committing it to the session
  passport.authenticate('google', { session: false }),
  (req, res) => {
    const profile = req.user as AuthUser
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173'

    const gotEmail = profile.username.toLowerCase()
    const allowedEmail = (process.env.ALLOWED_GOOGLE_EMAIL ?? '').toLowerCase()

    if (!allowedEmail || gotEmail !== allowedEmail) {
      res.redirect(`${frontendUrl}/?auth_error=email-mismatch`)
      return
    }

    req.login(profile, (loginErr) => {
      if (loginErr) {
        console.error('[auth/google/callback] req.login error:', loginErr)
        res.redirect(`${frontendUrl}/?auth_error=login-failed`)
        return
      }

      // Explicitly save the session before redirecting — without this the async
      // Postgres store may not finish writing before the browser follows the redirect,
      // causing /auth/me to see no session on the next request.
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error('[auth/google/callback] session.save error:', saveErr)
          res.redirect(`${frontendUrl}/?auth_error=session-save-failed`)
          return
        }
        res.redirect(frontendUrl)
      })
    })
  }
)

// GET /auth/me — who is logged in?
router.get('/me', (req, res) => {
  if (req.isAuthenticated()) {
    const user = req.user as AuthUser
    res.json({
      authenticated: true,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatar: user.photos?.[0]?.value,
      },
    })
  } else {
    res.json({ authenticated: false })
  }
})

// POST /auth/logout
router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) { res.status(500).json({ error: 'Logout error' }); return }
    req.session.destroy(() => {
      res.json({ ok: true })
    })
  })
})

export default router
