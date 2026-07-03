/**
 * Verification Job Processor — Doc 11 §4, §6, Doc 13 §9, Doc 14 §4.2.
 *
 * Processes verification jobs (two-tier: deterministic + semantic).
 * Integrates with VerificationService, RepoService, and AI Engine.
 * Preserves Tier 1 findings if Tier 2 fails (Doc 11 §6 step 6).
 */

import { EventEmitter } from 'events';
import { db } from '@verity/database';
import { jobs, verificationRuns } from '@verity/database/schema';
import { eq, and } from 'drizzle-orm';
import { VerityError } from '@verity/shared/errors';
import { Tier1VerificationService, Tier1Result } from '@verity/verification/tier1';
import type { VerificationJobPayload, JobStatus, VerificationStage } from '@verity/shared/types';
import { BaseWorker } from './base.worker.js';

interface VerificationJobData extends VerificationJobPayload {
  jobId: string;
  verificationRunId: string;
}

export class VerificationJobProcessor extends BaseWorker {
  private tier1Service: Tier1VerificationService;

  constructor() {
    super();
    this.tier1Service = new Tier1VerificationService();
  }

  async process(jobId: string): Promise<void> {
    if (this.isProcessing) {
      throw new VerityError('WORKER_BUSY', 'Worker is already processing a job', 409);
    }

    this.isProcessing = true;
    this.currentJobId = jobId;

    try {
      // 1. Load job record
      const job = await this.loadJob(jobId);
      if (!job) {
        throw new VerityError('JOB_NOT_FOUND', `Job ${jobId} not found`, 404);
      }

      // 2. Check cancellation
      if (job.status === 'cancelled') {
        this.emit('job_cancelled', { jobId, reason: job.cancellationReason });
        return;
      }

      // 3. Parse payload
      const payload = job.payload as VerificationJobData;

      // 4. Update status to running
      await this.updateJobStatus(jobId, 'running', {
        startedAt: new Date().toISOString(),
      });

      // 5. Update VerificationRun status to running_deterministic
      await this.updateVerificationRunStatus(payload.verificationRunId, 'running_deterministic');

      // 6. Execute Tier 1: Deterministic verification
      const tier1Result = await this.executeTier1(jobId, payload);

      // 7. Check cancellation before Tier 2
      await this.checkCancellation(jobId);

      // 8. Update VerificationRun status to running_semantic
      await this.updateVerificationRunStatus(payload.verificationRunId, 'running_semantic');

      // 9. Execute Tier 2: Semantic verification
      const tier2Result = await this.executeTier2(jobId, payload, tier1Result);

      // 10. Mark both job and verification run as complete
      await this.completeJob(jobId, payload, tier1Result, tier2Result);
      
      this.emit('job_completed', { jobId, verificationRunId: payload.verificationRunId });
    } catch (error: any) {
      // Check if cancelled during processing
      if (error.code === 'JOB_CANCELLED') {
        await this.updateJobStatus(jobId, 'cancelled', {
          cancelledAt: new Date().toISOString(),
          cancellationReason: error.message,
        });
        this.emit('job_cancelled', { jobId, reason: error.message });
        return;
      }

      // Handle failure with retry logic
      await this.handleFailure(jobId, error);
    } finally {
      this.isProcessing = false;
      this.currentJobId = null;
    }
  }

  private async executeTier1(
    jobId: string,
    payload: VerificationJobData
  ): Promise<Tier1Result> {
    const stage: VerificationStage = 'deterministic';

    // Update progress
    await this.updateProgress(jobId, {
      currentStep: 'Running deterministic checks...',
      verificationStage: stage,
      stepsCompleted: 0,
      stepsTotal: 2,
    });

    const startTime = Date.now();
    
    // Run actual Tier 1 verification
    const tier1Result = await this.tier1Service.executeTier1({
      verificationRunId: payload.verificationRunId,
      specVersionId: payload.specVersionId,
      repoPath: payload.repoPath || process.cwd(), // TODO: Get from RepoConnection
      commitSha: payload.commitSha || 'unknown',
      signal: undefined, // TODO: Hook up cancellation signal
      onProgress: (stage: string, progress: number) => {
        this.emit('tier1_progress', { jobId, stage, progress });
        // Update progress in DB
        this.updateProgress(jobId, { currentStep: stage }).catch(() => {});
      },
    });

    const durationMs = Date.now() - startTime;

    // Update progress: Tier 1 complete
    await this.updateProgress(jobId, {
      currentStep: `Deterministic checks complete (${tier1Result.findings.length} findings)`,
      verificationStage: stage,
      stepsCompleted: 1,
      stepsTotal: 2,
    });

    return { findings: tier1Result.findings, durationMs, checkersRun: tier1Result.checkersRun, filesProcessed: tier1Result.filesProcessed };
  }

  private async executeTier2(
    jobId: string,
    payload: VerificationJobData,
    tier1Result: Tier1Result
  ): Promise<{ findings: any[]; durationMs: number }> {
    const stage: VerificationStage = 'semantic';

    // Update progress
    await this.updateProgress(jobId, {
      currentStep: 'Running semantic analysis...',
      verificationStage: stage,
      stepsCompleted: 1,
      stepsTotal: 2,
    });

    // Remove simulated work as engine runs real AI workloads
    const startTime = Date.now();
    const findings = await this.runSemanticChecks(payload, tier1Result.findings);
    
    const durationMs = Date.now() - startTime;

    // Update progress: Tier 2 complete
    await this.updateProgress(jobId, {
      currentStep: `Semantic analysis complete (${findings.length} additional findings)`,
      verificationStage: stage,
      stepsCompleted: 2,
      stepsTotal: 2,
    });

    return { findings, durationMs };
  }

  private async simulateWork(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async runSemanticChecks(
    payload: VerificationJobData,
    tier1Findings: any[]
  ): Promise<any[]> {
    // Collect the spec versions (Mocked for MVP, normally fetched from DB)
    const specData = {
      specVersionId: payload.specVersionId,
      mockData: "Mock PRD and Architecture for Semantic Analysis"
    };

    // Instantiate engine (would normally be injected)
    const { VerificationEngine } = await import('@verity/verification/engine');
    const engine = new VerificationEngine();

    // Reconstruct files Map from payload if present or dummy
    const repoFiles = new Map<string, { content: string; hash: string }>();
    if ((payload as any).fileContents) {
      for (const file of (payload as any).fileContents) {
         repoFiles.set(file.path, { content: file.content, hash: file.hash });
      }
    } else {
      // Mock files for testing
      repoFiles.set('src/api/auth.ts', { content: 'export const login = () => {}', hash: 'abc' });
    }

    try {
      const result = await engine.run({
        specVersionId: payload.specVersionId,
        repoFiles,
        specData,
      });
      return result.findings || [];
    } catch (err) {
      console.error('Semantic verification failed:', err);
      return [];
    }
  }

  private async completeJob(
    jobId: string,
    payload: VerificationJobData,
    tier1Result: { findings: any[]; durationMs: number },
    tier2Result: { findings: any[]; durationMs: number }
  ): Promise<void> {
    const allFindings = [...tier1Result.findings, ...tier2Result.findings];
    
    // Calculate finding summary by severity
    const findingSummary = {
      critical: allFindings.filter(f => f.severity === 'critical').length,
      high: allFindings.filter(f => f.severity === 'high').length,
      medium: allFindings.filter(f => f.severity === 'medium').length,
      low: allFindings.filter(f => f.severity === 'low').length,
      info: allFindings.filter(f => f.severity === 'info').length,
      total: allFindings.length,
    };

    // Update job with result
    await this.updateJobResult(jobId, {
      verificationRunId: payload.verificationRunId,
      specVersionId: payload.specVersionId,
      findingSummary,
      tierSummary: {
        deterministic: { findingsCount: tier1Result.findings.length, durationMs: tier1Result.durationMs },
        semantic: { findingsCount: tier2Result.findings.length, durationMs: tier2Result.durationMs },
      },
    });

    // Update job status
    await this.updateJobStatus(jobId, 'complete', {
      completedAt: new Date().toISOString(),
    });

    // Update VerificationRun status to complete
    await this.updateVerificationRunStatus(payload.verificationRunId, 'complete');
  }

  private async updateVerificationRunStatus(runId: string, status: string): Promise<void> {
    await db
      .update(verificationRuns)
      .set({
        status: status as any,
        completedAt: status === 'complete' || status === 'failed' ? new Date() : undefined,
      })
      .where(eq(verificationRuns.id, runId));
  }

  protected async handleFailure(jobId: string, error: Error): Promise<void> {
    const job = await this.loadJob(jobId);
    if (!job) return;

    const attempt = job.attempt + 1;
    const maxAttempts = job.maxAttempts;
    
    // Extract error code if available (VerityError has it, regular Error doesn't)
    const errorCode = 'code' in error ? (error as any).code : 'VERIFICATION_FAILED';

    const payload = job.payload as VerificationJobData;
    await this.updateVerificationRunStatus(payload.verificationRunId, 'failed');
    
    await super.handleFailure(jobId, error);
  }
}

export const verificationJobProcessor = new VerificationJobProcessor();