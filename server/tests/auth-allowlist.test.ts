import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import supertest from 'supertest'
import app from '../src/app.js'
import { seedUser, cleanupUsers, seedAllowedEmail, cleanupAllowedEmail } from './helpers/db.js'
import { loginAs } from './helpers/session.js'

const ADMIN_EMAIL = (process.env.ALLOWED_GOOGLE_EMAIL ?? 'dbh770@gmail.com').toLowerCase()
const TEST_INVITED = 'test-invited@example.com'
const TEST_REVOKED = 'test-revoked@example.com'
const TEST_BLOCKED = 'test-blocked@example.com'

describe('Auth allowlist', () => {
  beforeEach(async () => {
    // Seed users for invite tests
    await seedUser(TEST_INVITED)
    await seedUser(TEST_REVOKED)
    await seedAllowedEmail(TEST_INVITED)
    await seedAllowedEmail(TEST_REVOKED, new Date()) // revoked immediately
  })

  afterEach(async () => {
    await cleanupUsers([TEST_INVITED, TEST_REVOKED, TEST_BLOCKED])
    await cleanupAllowedEmail(TEST_INVITED)
    await cleanupAllowedEmail(TEST_REVOKED)
  })

  it('admin email can authenticate via dev-login', async () => {
    // Admin user must exist in DB (seeded by migration 0017 or earlier)
    const cookie = await loginAs(ADMIN_EMAIL)
    expect(cookie).toBeTruthy()

    const res = await supertest(app)
      .get('/auth/me')
      .set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.body.authenticated).toBe(true)
    expect(res.body.user.email).toBe(ADMIN_EMAIL)
    expect(res.body.user.is_admin).toBe(true)
  })

  it('invited (non-revoked) user can authenticate', async () => {
    const cookie = await loginAs(TEST_INVITED)
    expect(cookie).toBeTruthy()

    const res = await supertest(app)
      .get('/auth/me')
      .set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.body.authenticated).toBe(true)
    expect(res.body.user.is_admin).toBe(false)
  })

  it('non-invited user cannot use dev-login (no user row)', async () => {
    // TEST_BLOCKED has no user row seeded
    const res = await supertest(app)
      .post('/api/dev/login')
      .send({ email: TEST_BLOCKED })
    expect(res.status).toBe(404) // user not in DB
  })

  it('GET /auth/me returns 200 with authenticated=false when no session', async () => {
    const res = await supertest(app).get('/auth/me')
    expect(res.status).toBe(200)
    expect(res.body.authenticated).toBe(false)
  })

  it('API routes require auth — returns 401 without session', async () => {
    const res = await supertest(app).get('/api/umbrellas')
    expect(res.status).toBe(401)
  })

  it('admin-only routes return 403 for non-admin users', async () => {
    const cookie = await loginAs(TEST_INVITED)
    const res = await supertest(app)
      .get('/api/admin/invites')
      .set('Cookie', cookie)
    expect(res.status).toBe(403)
  })

  it('admin can access /api/admin/invites', async () => {
    const cookie = await loginAs(ADMIN_EMAIL)
    const res = await supertest(app)
      .get('/api/admin/invites')
      .set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })
})
