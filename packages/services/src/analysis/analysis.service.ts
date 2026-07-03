import { db } from '@verity/database';
import { analysisRuns, analysisFileResults } from '@verity/database/schema';
import { eq, and } from 'drizzle-orm';
import { discoverRepoFiles, detectLanguage } from '@verity/verification/utils/ast.js';
import { GenerationEngine, OpenAIProvider } from '@verity/ai';
import { fileAnalysisSchema, type FileAnalysisResult } from './schemas.js';
import { logger } from '@verity/shared/observability';
import crypto from 'crypto';

export class AnalysisService {
  private engine: GenerationEngine;

  constructor() {
    const provider = new OpenAIProvider(process.env.OPENAI_API_KEY || '');
    this.engine = new GenerationEngine(provider);
  }

  /**
   * Analyzes an extracted repository directory.
   */
  async analyzeRepository(
    runId: string,
    projectId: string,
    repoPath: string,
    commitSha: string,
    onProgress?: (progress: number, stage: string) => void
  ): Promise<void> {
    try {
      logger.info('Starting repository analysis', { runId, projectId, commitSha });
      
      onProgress?.(5, 'discovery');

      // 1. Discover files
      const repoStructure = discoverRepoFiles(repoPath);
      const totalFiles = repoStructure.files.length;
      
      await db.update(analysisRuns)
        .set({ totalFiles, stage: 'analysis' })
        .where(eq(analysisRuns.id, runId));

      let processedFiles = 0;
      let aiAnalysisCount = 0;

      // 2. Fetch previous analysis results to compare hashes for incremental analysis
      const previousResults = await db.select({
        filePath: analysisFileResults.filePath,
        fileHash: analysisFileResults.fileHash,
      })
      .from(analysisFileResults)
      .innerJoin(analysisRuns, eq(analysisFileResults.analysisRunId, analysisRuns.id))
      .where(and(
        eq(analysisRuns.projectId, projectId),
        eq(analysisRuns.status, 'complete')
      ));

      const previousHashMap = new Map(previousResults.map(r => [r.filePath, r.fileHash]));

      // 3. Process each file
      for (const file of repoStructure.files) {
        const fileHash = this.hashContent(file.content);
        const language = detectLanguage(file.path);

        const previousHash = previousHashMap.get(file.path);
        
        let result: FileAnalysisResult;
        
        if (previousHash === fileHash) {
          // Unchanged file - we should ideally fetch the full previous result and duplicate it,
          // but for MVP we will just skip to save time and API costs.
          // Note: Full implementation would copy the previous row.
          logger.info('Skipping unchanged file', { runId, filePath: file.path });
          processedFiles++;
          continue;
        }

        // New or changed file - run AI Analysis
        logger.info('Analyzing file', { runId, filePath: file.path, language });
        
        const systemPrompt = `You are a Principal Software Architect analyzing a code repository.
Your task is to analyze the provided file content and extract architectural patterns, dependencies, code quality issues, security vulnerabilities, performance bottlenecks, and documentation status.
Output MUST strictly follow the requested JSON schema.`;
        
        const userPrompt = `File Path: ${file.path}
Language: ${language}

File Content:
\`\`\`
${file.content}
\`\`\`

Analyze the file and provide your findings.`;

        try {
          const aiResponse = await this.engine.generateValidatedOutput(
            systemPrompt,
            userPrompt,
            fileAnalysisSchema
          );
          
          result = aiResponse.data;
          aiAnalysisCount++;

          // Save to database
          await db.insert(analysisFileResults).values({
            analysisRunId: runId,
            filePath: file.path,
            fileHash,
            language,
            dependencies: result.dependencies,
            architecture: result.architecture,
            codeQuality: result.codeQuality,
            security: result.security,
            performance: result.performance,
            documentation: result.documentation,
          });

        } catch (error) {
          logger.error('Failed to analyze file', { runId, filePath: file.path, error });
          // We continue analysis even if one file fails
        }

        processedFiles++;
        
        // Update progress every 5 files to avoid DB spam
        if (processedFiles % 5 === 0 || processedFiles === totalFiles) {
          const progress = Math.floor((processedFiles / totalFiles) * 90) + 10; // 10% to 100%
          onProgress?.(progress, 'analysis');
          
          await db.update(analysisRuns)
            .set({ processedFiles, progress })
            .where(eq(analysisRuns.id, runId));
        }
      }

      onProgress?.(100, 'finalizing');

      // 4. Summarize and complete
      await db.update(analysisRuns)
        .set({ 
          status: 'complete',
          stage: 'finalizing',
          progress: 100,
          completedAt: new Date(),
          resultSummary: {
            totalFiles,
            processedFiles,
            aiAnalysisCount,
          }
        })
        .where(eq(analysisRuns.id, runId));
        
      logger.info('Repository analysis complete', { runId, totalFiles, aiAnalysisCount });

    } catch (error: any) {
      logger.error('Repository analysis failed', { runId, error });
      
      await db.update(analysisRuns)
        .set({ 
          status: 'failed',
          error: error.message,
          completedAt: new Date(),
        })
        .where(eq(analysisRuns.id, runId));
        
      throw error;
    }
  }

  private hashContent(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }
}
