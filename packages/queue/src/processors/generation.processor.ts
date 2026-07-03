/**
 * Generation Job Processor — Doc 11 §4, §5, Doc 13, Doc 14 §4.2.
 *
 * Processes generation jobs (single artifact or full pipeline).
 * Integrates with GenerationService and AI Engine.
 * Emits progress events for polling UI.
 */

import { db } from '@verity/database';
import { jobs, specVersions, projects } from '@verity/database/schema';
import { eq, and } from 'drizzle-orm';
import { ARTIFACT_TYPES } from '@verity/shared/types';
import { VerityError } from '@verity/shared/errors';
import type { GenerationJobPayload, JobType, JobStatus, GenerationStage } from '@verity/shared/types';
import { BaseWorker } from './base.worker.js';

interface GenerationJobData extends GenerationJobPayload {
  jobId: string;
}

export class GenerationJobProcessor extends BaseWorker {
  private generationService: any = null;

  setGenerationService(service: any) {
    this.generationService = service;
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
      const payload = job.payload as GenerationJobData;

      // 4. Update status to running
      await this.updateJobStatus(jobId, 'running', {
        startedAt: new Date().toISOString(),
      });

      // 5. Execute based on job type
      if (job.type === 'generation-single') {
        await this.processSingleArtifact(jobId, payload);
      } else if (job.type === 'generation-pipeline') {
        await this.processPipeline(jobId, payload);
      } else {
        throw new VerityError('INVALID_JOB_TYPE', `Invalid job type for generation processor: ${job.type}`, 500);
      }

      // 6. Mark complete
      await this.updateJobStatus(jobId, 'complete', {
        completedAt: new Date().toISOString(),
      });
      this.emit('job_completed', { jobId });
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

  private async processSingleArtifact(jobId: string, payload: GenerationJobData): Promise<void> {
    const { projectId, artifactType, ideaText, specVersionId } = payload;

    if (!artifactType) {
      throw new VerityError('VALIDATION_ERROR', 'artifactType required for single artifact generation', 400);
    }

    const stage = artifactType as GenerationStage;

    // Update progress: starting this stage
    await this.updateProgress(jobId, {
      currentStep: `Generating ${artifactType}...`,
      generationStage: stage,
      stepsCompleted: 0,
      stepsTotal: 1,
    });

    if (this.generationService) {
      const result = await this.generationService.generateArtifact(projectId, artifactType, ideaText);
      const artifactName = artifactType || 'unknown';
      await this.updateProgress(jobId, {
        currentStep: `${artifactName} generated successfully`,
        generationStage: stage,
        stepsCompleted: 1,
        stepsTotal: 1,
        completedSteps: [artifactName],
      });
      await this.updateJobResult(jobId, result);
    } else {
      // Simulate work for testing if service is not injected
      await this.simulateWork(2000);

      const artifactName = artifactType || 'unknown';
      await this.updateProgress(jobId, {
        currentStep: `${artifactName} generated successfully`,
        generationStage: stage,
        stepsCompleted: 1,
        stepsTotal: 1,
        completedSteps: [artifactName],
      });

      await this.updateJobResult(jobId, {
        specVersionId: specVersionId || 'mock-spec-version-id',
        versionNumber: 1,
        artifactType: artifactType || 'unknown',
        usage: { totalInputTokens: 0, totalOutputTokens: 0, totalCost: 0 },
        durationMs: 2000,
        model: 'mock',
      });
    }
  }

  private async processPipeline(jobId: string, payload: GenerationJobData): Promise<void> {
    const { projectId, ideaText } = payload;

    if (!ideaText) {
      throw new VerityError('VALIDATION_ERROR', 'ideaText required for pipeline generation', 400);
    }

    const stages: GenerationStage[] = [...ARTIFACT_TYPES] as GenerationStage[];
    const completedSteps: GenerationStage[] = [];
    const results: Array<{ artifactType: string; specVersionId: string; versionNumber: number }> = [];

    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i]!;

      // Check cancellation before each stage
      await this.checkCancellation(jobId);

      // Update progress
      await this.updateProgress(jobId, {
        currentStep: `Generating ${stage}...`,
        generationStage: stage,
        stepsCompleted: i,
        stepsTotal: stages.length,
        completedSteps: [...completedSteps],
      });

      if (this.generationService) {
        const result = await this.generationService.generateArtifact(projectId, stage, ideaText);
        results.push({
          artifactType: stage,
          specVersionId: result.specVersionId,
          versionNumber: result.versionNumber,
        });
      } else {
        await this.simulateWork(1500);
        results.push({
          artifactType: stage,
          specVersionId: `mock-spec-version-${stage}`,
          versionNumber: i + 1,
        });
      }

      const currentStage = stage!;
      completedSteps.push(currentStage);
      this.emit('stage_completed', { jobId, stage: currentStage, result: results[results.length - 1] });
    }

    // Final progress update
    const lastStage = stages[stages.length - 1];
    await this.updateProgress(jobId, {
      currentStep: 'Pipeline completed successfully',
      generationStage: lastStage,
      stepsCompleted: stages.length,
      stepsTotal: stages.length,
      completedSteps,
    });

    // Store final result with all stages
    const lastResult = results[results.length - 1];
    await this.updateJobResult(jobId, {
      specVersionId: lastResult?.specVersionId ?? 'mock-spec-version-id',
      versionNumber: lastResult?.versionNumber ?? 1,
      pipelineResults: results,
    });
  }

  private async simulateWork(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const generationJobProcessor = new GenerationJobProcessor();