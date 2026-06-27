import express from 'express'
import cors from 'cors'
import session from 'express-session'
import passport from 'passport'
import { eq } from 'drizzle-orm'
import { getDb, getPgPool } from './db/index.js'
import { users } from './db/schema.js'
import pgSessionImport from 'connect-pg-simple'
import './auth.js'
import { requireAuth } from './auth.js'
import authRouter from './routes/auth.js'
import chatRouter from './routes/chat.js'
import umbrellasRouter from './routes/umbrellas.js'
import tasksRouter from './routes/tasks.js'
import healthHistoryRouter from './routes/health-history.js'
import webhookRouter from './routes/webhook.js'
import settingsRouter from './routes/settings.js'
import whatsappAdminRouter from './routes/whatsapp-admin.js'
import { umbrellaQuestionsRouter, questionsRouter } from './routes/questions.js'
import sandboxRouter from './routes/sandbox.js'
import interviewRouter from './routes/interview.js'
import analyticsRouter from './routes/analytics.js'
import { umbrellaResolutionsRouter, resolutionsRouter } from './routes/resolutions.js'
import onboardingRouter from './routes/onboarding.js'
import adminRouter from './routes/admin.js'
import type { AuthUser } from './auth.js'

export const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173'

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? 'http://localhost:5173'
const isDev = process.env.NODE_ENV === 'development'

const PgStore = pgSessionImport(session)
const pgPool = getPgPool()
const sessionStore = pgPool
  ? new PgStore({ pool: pgPool, tableName: 'user_sessions', createTableIfMissing: true })
  : undefined // falls back to MemoryStore when DATABASE_URL is absent

if (!pgPool) {
  console.warn('[session] DATABASE_URL not set — using MemoryStore (dev only)')
}

const app = express()

// Required for express-session to set Secure cookies behind Render/any reverse proxy.
app.set('trust proxy', 1)

app.use(cors({ origin: ALLOWED_ORIGIN, credentials: true }))
app.use(express.json())

app.use(
  session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET ?? 'dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: !isDev,                        // false only in local dev (NODE_ENV=development)
      sameSite: isDev ? 'lax' : 'none',     // 'none' required for cross-site (Vercel→Render)
      maxAge: 30 * 24 * 60 * 60 * 1000,
    },
  })
)

app.use(passport.initialize())
app.use(passport.session())

// Public endpoints — no auth required
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})
app.use('/auth', authRouter)

// Twilio webhook — public, form-encoded body, must be before requireAuth
app.use('/webhook', express.urlencoded({ extended: false }), webhookRouter)

// Dev-only: bypass Google OAuth for integration testing
// POST /api/dev/login  body: { email: string }
if (isDev) {
  app.post('/api/dev/login', express.json(), async (req, res) => {
    try {
      const email = String(req.body?.email ?? '').toLowerCase().trim()
      if (!email) { res.status(400).json({ error: 'email required' }); return }

      const db = getDb()
      const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)
      if (!user) { res.status(404).json({ error: 'User not found' }); return }

      const sessionUser: AuthUser = {
        id: user.id,
        google_id: user.googleId ?? '',
        email: user.email,
        name: user.name,
        picture: user.picture ?? null,
      }

      req.login(sessionUser, (err) => {
        if (err) { res.status(500).json({ error: 'Login failed' }); return }
        res.json({ ok: true, userId: user.id })
      })
    } catch (err) {
      console.error('[dev-login]', err)
      res.status(500).json({ error: 'dev-login error' })
    }
  })
}

// All /api/* routes beyond this point require a valid session
app.use('/api', requireAuth)

app.use('/api/umbrellas', umbrellasRouter)
app.use('/api/tasks', tasksRouter)
app.use('/api/health-history', healthHistoryRouter)
app.use('/api/chat', chatRouter)
app.use('/api/settings', settingsRouter)
app.use('/api/whatsapp', whatsappAdminRouter)
app.use('/api/umbrellas', umbrellaQuestionsRouter)
app.use('/api/questions', questionsRouter)
app.use('/api/sandbox', sandboxRouter)
app.use('/api/interview', interviewRouter)
app.use('/api/analytics', analyticsRouter)
app.use('/api/umbrellas', umbrellaResolutionsRouter)
app.use('/api/resolutions', resolutionsRouter)
app.use('/api/onboarding', onboardingRouter)
app.use('/api/admin', adminRouter)

export default app
