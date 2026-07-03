/**
 * Repo Structure Checker — Tier 1 Deterministic Verification.
 * Verifies repository structure matches spec (required files, folders).
 */

import type { Checker, VerificationContext, CheckerResult, DeterministicFinding } from './types.js';

export class RepoStructureChecker implements Checker {
  name = 'repo-structure-checker';

  async check(context: VerificationContext): Promise<CheckerResult> {
    const startTime = Date.now();
    const findings: DeterministicFinding[] = [];

    // Check repo structure artifact if present
    const repoStructureArtifact = context.specArtifacts.repoStructure;
    if (!repoStructureArtifact) {
      // No repo structure defined in spec - skip check
      return {
        findings: [],
        durationMs: Date.now() - startTime,
        filesProcessed: 0,
      };
    }

    const specTree = repoStructureArtifact.tree;
    const actualFiles = new Set(context.repoStructure.files.map(f => f.path));
    const actualDirs = new Set(context.repoStructure.directories);

    // Check required files from spec tree
    const requiredFiles = this.extractRequiredFiles(specTree);
    for (const requiredFile of requiredFiles) {
      if (!actualFiles.has(requiredFile.path)) {
        findings.push(this.createFinding({
          severity: 'high',
          specArea: 'architecture',
          specElementRef: `RepoStructure:file:${requiredFile.path}`,
          explanation: `Required file "${requiredFile.path}" defined in repo structure spec but not found in repository`,
          filePath: undefined,
          lineNumber: undefined,
        }));
      }
    }

    // Check required directories from spec tree
    const requiredDirs = this.extractRequiredDirs(specTree);
    for (const requiredDir of requiredDirs) {
      if (!actualDirs.has(requiredDir)) {
        findings.push(this.createFinding({
          severity: 'medium',
          specArea: 'architecture',
          specElementRef: `RepoStructure:dir:${requiredDir}`,
          explanation: `Required directory "${requiredDir}" defined in repo structure spec but not found in repository`,
          filePath: undefined,
          lineNumber: undefined,
        }));
      }
    }

    // Check for unexpected files in critical locations
    const criticalPaths = ['src/', 'tests/', 'package.json', 'tsconfig.json'];
    for (const criticalPath of criticalPaths) {
      const hasCritical = actualFiles.has(criticalPath) || actualDirs.has(criticalPath);
      if (!hasCritical) {
        findings.push(this.createFinding({
          severity: 'info',
          specArea: 'architecture',
          specElementRef: `RepoStructure:critical:${criticalPath}`,
          explanation: `Common project file/directory "${criticalPath}" not found in repository`,
          filePath: undefined,
          lineNumber: undefined,
        }));
      }
    }

    return {
      findings,
      durationMs: Date.now() - startTime,
      filesProcessed: context.repoStructure.files.length,
    };
  }

  private extractRequiredFiles(tree: any): { path: string; purpose?: string }[] {
    const files: { path: string; purpose?: string }[] = [];
    
    function walk(node: any, prefix: string = '') {
      if (!node) return;
      
      if (node.type === 'file') {
        files.push({
          path: prefix + node.name,
          purpose: node.purpose,
        });
      } else if (node.type === 'directory' && node.children) {
        for (const child of node.children) {
          walk(child, prefix + node.name + '/');
        }
      }
    }
    
    walk(tree);
    return files;
  }

  private extractRequiredDirs(tree: any): string[] {
    const dirs: string[] = [];
    
    function walk(node: any, prefix: string = '') {
      if (!node) return;
      
      if (node.type === 'directory') {
        const fullPath = prefix + node.name + '/';
        dirs.push(fullPath);
        
        if (node.children) {
          for (const child of node.children) {
            walk(child, fullPath);
          }
        }
      }
    }
    
    walk(tree);
    return dirs;
  }

  private createFinding(params: {
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    specArea: 'schema' | 'api_contract' | 'auth' | 'architecture' | 'other';
    specElementRef: string;
    explanation: string;
    filePath?: string;
    lineNumber?: number;
  }): DeterministicFinding {
    return {
      ...params,
      detectionTier: 'deterministic',
      status: 'open',
    };
  }
}