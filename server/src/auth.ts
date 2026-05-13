import passport from 'passport'
import { Strategy as GoogleStrategy, type Profile } from 'passport-google-oauth20'
import type { Request, Response, NextFunction } from 'express'

export interface AuthUser {
  id: string
  username: string        // stores the email address
  displayName: string
  photos?: Array<{ value: string }>
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
      done(null, {
        id: profile.id,
        username: profile.emails?.[0]?.value ?? '',
        displayName: profile.displayName ?? '',
        photos: profile.photos,
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
