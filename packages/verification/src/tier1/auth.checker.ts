/**
 * Auth Checker — Tier 1 Deterministic Verification.
 * Verifies authentication and authorization implementation in repository.
 */

import type { Checker, VerificationContext, CheckerResult, DeterministicFinding, ParsedMiddleware, RepoStructure, ParsedFile } from './types.js';
import { parseRepo } from '../utils/ast.js';

export class AuthChecker implements Checker {
  name = 'auth-checker';

  async check(context: VerificationContext): Promise<CheckerResult> {
    const startTime = Date.now();
    const findings: DeterministicFinding[] = [];

    // Parse repository files to extract middlewares
    const parsedFiles = parseRepo(context.repoStructure);
    const authMiddlewares = this.extractAuthMiddlewares(parsedFiles);
    const roleMiddlewares = this.extractRoleMiddlewares(parsedFiles);

    // Check if any auth middleware exists globally
    const hasGlobalAuth = authMiddlewares.some(m => m.isGlobal);
    const hasGlobalRole = roleMiddlewares.some(m => m.isGlobal);

    // If spec has any endpoints with authRequired=true, ensure auth middleware exists
    const specHasAuthEndpoints = context.specArtifacts.apiEndpoints.some(e => e.authRequired);
    if (specHasAuthEndpoints && !hasGlobalAuth && authMiddlewares.length === 0) {
      findings.push(this.createFinding({
        severity: 'critical',
        specArea: 'auth',
        specElementRef: 'Auth:global',
        explanation: 'Spec requires authentication on some endpoints but no authentication middleware detected in repository',
        filePath: undefined,
        lineNumber: undefined,
      }));
    }

    // Check each endpoint's auth requirements against detected middlewares
    for (const specEndpoint of context.specArtifacts.apiEndpoints) {
      if (specEndpoint.authRequired) {
        const routeAuth = authMiddlewares.find(m => 
          m.routes.some(r => this.pathMatches(specEndpoint.path, r.path) && r.method === specEndpoint.method)
        );
        
        if (!routeAuth && !hasGlobalAuth) {
          findings.push(this.createFinding({
            severity: 'critical',
            specArea: 'auth',
            specElementRef: `APIEndpoint:${specEndpoint.id}`,
            explanation: `Endpoint ${specEndpoint.method} ${specEndpoint.path} requires authentication but no auth middleware found on route or globally`,
            filePath: undefined,
            lineNumber: undefined,
          }));
        }
      }

      if (specEndpoint.requiredRole) {
        const routeRole = roleMiddlewares.find(m => 
          m.routes.some(r => this.pathMatches(specEndpoint.path, r.path) && r.method === specEndpoint.method)
        );
        
        if (!routeRole && !hasGlobalRole) {
          findings.push(this.createFinding({
            severity: 'high',
            specArea: 'auth',
            specElementRef: `APIEndpoint:${specEndpoint.id}`,
            explanation: `Endpoint ${specEndpoint.method} ${specEndpoint.path} requires role "${specEndpoint.requiredRole}" but no role-based authorization middleware found`,
            filePath: undefined,
            lineNumber: undefined,
          }));
        }
      }
    }

    // Check for common auth patterns (JWT, session, etc.)
    const hasJwt = authMiddlewares.some(m => m.type === 'jwt');
    const hasSession = authMiddlewares.some(m => m.type === 'session');
    const hasPassport = authMiddlewares.some(m => m.type === 'passport');
    
    if (!hasJwt && !hasSession && !hasPassport && authMiddlewares.length > 0) {
      const firstAuthMiddleware = authMiddlewares[0];
      if (firstAuthMiddleware) {
        findings.push(this.createFinding({
          severity: 'info',
          specArea: 'auth',
          specElementRef: 'Auth:pattern',
          explanation: 'Custom authentication middleware detected; consider using standard patterns (JWT, session, Passport) for better verification',
          filePath: firstAuthMiddleware.filePath,
          lineNumber: firstAuthMiddleware.lineNumber,
        }));
      }
    }

    return {
      findings,
      durationMs: Date.now() - startTime,
      filesProcessed: parsedFiles.size,
    };
  }

  private extractAuthMiddlewares(parsedFiles: Map<string, ParsedFile>): Array<{
    name: string;
    type: 'jwt' | 'session' | 'passport' | 'custom';
    isGlobal: boolean;
    routes: { path: string; method: string }[];
    filePath: string;
    lineNumber: number;
  }> {
    const middlewares: any[] = [];

    for (const [filePath, parsed] of parsedFiles) {
      for (const mw of parsed.middlewares) {
        if (mw.type === 'auth') {
          let authType: 'jwt' | 'session' | 'passport' | 'custom' = 'custom';
          const nameLower = mw.name.toLowerCase();
          if (nameLower.includes('jwt') || nameLower.includes('token')) authType = 'jwt';
          else if (nameLower.includes('session')) authType = 'session';
          else if (nameLower.includes('passport')) authType = 'passport';

          middlewares.push({
            name: mw.name,
            type: authType,
            isGlobal: mw.isGlobal || false,
            routes: mw.routes || [],
            filePath,
            lineNumber: mw.lineNumber,
          });
        }
      }
    }

    return middlewares;
  }

  private extractRoleMiddlewares(parsedFiles: Map<string, ParsedFile>): Array<{
    name: string;
    roles: string[];
    isGlobal: boolean;
    routes: { path: string; method: string }[];
    filePath: string;
    lineNumber: number;
  }> {
    const middlewares: any[] = [];

    for (const [filePath, parsed] of parsedFiles) {
      for (const mw of parsed.middlewares) {
        if (mw.type === 'authorization') {
          // Extract roles from middleware name or config
          const roles = this.extractRolesFromMiddleware(mw.name);
          
          middlewares.push({
            name: mw.name,
            roles,
            isGlobal: mw.isGlobal || false,
            routes: mw.routes || [],
            filePath,
            lineNumber: mw.lineNumber,
          });
        }
      }
    }

    return middlewares;
  }

  private extractRolesFromMiddleware(name: string): string[] {
    // Try to extract role names from middleware name
    // e.g., "requireRole('admin')" -> ["admin"]
    const roleMatches = name.match(/['"`]([^'"`]+)['"`]/g);
    if (roleMatches) {
      return roleMatches.map(m => m.slice(1, -1));
    }
    return [];
  }

  private pathMatches(specPath: string, repoPath: string): boolean {
    const normalize = (p: string) => p.replace(/\{([^}]+)\}/g, ':param').replace(/:([^/]+)/g, ':param');
    return normalize(specPath) === normalize(repoPath);
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