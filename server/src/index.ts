import express from 'express'
import cors from 'cors'
import chatRouter from './routes/chat.js'

const app = express()
const PORT = process.env.PORT ?? 3001
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? 'http://localhost:5173'

app.use(cors({ origin: ALLOWED_ORIGIN }))
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/api/chat', chatRouter)

app.listen(PORT, () => {
  console.log(`MyNefesh server running on http://localhost:${PORT}`)
})
