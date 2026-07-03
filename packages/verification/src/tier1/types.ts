/**
 * Tier 1 Verification Types — Doc 11 §6, Doc 10 §6.
 *
 * Shared types for deterministic verification checkers.
 */

export interface SpecArtifacts {
  schemaEntities: SchemaEntitySpec[];
  schemaFields: Map<string, SchemaFieldSpec[]>; // entityId -> fields
  apiEndpoints: ApiEndpointSpec[];
  repoStructure?: any; // JSON tree from RepoStructureArtifact
}

export interface SchemaEntitySpec {
  id: string;
  name: string;
  architectureComponentRef?: string;
}

export interface SchemaFieldSpec {
  id: string;
  schemaEntityId: string;
  name: string;
  dataType: string;
  isRequired: boolean;
  isUnique: boolean;
  foreignKeyRef?: string;
}

export interface ApiEndpointSpec {
  id: string;
  method: string;
  path: string;
  requestShape: Record<string, unknown>;
  responseShape: Record<string, unknown>;
  authRequired: boolean;
  requiredRole?: string;
  schemaEntityRefs: string[];
}

export interface RepoFile {
  path: string;
  content: string;
  language: string;
}

export interface RepoStructure {
  files: RepoFile[];
  directories: string[];
  rootPath: string;
}

export interface VerificationContext {
  specVersionId: string;
  specArtifacts: SpecArtifacts;
  repoStructure: RepoStructure;
  commitSha: string;
}

export interface CheckerResult {
  findings: DeterministicFinding[];
  durationMs: number;
  filesProcessed: number;
}

export interface Tier1Result {
  findings: DeterministicFinding[];
  durationMs: number;
  checkersRun: string[];
  filesProcessed: number;
}

export interface DeterministicFinding {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  specArea: 'schema' | 'api_contract' | 'auth' | 'architecture' | 'other';
  specElementRef: string;
  filePath?: string;
  lineNumber?: number;
  explanation: string;
  detectionTier: 'deterministic';
  status: 'open';
}

export type SpecArea = 'schema' | 'api_contract' | 'auth' | 'architecture' | 'other';
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface Checker {
  name: string;
  check(context: VerificationContext): Promise<CheckerResult>;
}

export interface LanguageParser {
  language: string;
  parse(filePath: string, content: string): ParsedFile;
}

export interface ParsedFile {
  routes: ParsedRoute[];
  controllers: ParsedController[];
  middlewares: ParsedMiddleware[];
  models: ParsedModel[];
  imports: string[];
}

export interface ParsedRoute {
  method: string;
  path: string;
  handler: string;
  middlewares: string[];
  lineNumber: number;
  filePath?: string;
  hasAuth?: boolean;
  requiredRoles?: string[];
}

export interface ParsedController {
  name: string;
  routes: ParsedRoute[];
  lineNumber: number;
}

export interface ParsedMiddleware {
  name: string;
  type: 'auth' | 'authorization' | 'validation' | 'other';
  lineNumber: number;
  isGlobal?: boolean;
  routes?: { path: string; method: string }[];
}

export interface ParsedModel {
  name: string;
  fields: ParsedField[];
  lineNumber: number;
  filePath?: string;
}

export interface ParsedField {
  name: string;
  type: string;
  isRequired: boolean;
  isUnique: boolean;
  isForeignKey: boolean;
  referencedModel?: string;
  lineNumber?: number;
}