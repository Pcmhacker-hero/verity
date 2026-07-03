/**
 * Verification Service — Doc 11 §3, §6.
 *
 * Orchestrates the two-tier verification lifecycle:
 * 1. Ingest repo (read-only, Doc 5 §10)
 * 2. Run Tier 1 deterministic checks
 * 3. Run Tier 2 semantic checks (LLM-based)
 * 4. Persist findings
 *
 * Executed as a queued job (Doc 11 §4).
 * Status transitions: queued → running_deterministic → running_semantic → complete/failed
 */

export class VerificationService {
  // TODO: Trigger verification run (creates VerificationRun, enqueues job)
  // TODO: Execute verification (called by worker consumer)
  // TODO: Track status transitions
  // TODO: Handle partial failure (Tier 1 findings preserved if Tier 2 fails — Doc 11 §6 step 6)
}
