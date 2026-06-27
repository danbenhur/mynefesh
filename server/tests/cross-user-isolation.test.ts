import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import app from '../src/app.js'
import { getTestDb, seedUser, cleanupUsers } from './helpers/db.js'
import { loginAs } from './helpers/session.js'
import { umbrellas, tasks, umbrellaQuestions } from '../src/db/schema.js'
import { eq } from 'drizzle-orm'

const EMAIL_A = 'isolation-test-user-a@example.com'
const EMAIL_B = 'isolation-test-user-b@example.com'

let userA: Awaited<ReturnType<typeof seedUser>>
let userB: Awaited<ReturnType<typeof seedUser>>
let cookieA: string
let cookieB: string
let umbrellaAId: string
let umbrellaBId: string

beforeAll(async () => {
  // Create two users
  userA = await seedUser(EMAIL_A, 'User A')
  userB = await seedUser(EMAIL_B, 'User B')
  cookieA = await loginAs(EMAIL_A)
  cookieB = await loginAs(EMAIL_B)

  // Create an umbrella for each user directly in DB
  const db = getTestDb()
  const [uA] = await db
    .insert(umbrellas)
    .values({ name: 'A Umbrella', icon: '🅰️', userId: userA.id, position: 0 })
    .returning()
  const [uB] = await db
    .insert(umbrellas)
    .values({ name: 'B Umbrella', icon: '🅱️', userId: userB.id, position: 0 })
    .returning()
  umbrellaAId = uA.id
  umbrellaBId = uB.id
})

afterAll(async () => {
  await cleanupUsers([EMAIL_A, EMAIL_B])
})

describe('Cross-user isolation', () => {
  describe('Umbrellas', () => {
    it('User A cannot see User B umbrellas in GET /api/umbrellas', async () => {
      const res = await supertest(app).get('/api/umbrellas').set('Cookie', cookieA)
      expect(res.status).toBe(200)
      const ids = res.body.map((u: { id: string }) => u.id)
      expect(ids).toContain(umbrellaAId)
      expect(ids).not.toContain(umbrellaBId)
    })

    it('User A cannot PATCH User B umbrella — returns 404', async () => {
      const res = await supertest(app)
        .patch(`/api/umbrellas/${umbrellaBId}`)
        .set('Cookie', cookieA)
        .send({ name: 'Hacked' })
      expect(res.status).toBe(404)
    })

    it('User A cannot DELETE User B umbrella — returns 404', async () => {
      const res = await supertest(app)
        .delete(`/api/umbrellas/${umbrellaBId}`)
        .set('Cookie', cookieA)
      expect(res.status).toBe(404)
    })
  })

  describe('Tasks', () => {
    it('User A GET /api/tasks does not include User B tasks', async () => {
      const db = getTestDb()
      const [task] = await db
        .insert(tasks)
        .values({
          umbrellaId: umbrellaBId,
          userId: userB.id,
          title: 'B Task',
          status: 'todo',
          priority: 'medium',
          position: 0,
        })
        .returning()

      const res = await supertest(app).get('/api/tasks').set('Cookie', cookieA)
      expect(res.status).toBe(200)
      const ids = res.body.map((t: { id: string }) => t.id)
      expect(ids).not.toContain(task.id)

      await db.delete(tasks).where(eq(tasks.id, task.id))
    })
  })

  describe('Questions', () => {
    it('User A cannot see User B questions', async () => {
      const db = getTestDb()
      const [q] = await db
        .insert(umbrellaQuestions)
        .values({
          umbrellaId: umbrellaBId,
          userId: userB.id,
          text: 'B Question?',
          cadence: 'daily',
          answerType: 'boolean',
          position: 0,
          enabled: true,
        })
        .returning()

      const res = await supertest(app)
        .get(`/api/umbrellas/${umbrellaBId}/questions`)
        .set('Cookie', cookieA)
      expect(res.status).toBe(200)
      // Either empty (scoped WHERE) or 404 — either way B's question is not visible
      const ids = Array.isArray(res.body) ? res.body.map((x: { id: string }) => x.id) : []
      expect(ids).not.toContain(q.id)

      await db.delete(umbrellaQuestions).where(eq(umbrellaQuestions.id, q.id))
    })
  })

  describe('Analytics', () => {
    it('User A cannot get trend for User B umbrella — returns 404', async () => {
      const res = await supertest(app)
        .get(`/api/analytics/umbrellas/${umbrellaBId}/trend`)
        .set('Cookie', cookieA)
      expect(res.status).toBe(404)
    })
  })

  describe('Interview', () => {
    it('User A POST /interview/answer for a question owned by User B returns 404', async () => {
      const db = getTestDb()
      const [q] = await db
        .insert(umbrellaQuestions)
        .values({
          umbrellaId: umbrellaBId,
          userId: userB.id,
          text: 'B daily?',
          cadence: 'daily',
          answerType: 'boolean',
          position: 0,
          enabled: true,
        })
        .returning()

      const res = await supertest(app)
        .post('/api/interview/answer')
        .set('Cookie', cookieA)
        .send({ questionId: q.id, answerBoolean: 'yes' })
      expect(res.status).toBe(404)

      await db.delete(umbrellaQuestions).where(eq(umbrellaQuestions.id, q.id))
    })
  })

  describe('Settings', () => {
    it("User A PATCH /api/settings does not affect User B settings", async () => {
      const resA = await supertest(app).get('/api/settings').set('Cookie', cookieA)
      const resB = await supertest(app).get('/api/settings').set('Cookie', cookieB)
      expect(resA.status).toBe(200)
      expect(resB.status).toBe(200)

      // Patch A's checkin time
      await supertest(app)
        .patch('/api/settings')
        .set('Cookie', cookieA)
        .send({ checkinTime: '20:00' })

      // B's settings should be unchanged
      const resBAfter = await supertest(app).get('/api/settings').set('Cookie', cookieB)
      expect(resBAfter.body.checkinTime).not.toBe('20:00')
    })
  })

  describe('Chat', () => {
    it('User A GET /api/chat/history does not include User B messages', async () => {
      // Post a message as User B
      await supertest(app)
        .post('/api/chat/history')
        .set('Cookie', cookieB)
        .send({ role: 'user', content: 'B private message' })

      const res = await supertest(app)
        .get('/api/chat/history')
        .set('Cookie', cookieA)
      expect(res.status).toBe(200)
      const contents = res.body.map((m: { content: string }) => m.content)
      expect(contents).not.toContain('B private message')
    })
  })

  describe('Resolutions', () => {
    it('User A GET resolutions for User B umbrella returns empty array', async () => {
      // User A querying B's umbrella — scoped WHERE clause returns empty array, not 403
      const res = await supertest(app)
        .get(`/api/umbrellas/${umbrellaBId}/resolutions`)
        .set('Cookie', cookieA)
      expect(res.status).toBe(200)
      expect(res.body).toEqual([])
    })
  })
})
