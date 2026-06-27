import passport from 'passport'
import { Strategy as GoogleStrategy, type Profile } from 'passport-google-oauth20'
import type { Request, Response, NextFunction } from 'express'

export interface AuthUser {
  id: string           // our UUID from users.id
  google_id: string
  email: string
  name: string
  picture: string | null
}

declare global {
  namespace Express {
    interface User extends AuthUser {}
  }
}

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      callbackURL: process.env.GOOGLE_CALLBACK_URL ?? '',
    },
    (_accessToken, _refreshToken, profile: Profile, done) => {
      // Passport strategy only extracts the profile here.
      // The actual find-or-create DB lookup happens in the auth callback route
      // after the allowlist check — so we don't hit the DB on denied logins.
      done(null, {
        id: profile.id,        // temporary: routes/auth.ts replaces this with our UUID
        google_id: profile.id,
        email: profile.emails?.[0]?.value?.toLowerCase() ?? '',
        name: profile.displayName ?? '',
        picture: profile.photos?.[0]?.value ?? null,
      })
    }
  )
)

passport.serializeUser((user, done) => {
  done(null, user)
})

passport.deserializeUser((obj: unknown, done) => {
  done(null, obj as AuthUser)
})

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.isAuthenticated()) {
    next()
  } else {
    res.status(401).json({ error: 'Unauthorized' })
  }
}

export function isAdminEmail(email: string): boolean {
  const adminEmail = process.env.ALLOWED_GOOGLE_EMAIL?.toLowerCase().trim() ?? ''
  return !!adminEmail && email.toLowerCase().trim() === adminEmail
}

// Gate admin-only routes. Returns 403 (not 404) because the route's existence is not secret.
// Both requireAuth and requireAdmin export from this file so all auth gates are co-located.
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  if (!isAdminEmail(req.user.email)) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }
  next()
}
