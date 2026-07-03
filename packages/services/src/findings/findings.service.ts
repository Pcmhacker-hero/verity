/**
 * Findings Service — Doc 11 §3 (lives inside Verification Service boundary).
 *
 * Finding queries, filtering, and aggregation for the Findings Dashboard.
 * Deliberately not a separate service — same boundary as Verification (Doc 11 §3 note).
 */

export class FindingsService {
  // TODO: Get findings for a verification run (with severity/specArea/status filters)
  // TODO: Get finding detail by ID
  // TODO: Get findings summary (count by severity, by specArea)
  // TODO: Acknowledge finding (Epic H6 — Later, column exists now)
}
