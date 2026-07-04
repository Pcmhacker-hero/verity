/**
 * Findings Service — Doc 11 §3 (lives inside Verification Service boundary).
 *
 * Finding queries, filtering, and aggregation for the Findings Dashboard.
 * Deliberately not a separate service — same boundary as Verification (Doc 11 §3 note).
 */

import { db } from '@verity/database';
import { findings, findingComments, authUsers } from '@verity/database/schema';
import { eq, desc } from 'drizzle-orm';

export class FindingsService {
  // TODO: Get findings for a verification run (with severity/specArea/status filters)
  // TODO: Get finding detail by ID
  // TODO: Get findings summary (count by severity, by specArea)
  
  static async updateFindingStatus(findingId: string, status: 'open' | 'assigned' | 'in-progress' | 'resolved' | 'verified' | 'acknowledged' | 'wont-fix') {
    return db.update(findings)
      .set({ status })
      .where(eq(findings.id, findingId))
      .returning();
  }

  static async assignFinding(findingId: string, assigneeId: string | null) {
    return db.update(findings)
      .set({ assigneeId, status: assigneeId ? 'assigned' : 'open' })
      .where(eq(findings.id, findingId))
      .returning();
  }

  static async addFindingComment(findingId: string, authorId: string, content: string) {
    return db.insert(findingComments)
      .values({ findingId, authorId, content })
      .returning();
  }

  static async getFindingComments(findingId: string) {
    return db.select({
      id: findingComments.id,
      content: findingComments.content,
      createdAt: findingComments.createdAt,
      author: {
        id: authUsers.id,
        name: authUsers.name,
        image: authUsers.image,
      }
    })
    .from(findingComments)
    .innerJoin(authUsers, eq(findingComments.authorId, authUsers.id))
    .where(eq(findingComments.findingId, findingId))
    .orderBy(desc(findingComments.createdAt));
  }
}
