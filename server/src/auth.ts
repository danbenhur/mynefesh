import passport from 'passport'
import { Strategy as GitHubStrategy, type Profile } from 'passport-github2'
import type { Request, Response, NextFunction } from 'express'

export interface GithubUser {
  id: string
  username: string
  displayName: string
  photos?: Array<{ value: string }>
}

declare global {
  namespace Express {
    interface User extends GithubUser {}
  }
}

passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID ?? '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
      callbackURL: process.env.GITHUB_CALLBACK_URL ?? '',
    },
    (_accessToken: string, _refreshToken: string, profile: Profile, done: (err: unknown, user?: GithubUser) => void) => {
      done(null, {
        id: profile.id,
        username: profile.username ?? '',
        displayName: profile.displayName ?? profile.username ?? '',
        photos: profile.photos,
      })
    }
  )
)

passport.serializeUser((user, done) => {
  done(null, user)
})

passport.deserializeUser((obj: unknown, done) => {
  done(null, obj as GithubUser)
})

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.isAuthenticated()) {
    next()
  } else {
    res.status(401).json({ error: 'Unauthorized' })
  }
}
