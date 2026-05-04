import express from 'express'
import cors from 'cors'
import session from 'express-session'
import passport from 'passport'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { getDb } from './db/index.js'
import './auth.js'
import { requireAuth } from './auth.js'
import authRouter from './routes/auth.js'
import chatRouter from './routes/chat.js'
import umbrellasRouter from './routes/umbrellas.js'
import tasksRouter from './routes/tasks.js'
import healthHistoryRouter from './routes/health-history.js'

const app = express()
const PORT = process.env.PORT ?? 3001
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? 'http://localhost:5173'
const isProd = process.env.NODE_ENV === 'production'

app.use(cors({ origin: ALLOWED_ORIGIN, credentials: true }))
app.use(express.json())

app.use(
  session({
    secret: process.env.SESSION_SECRET ?? 'dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
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

// All /api/* routes beyond this point require a valid session
app.use('/api', requireAuth)

app.use('/api/umbrellas', umbrellasRouter)
app.use('/api/tasks', tasksRouter)
app.use('/api/health-history', healthHistoryRouter)
app.use('/api/chat', chatRouter)

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
}

app.listen(PORT, () => {
  console.log(`MyNefesh server running on http://localhost:${PORT}`)
})
