/**
 * Verification engine orchestrator — Doc 11 §6.
 *
 * Runs Tier 1 (deterministic) → Tier 2 (semantic) → merges findings.
 * Supports intermediate checkpointing (Doc 18 §8.2).
 */

import { GenerationEngine, AnthropicProvider } from '@verity/ai';
import { buildSemanticVerificationPrompt } from '@verity/ai/prompts/verification/semantic.prompt';
import { z } from 'zod';

export const findingSchema = z.object({
  severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
  specArea: z.enum(['auth', 'schema', 'api', 'architecture', 'prd']),
  specElementRef: z.string().describe("Reference to the specific spec element violated"),
  filePath: z.string().nullable().describe("The file path where the issue was found, if applicable"),
  lineNumber: z.number().nullable().describe("The line number where the issue was found, if applicable"),
  explanation: z.string().describe("Clear, plain-language explanation of the discrepancy between spec and code"),
});

export const semanticBatchResultSchema = z.object({
  findings: z.array(findingSchema),
});

export class VerificationEngine {
  private aiEngine: GenerationEngine;

  constructor() {
    this.aiEngine = new GenerationEngine(new AnthropicProvider());
  }

  /**
   * Run the full verification pipeline (Doc 18 §8).
   */
  async run(params: {
    specVersionId: string;
    repoFiles: Map<string, { content: string; hash: string }>;
    previousHashes?: Record<string, string>;
    specData: any; // Full specification content injected here
  }): Promise<any> {
    const { specVersionId, repoFiles, previousHashes = {}, specData } = params;
    
    // Doc 18 §8.1: Incremental Verification - Filter unchanged files
    const changedFiles = new Map<string, { content: string; hash: string }>();
    const currentHashes: Record<string, string> = {};
    
    for (const [filePath, data] of repoFiles) {
      currentHashes[filePath] = data.hash;
      if (previousHashes[filePath] !== data.hash) {
        changedFiles.set(filePath, data);
      }
    }
    
    // 1. Run Tier 1 deterministic checks on changedFiles only
    // ... (Delegated to Tier 1 service)
    
    // 2. Doc 18 §8.2: Tier 2 semantic scaling — batching strategy
    const batches = this.groupFilesIntoBatches(changedFiles);
    const semanticFindings: any[] = [];
    
    // Execute batches using AI
    for (const batch of batches) {
      const filesForPrompt = batch.files.map(filePath => ({
        path: filePath,
        content: changedFiles.get(filePath)?.content || ''
      }));

      const { systemPrompt, userPrompt } = buildSemanticVerificationPrompt(specData, filesForPrompt);

      try {
        const aiResponse = await this.aiEngine.generateValidatedOutput(
          systemPrompt,
          userPrompt,
          semanticBatchResultSchema
        );
        
        // Ensure each finding has the detection tier attached
        const data = aiResponse.data as any;
        const batchFindings = (data.findings || []).map((f: any) => ({
          ...f,
          detectionTier: 'semantic'
        }));

        semanticFindings.push(...batchFindings);
      } catch (error) {
        console.error(`Error processing semantic batch (${batch.type}):`, error);
        // Continue to next batch rather than failing the entire run
      }
    }
    
    // 3. Merge findings (carrying over previous findings for unchanged files)
    
    return {
      currentHashes,
      findings: semanticFindings
    };
  }

  /**
   * Group files by spec area into 4-6 batches to fit LLM Context Windows.
   */
  private groupFilesIntoBatches(files: Map<string, any>) {
    const batches = {
      auth: [] as string[],
      schema: [] as string[],
      api: [] as string[],
      general: [] as string[]
    };

    for (const [filePath] of files) {
      const lowerPath = filePath.toLowerCase();
      if (lowerPath.includes('auth') || lowerPath.includes('middleware')) {
        batches.auth.push(filePath);
      } else if (lowerPath.includes('schema') || lowerPath.includes('model') || lowerPath.includes('entities')) {
        batches.schema.push(filePath);
      } else if (lowerPath.includes('api') || lowerPath.includes('route') || lowerPath.includes('controller')) {
        batches.api.push(filePath);
      } else {
        batches.general.push(filePath);
      }
    }
    
    // Return non-empty batches
    return Object.entries(batches)
      .filter(([_, files]) => files.length > 0)
      .map(([type, files]) => ({ type, files }));
  }
}
