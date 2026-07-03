/**
 * System limits — Doc 16 §11.1, Doc 14 §13, Doc 18 §12.4.
 *
 * Centralized limit constants to ensure consistency between validation,
 * rate limiting, and cost controls.
 */

/** Maximum file size for verification analysis (Doc 16 §11.1) */
export const MAX_FILE_SIZE_BYTES = 100 * 1024; // 100KB

/** Maximum repository files to analyze (Doc 5 §1) */
export const MAX_REPO_FILES = 2000;

/** Target repository size for v1 (Doc 5 §1) */
export const TARGET_REPO_FILES = 500;

/** Maximum request body size (Doc 16 §7.4) */
export const MAX_REQUEST_BODY_BYTES = 1 * 1024 * 1024; // 1MB

/** Maximum idea text length for PRD generation */
export const MAX_IDEA_TEXT_LENGTH = 10_000;

/** Maximum project name length */
export const MAX_PROJECT_NAME_LENGTH = 100;

/** Per-run LLM cost cap in dollars (Doc 18 §12.4) */
export const COST_CAP_PER_RUN = 2.0;

/** Per-user daily LLM cost cap in dollars (Doc 18 §12.4) */
export const COST_CAP_PER_USER_DAILY = 20.0;

/** System hourly LLM cost cap in dollars (Doc 18 §12.4) */
export const COST_CAP_SYSTEM_HOURLY = 50.0;

/** System monthly LLM cost cap in dollars (Doc 18 §12.4) */
export const COST_CAP_SYSTEM_MONTHLY = 500.0;

/** Default rate limit for standard endpoints (Doc 14 §13) */
export const RATE_LIMIT_STANDARD = 60;

/** Default rate limit for expensive endpoints (Doc 14 §13) */
export const RATE_LIMIT_EXPENSIVE = 10;

/** Maximum concurrent jobs per user (Doc 18 §14.2) */
export const MAX_CONCURRENT_JOBS_PER_USER = 3;

/** Queue depth circuit breaker (Doc 18 §6.4) */
export const QUEUE_DEPTH_CIRCUIT_BREAKER = 100;
