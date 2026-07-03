import { db } from '@verity/database';
import { authAccounts, authSessions, authUsers, authVerifications } from '@verity/database/schema';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { ensureWorkspaceForAuthUser } from './provisioning';
import { config } from '@verity/shared';

const isProduction = config.env === 'production';

export const auth = betterAuth({
  secret: config.auth.secret,
  baseURL: config.auth.url,
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
    requireEmailVerification: config.auth.requireEmailVerification,
  },
  socialProviders: {
    github: {
      clientId: config.auth.github.clientId,
      clientSecret: config.auth.github.clientSecret,
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
