import express from 'express'
import cors from 'cors'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { getDb } from './db/index.js'
import chatRouter from './routes/chat.js'
import umbrellasRouter from './routes/umbrellas.js'
import tasksRouter from './routes/tasks.js'
import healthHistoryRouter from './routes/health-history.js'

const app = express()
const PORT = process.env.PORT ?? 3001
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? 'http://localhost:5173'

app.use(cors({ origin: ALLOWED_ORIGIN }))
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/api/umbrellas', umbrellasRouter)
app.use('/api/tasks', tasksRouter)
app.use('/api/health-history', healthHistoryRouter)
app.use('/api/chat', chatRouter)

// Run migrations before accepting traffic. Skipped if DATABASE_URL is absent (local dev without DB).
// Uses drizzle-orm's programmatic migrator — no drizzle-kit needed at runtime.
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
