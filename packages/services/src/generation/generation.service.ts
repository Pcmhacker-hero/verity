/**
 * Generation Service — Doc 11 §3, §5.
 *
 * Orchestrates the 7-stage spec generation pipeline:
 * Idea → PRD → Architecture → Schema → API → Repo Structure → Roadmap → Tasks
 *
 * Each stage: build prompt → call LLM → validate with Zod → persist artifact.
 * Pipeline is executed as a queued job (Doc 11 §4).
 */

import { SpecService } from '../spec/spec.service.js';
import { logger } from '@verity/shared/observability';
import { 
  GenerationEngine, 
  MockProvider, 
  OpenAIProvider, 
  AnthropicProvider, 
  GeminiProvider, 
  PromptBuilder, 
  ArtifactDependencyManager 
} from '@verity/ai';
import type { LLMProvider } from '@verity/ai';
import { ARTIFACT_TYPES } from '@verity/shared/types';
import { 
  prdArtifactSchema,
  architectureArtifactSchema,
  schemaArtifactSchema,
  apiArtifactSchema,
  repoStructureArtifactSchema,
  roadmapArtifactSchema,
  tasksArtifactSchema
} from '@verity/shared/validation';
import { VerityError } from '@verity/shared/errors';

export interface GenerationOptions {
  providerName?: 'openai' | 'anthropic' | 'gemini' | 'mock';
}

export class GenerationService {
  private specService: SpecService;

  constructor() {
    this.specService = new SpecService();
  }

  private getProvider(name = process.env.LLM_PROVIDER || 'mock'): LLMProvider {
    switch (name) {
      case 'openai':
        return new OpenAIProvider();
      case 'anthropic':
        return new AnthropicProvider();
      case 'gemini':
        return new GeminiProvider();
      case 'mock':
      default:
        return new MockProvider();
    }
  }

  private getSchemaForArtifact(artifactType: typeof ARTIFACT_TYPES[number]) {
    switch (artifactType) {
      case 'prd': return prdArtifactSchema;
      case 'architecture': return architectureArtifactSchema;
      case 'schema': return schemaArtifactSchema;
      case 'api': return apiArtifactSchema;
      case 'repo_structure': return repoStructureArtifactSchema;
      case 'roadmap': return roadmapArtifactSchema;
      case 'tasks': return tasksArtifactSchema;
      default:
        throw new Error(`Unknown schema for ${artifactType}`);
    }
  }

  /**
   * Generates a single artifact and persists it as a new SpecVersion.
   * If generating anything other than a PRD, it will pull the latest version
   * of its required upstream dependencies.
   */
  async generateArtifact(
    projectId: string, 
    artifactType: typeof ARTIFACT_TYPES[number], 
    ideaText: string,
    options?: GenerationOptions
  ) {
    const provider = this.getProvider(options?.providerName);
    const engine = new GenerationEngine(provider);

    // 1. Resolve Dependencies
    const dependencies = ArtifactDependencyManager.getDependencies(artifactType);
    const contextArtifacts: Record<string, any> = {};

    if (dependencies.length > 0) {
      // We need existing context
      try {
        for (const dep of dependencies) {
          const res = await this.specService.getArtifact(projectId, dep);
          const data = res[dep === 'repo_structure' ? 'repoStructure' : dep];
          if (!data) {
            throw new Error(`Dependency missing: ${dep} is empty in the current SpecVersion.`);
          }
          contextArtifacts[dep] = data;
        }
      } catch (err: any) {
        throw new VerityError(
          'PRECONDITION_FAILED',
          `Cannot generate ${artifactType} because required context is missing: ${err.message}`,
          400
        );
      }
    }

    // 2. Build Prompts
    const systemPrompt = PromptBuilder.getSystemPrompt(artifactType);
    const userPrompt = PromptBuilder.getUserPrompt(artifactType, ideaText, contextArtifacts);
    const schema = this.getSchemaForArtifact(artifactType);

    // 3. Generate Validated Output via AI Engine
    const response = await engine.generateValidatedOutput(systemPrompt, userPrompt, schema as any);

    // 4. Persist the generated artifact via SpecService (Creates immutable SpecVersion)
    const newVersion = await this.specService.updateArtifact(projectId, artifactType, response.data, 'generation');

    return {
      specVersionId: newVersion!.id,
      versionNumber: newVersion!.versionNumber,
      usage: response.usage,
      durationMs: response.duration_ms,
      model: response.model
    };
  }

  /**
   * Orchestrates the 7-stage spec generation pipeline.
   * This logic can be wrapped within a background queue job (Doc 11 §4).
   */
  async generatePipeline(projectId: string, ideaText: string, options?: GenerationOptions) {
    const results = [];
    for (const artifactType of ARTIFACT_TYPES) {
      logger.info(`Starting generation of ${artifactType} for project ${projectId}...`);
      
      const result = await this.generateArtifact(projectId, artifactType, ideaText, options);
      results.push({ artifactType, ...result });

      logger.info(`Completed ${artifactType} in ${result.durationMs}ms`);
    }
    return results;
  }
}

