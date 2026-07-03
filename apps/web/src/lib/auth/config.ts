import { db } from '@verity/database';
import { authAccounts, authSessions, authUsers, authVerifications } from '@verity/database/schema';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { ensureWorkspaceForAuthUser } from './provisioning';

const isProduction = process.env.NODE_ENV === 'production';

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET ?? process.env.SESSION_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL,
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: authUsers,
      session: authSessions,
      account: authAccounts,
      verification: authVerifications,
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: process.env.ENABLE_EMAIL_VERIFICATION === 'true',
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID ?? '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
      // User authentication only. Repository connection OAuth is a separate
      // Step 4+ flow because it needs project-scoped state and token indirection.
      scope: ['read:user', 'user:email'],
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  advanced: {
    cookiePrefix: 'verity',
    useSecureCookies: isProduction,
    defaultCookieAttributes: {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user: { id: string; email: string; name?: string | null }) => {
          await ensureWorkspaceForAuthUser(user);
        },
      },
    },
  },
});

export type Auth = typeof auth;
