/**
 * Auth Service — Doc 11 §3.
 *
 * Wraps Better Auth configuration. Handles:
 * - GitHub OAuth sign-in (Doc 16 §4.1)
 * - Session management (Doc 16 §6)
 * - Auto-provision workspace on first login (Doc 10 §4.1)
 */

import { db } from '@verity/database';
import { authAccounts } from '@verity/database/schema';
import { eq, and } from 'drizzle-orm';

export class AuthService {
  async getGithubToken(userId: string): Promise<string | null> {
    const account = await db.query.authAccounts.findFirst({
      where: and(
        eq(authAccounts.userId, userId),
        eq(authAccounts.providerId, 'github')
      )
    });
    return account?.accessToken ?? null;
  }
}
