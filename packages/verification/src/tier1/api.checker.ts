/**
 * API Checker — Tier 1 Deterministic Verification.
 * Verifies API endpoints exist in repository with correct methods, paths, auth.
 */

import type { Checker, VerificationContext, CheckerResult, DeterministicFinding, ApiEndpointSpec, ParsedRoute, ParsedFile } from './types.js';
import { parseRepo } from '../utils/ast.js';

export class ApiChecker implements Checker {
  name = 'api-checker';

  async check(context: VerificationContext): Promise<CheckerResult> {
    const startTime = Date.now();
    const findings: DeterministicFinding[] = [];

    // Parse repository files
    const parsedFiles = parseRepo(context.repoStructure);

    // Extract all routes from repo
    const repoRoutes = this.extractRoutes(parsedFiles);

    // Check each spec endpoint
    for (const specEndpoint of context.specArtifacts.apiEndpoints) {
      const matchingRoutes = this.findMatchingRoutes(specEndpoint, repoRoutes);

      if (matchingRoutes.length === 0) {
        findings.push(this.createFinding({
          severity: 'critical',
          specArea: 'api_contract',
          specElementRef: `APIEndpoint:${specEndpoint.id}`,
          explanation: `Endpoint ${specEndpoint.method} ${specEndpoint.path} defined in spec but not found in repository`,
          filePath: undefined,
          lineNumber: undefined,
        }));
        continue;
      }

      // Check for duplicates
      if (matchingRoutes.length > 1) {
        const firstRoute = matchingRoutes[0];
        if (firstRoute) {
          findings.push(this.createFinding({
            severity: 'high',
            specArea: 'api_contract',
            specElementRef: `APIEndpoint:${specEndpoint.id}`,
            explanation: `Duplicate endpoints found for ${specEndpoint.method} ${specEndpoint.path} in repository (${matchingRoutes.length} occurrences)`,
            filePath: firstRoute.filePath,
            lineNumber: firstRoute.lineNumber,
          }));
        }
      }

      // Check auth/role compliance on matching routes
      for (const route of matchingRoutes) {
        // Check authentication
        if (specEndpoint.authRequired && !route.hasAuth) {
          findings.push(this.createFinding({
            severity: 'critical',
            specArea: 'auth',
            specElementRef: `APIEndpoint:${specEndpoint.id}`,
            explanation: `Endpoint ${specEndpoint.method} ${specEndpoint.path} requires authentication in spec but no auth middleware detected in repository`,
            filePath: route.filePath,
            lineNumber: route.lineNumber,
          }));
        }

        // Check required role
        const requiredRoles = route.requiredRoles || [];
        if (specEndpoint.requiredRole && requiredRoles.length > 0) {
          const hasRole = requiredRoles.some(r => 
            r.toLowerCase() === specEndpoint.requiredRole!.toLowerCase()
          );
          if (!hasRole) {
            findings.push(this.createFinding({
              severity: 'high',
              specArea: 'auth',
              specElementRef: `APIEndpoint:${specEndpoint.id}`,
              explanation: `Endpoint ${specEndpoint.method} ${specEndpoint.path} requires role "${specEndpoint.requiredRole}" but repository has roles: ${requiredRoles.join(', ') || 'none'}`,
              filePath: route.filePath,
              lineNumber: route.lineNumber,
            }));
          }
        } else if (specEndpoint.requiredRole && requiredRoles.length === 0) {
          findings.push(this.createFinding({
            severity: 'high',
            specArea: 'auth',
            specElementRef: `APIEndpoint:${specEndpoint.id}`,
            explanation: `Endpoint ${specEndpoint.method} ${specEndpoint.path} requires role "${specEndpoint.requiredRole}" but no role-based auth detected in repository`,
            filePath: route.filePath,
            lineNumber: route.lineNumber,
          }));
        }
      }
    }

    // Check for extra routes in repo not in spec
    for (const [routeKey, routes] of repoRoutes) {
      const [method, path] = routeKey.split(':', 2);
      const methodStr = method || 'unknown';
      const pathStr = path || 'unknown';
      const specEndpoint = context.specArtifacts.apiEndpoints.find(e => 
        e.method === methodStr && e.path && this.pathMatches(e.path, pathStr)
      );
      
      if (!specEndpoint) {
        for (const route of routes) {
          findings.push(this.createFinding({
            severity: 'info',
            specArea: 'api_contract',
            specElementRef: `APIEndpoint:repo:${methodStr}:${pathStr}`,
            explanation: `Route ${methodStr} ${pathStr} exists in repository but not defined in spec`,
            filePath: route.filePath || undefined,
            lineNumber: route.lineNumber || undefined,
          }));
        }
      }
    }

    return {
      findings,
      durationMs: Date.now() - startTime,
      filesProcessed: parsedFiles.size,
    };
  }

  private extractRoutes(parsedFiles: Map<string, ParsedFile>): Map<string, ParsedRoute[]> {
    const routes = new Map<string, ParsedRoute[]>();
    
    for (const [filePath, parsed] of parsedFiles) {
      for (const route of parsed.routes) {
        const key = `${route.method}:${route.path}`;
        if (!routes.has(key)) {
          routes.set(key, []);
        }
        routes.get(key)!.push({ ...route, filePath });
      }
    }
    
    return routes;
  }

  private findMatchingRoutes(specEndpoint: ApiEndpointSpec, repoRoutes: Map<string, ParsedRoute[]>): ParsedRoute[] {
    const matching: ParsedRoute[] = [];
    
    for (const [routeKey, routes] of repoRoutes) {
      const [method, path] = routeKey.split(':', 2);
      const pathStr = path || '';
      
      if (method === specEndpoint.method && this.pathMatches(specEndpoint.path, pathStr)) {
        matching.push(...routes);
      }
    }
    
    return matching;
  }

  private pathMatches(specPath: string, repoPath: string): boolean {
    // Normalize paths: replace path params with placeholder
    const normalize = (p: string) => 
      p
        .replace(/\{([^}]+)\}/g, ':param')  // {id} -> :param
        .replace(/:([^/]+)/g, ':param')     // :id -> :param
        .replace(/\/+/g, '/')               // // -> /
        .replace(/\/$/, '');                // remove trailing slash
    
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