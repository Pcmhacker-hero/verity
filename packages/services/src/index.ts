/**
 * @verity/services — Business logic layer (modular monolith).
 *
 * Blueprint source: Doc 11 §3 (core services).
 * Each service module has a clean public interface.
 * Module boundaries enforced at the package level — no reaching into internals.
 */

export { AuthService } from './auth/index.js';
export { WorkspaceService } from './workspace/index.js';
export { SpecService } from './spec/index.js';
export { GenerationService } from './generation/index.js';
export { VerificationService } from './verification/index.js';
export { RepoService } from './repo/index.js';
export { FindingsService } from './findings/index.js';
