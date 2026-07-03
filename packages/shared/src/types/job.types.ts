/**
 * Job types — Doc 11 §4, Doc 14 §4.2, Doc 18 §6.
 *
 * Shared between API layer, worker, and frontend.
 * One definition, three consumers (Doc 5 §5).
 */

export const JOB_TYPES = ['generation-single', 'generation-pipeline', 'verification'] as const;
export type JobType = (typeof JOB_TYPES)[number];

export const JOB_STATUSES = ['queued', 'running', 'complete', 'failed', 'cancelled'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const GENERATION_STAGES = [
  'prd',
  'architecture',
  'schema',
  'api',
  'repo_structure',
  'roadmap',
  'tasks',
] as const;
export type GenerationStage = (typeof GENERATION_STAGES)[number];

export const VERIFICATION_STAGES = ['deterministic', 'semantic'] as const;
export type VerificationStage = (typeof VERIFICATION_STAGES)[number];

export type JobStage = GenerationStage | VerificationStage;

export interface JobPayload {
  projectId: string;
  workspaceId: string;
  userId: string;
  requestId: string;
}

export interface GenerationJobPayload extends JobPayload {
  artifactType?: string; // For single-artifact generation
  ideaText?: string; // For initial PRD generation
  specVersionId?: string; // For regeneration from existing version
}

export interface VerificationJobPayload extends JobPayload {
  specVersionId: string;
  repoConnectionId: string;
  repoPath?: string;
  commitSha?: string;
}

export type AnyJobPayload = GenerationJobPayload | VerificationJobPayload;

export interface JobProgress {
  currentStep: string;
  stepsCompleted: number;
  stepsTotal: number;
  completedSteps: string[];
}

export interface GenerationJobResult {
  specVersionId: string;
  versionNumber: number;
  artifactsGenerated: string[];
  usage?: {
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCost: number;
  };
}

export interface VerificationJobResult {
  verificationRunId: string;
  specVersionId: string;
  findingSummary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
    total: number;
  };
  tierSummary: {
    deterministic: { findingsCount: number; durationMs: number };
    semantic: { findingsCount: number; durationMs: number };
  };
}

export type JobResult = GenerationJobResult | VerificationJobResult;

export interface JobError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  failedStage?: JobStage;
  isRetryable: boolean;
}

export interface JobRecord {
  id: string;
  projectId: string;
  workspaceId: string;
  userId: string;
  type: JobType;
  status: JobStatus;
  generationStage?: GenerationStage;
  verificationStage?: VerificationStage;
  progress: JobProgress;
  payload: AnyJobPayload;
  result?: JobResult;
  error?: JobError;
  idempotencyKey?: string;
  attempt: number;
  maxAttempts: number;
  lastAttemptAt?: string;
  nextRetryAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  deadLetterAt?: string;
  deadLetterReason?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
}

/** Job creation input for API layer */
export interface CreateJobInput {
  type: JobType;
  payload: AnyJobPayload;
  idempotencyKey?: string;
  maxAttempts?: number;
}

/** Job status response for polling (Doc 14 §4.2) */
export interface JobStatusResponse {
  jobId: string;
  type: JobType;
  status: JobStatus;
  stage?: JobStage;
  progress: JobProgress;
  result?: JobResult;
  error?: JobError;
  createdAt: string;
  updatedAt: string;
}

/** Queue event types for monitoring/observability (Doc 11 §8) */
export const QUEUE_EVENT_TYPES = [
  'job_queued',
  'job_started',
  'job_progress',
  'job_completed',
  'job_failed',
  'job_cancelled',
  'job_retry',
  'job_dead_letter',
] as const;
export type QueueEventType = (typeof QUEUE_EVENT_TYPES)[number];

export interface QueueEvent {
  type: QueueEventType;
  jobId: string;
  projectId: string;
  workspaceId: string;
  timestamp: string;
  payload?: Record<string, unknown>;
}

export interface WorkerRegistration {
  workerId: string;
  queues: JobType[];
  concurrency: number;
  startedAt: string;
  lastHeartbeat: string;
  status: 'healthy' | 'unhealthy';
}

export interface QueueMetrics {
  queueName: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  cancelled: number;
  deadLetter: number;
  avgProcessingTimeMs: number;
  throughputPerMinute: number;
}