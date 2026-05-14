import express from 'express'
import cors from 'cors'
import session from 'express-session'
import passport from 'passport'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { getDb, getPgPool } from './db/index.js'
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
import debugRouter from './routes/debug.js'
import interviewRouter from './routes/interview.js'
import analyticsRouter from './routes/analytics.js'
import { startScheduler } from './lib/scheduler.js'

const app = express()
const PORT = process.env.PORT ?? 3001
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? 'http://localhost:5173'
const isDev = process.env.NODE_ENV === 'development'

const PgStore = pgSessionImport(session)
const pgPool = getPgPool()
const sessionStore = pgPool
  ? new PgStore({ pool: pgPool, tableName: 'user_sessions', createTableIfMissing: true })
  : undefined  // falls back to MemoryStore when DATABASE_URL is absent

if (!pgPool) {
  console.warn('[session] DATABASE_URL not set — using MemoryStore (dev only)')
}

// Required for express-session to set Secure cookies behind Render/any reverse proxy.
// Without this, req.secure is always false (proxy terminates TLS), so Set-Cookie is skipped.
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
      secure: !isDev,        // false only in local dev (NODE_ENV=development)
      sameSite: isDev ? 'lax' : 'none',  // 'none' required for cross-site (Vercel→Render)
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

// Temporary public debug endpoint — remove after diagnostics
app.use('/api/debug', debugRouter)

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

// Run migrations before accepting traffic. Skipped if DATABASE_URL is absent (local dev without DB).
if (process.env.DATABASE_URL) {
  const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), '..', 'drizzle')
  try {
    await migrate(getDb(), { migrationsFolder })
    console.log('Migrations applied')
  } catch (err) {
    console.error('Migration failed — exiting:', err)
    process.exit(1)
  }

  startScheduler()
}

app.listen(PORT, () => {
  console.log(`MyNefesh server running on http://localhost:${PORT}`)
})
