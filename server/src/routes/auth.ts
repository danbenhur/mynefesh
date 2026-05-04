import { Router } from 'express'
import passport from 'passport'
import type { GithubUser } from '../auth.js'

const router = Router()

// GET /auth/github — kick off OAuth dance
router.get('/github', passport.authenticate('github', { scope: ['user:email'] }))

// GET /auth/github/callback — GitHub redirects here after authorization
router.get(
  '/github/callback',
  // session: false so we inspect the profile before committing it to the session
  passport.authenticate('github', { session: false }),
  (req, res) => {
    const profile = req.user as GithubUser

    if (profile.id !== process.env.ALLOWED_GITHUB_ID) {
      res.status(403).send('Access denied: not the authorized user')
      return
    }

    req.login(profile, (err) => {
      if (err) {
        res.status(500).json({ error: 'Session error' })
        return
      }
      res.redirect(process.env.FRONTEND_URL ?? 'http://localhost:5173')
    })
  }
)

// GET /auth/me — who is logged in?
router.get('/me', (req, res) => {
  if (req.isAuthenticated()) {
    const user = req.user as GithubUser
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
