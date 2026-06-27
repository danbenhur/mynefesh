import supertest from 'supertest'
import app from '../../src/app.js'

export async function loginAs(email: string): Promise<string> {
  const res = await supertest(app)
    .post('/api/dev/login')
    .set('Content-Type', 'application/json')
    .send({ email })

  if (res.status !== 200) {
    throw new Error(
      `dev-login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`
    )
  }

  const setCookie = res.headers['set-cookie']
  return Array.isArray(setCookie) ? setCookie.join('; ') : (setCookie ?? '')
}
