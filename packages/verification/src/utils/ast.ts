/**
 * AST Parsing Utilities — Doc 11 §6, Doc 13 §9.
 *
 * Language detection and AST parsing for Tier 1 deterministic verification.
 * Supports TypeScript/JavaScript (Node.js/Express) initially.
 * Extensible for future languages (Python, Go, Java, etc.).
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname, relative, basename } from 'path';
import type { RepoFile, RepoStructure, LanguageParser, ParsedFile, ParsedRoute, ParsedController, ParsedMiddleware, ParsedModel, ParsedField } from '../tier1/types.js';

export const SUPPORTED_EXTENSIONS = ['.ts', '.js', '.tsx', '.jsx'] as const;
export type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number];

export const LANGUAGE_MAP: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
};

export function detectLanguage(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  return LANGUAGE_MAP[ext] || 'unknown';
}

export function isSupportedFile(filePath: string): boolean {
  const ext = extname(filePath).toLowerCase();
  return SUPPORTED_EXTENSIONS.includes(ext as SupportedExtension);
}

export function shouldIgnoreDirectory(dirName: string): boolean {
  const ignoreDirs = ['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.vercel', 'vendor'];
  return ignoreDirs.includes(dirName);
}

export function discoverRepoFiles(rootPath: string): RepoStructure {
  const files: RepoFile[] = [];
  const directories: string[] = [];

  function walk(dir: string): void {
    const entries = readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      
      if (entry.isDirectory()) {
        if (!shouldIgnoreDirectory(entry.name)) {
          directories.push(relative(rootPath, fullPath));
          walk(fullPath);
        }
      } else if (entry.isFile() && isSupportedFile(entry.name)) {
        const content = readFileSync(fullPath, 'utf-8');
        files.push({
          path: relative(rootPath, fullPath),
          content,
          language: detectLanguage(entry.name),
        });
      }
    }
  }

  walk(rootPath);
  return { files, directories, rootPath };
}

export function filterRepoFiles(repoStructure: RepoStructure, pattern?: RegExp): RepoFile[] {
  if (!pattern) return repoStructure.files;
  return repoStructure.files.filter(f => pattern.test(f.path));
}

// Simple regex-based parsers for common patterns (TypeScript/JavaScript/Express)
// These are fallbacks; tree-sitter would be more robust but requires native deps

const ROUTE_REGEX = /(?:app|router)\.(get|post|put|patch|delete|head|options)\s*\(\s*['"`]([^'"`]+)['"`]/g;
const CONTROLLER_REGEX = /(?:class|const)\s+(\w+Controller)\s*(?:extends\s+\w+)?\s*{/g;
const MIDDLEWARE_REGEX = /(?:app|router)\.use\s*\(\s*(?:['"`]([^'"`]+)['"`]\s*,\s*)?(\w+)/g;
const AUTH_MIDDLEWARE_PATTERNS = [
  /auth(?:enticate)?/i,
  /requireAuth/i,
  /isAuthenticated/i,
  /jwt/i,
  /passport/i,
  /session/i,
];
const ROLE_MIDDLEWARE_PATTERNS = [
  /requireRole/i,
  /hasRole/i,
  /checkRole/i,
  /authorize/i,
  /permission/i,
];
const MODEL_REGEX = /(?:class|interface|type)\s+(\w+)\s*(?:extends\s+\w+)?\s*{/g;
const FIELD_REGEX = /(\w+)\s*:\s*(\w+(?:<\w+>)?(?:\[])?)\s*[?]?(?:;|,)/g;

export function parseTypeScriptFile(filePath: string, content: string): ParsedFile {
  const routes: ParsedRoute[] = [];
  const controllers: ParsedController[] = [];
  const middlewares: ParsedMiddleware[] = [];
  const models: ParsedModel[] = [];
  const imports: string[] = [];

  // Extract imports
  const importRegex = /import\s+.*?from\s+['"`]([^'"`]+)['"`]/g;
  let importMatch;
  while ((importMatch = importRegex.exec(content)) !== null) {
    if (importMatch[1]) imports.push(importMatch[1]);
  }

  // Extract routes
  let routeMatch;
  while ((routeMatch = ROUTE_REGEX.exec(content)) !== null) {
    const method = routeMatch[1]?.toUpperCase() || 'UNKNOWN';
    const path = routeMatch[2] || '';
    const lineNumber = content.substring(0, routeMatch.index).split('\n').length;
    
    // Try to find handler and middlewares in the same call
    const callStart = routeMatch.index;
    const callEnd = content.indexOf(')', callStart);
    const callContent = content.substring(callStart, callEnd);
    
    const middlewareMatches = [...callContent.matchAll(/(\w+)/g)].filter(m => 
      m[1] && !['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(m[1].toLowerCase())
      && m[1] !== path
    );
    
    const lastMiddleware = middlewareMatches[middlewareMatches.length - 1];
    const handler = lastMiddleware && lastMiddleware[1] ? lastMiddleware[1] : 'unknown';
    const middlewares = middlewareMatches.slice(0, -1).map(m => m[1]).filter((v): v is string => Boolean(v));
    
    routes.push({
      method,
      path,
      handler,
      middlewares,
      lineNumber,
    });
  }

  // Extract controllers (simplified)
  let controllerMatch;
  while ((controllerMatch = CONTROLLER_REGEX.exec(content)) !== null) {
    const name = controllerMatch[1] || 'Unknown';
    const lineNumber = content.substring(0, controllerMatch.index).split('\n').length;
    controllers.push({ name, routes: [], lineNumber });
  }

  // Extract middlewares
  let middlewareMatch;
  while ((middlewareMatch = MIDDLEWARE_REGEX.exec(content)) !== null) {
    const path = middlewareMatch[1] || '';
    const name = middlewareMatch[2] || '';
    const lineNumber = content.substring(0, middlewareMatch.index).split('\n').length;
    
    let type: 'auth' | 'authorization' | 'validation' | 'other' = 'other';
    if (AUTH_MIDDLEWARE_PATTERNS.some(p => p.test(name))) type = 'auth';
    else if (ROLE_MIDDLEWARE_PATTERNS.some(p => p.test(name))) type = 'authorization';
    else if (name.toLowerCase().includes('valid')) type = 'validation';
    
    middlewares.push({ name, type, lineNumber });
  }

// Extract models (simplified for TypeScript interfaces/classes)
  let modelMatch;
  while ((modelMatch = MODEL_REGEX.exec(content)) !== null) {
    const name = modelMatch[1] || 'Unknown';
    const lineNumber = content.substring(0, modelMatch.index).split('\n').length;
    
    // Find the class/interface body to extract fields
    const bodyStart = content.indexOf('{', modelMatch.index);
    if (bodyStart !== -1) {
      const bodyEnd = findMatchingBrace(content, bodyStart);
      if (bodyEnd !== -1) {
        const bodyContent = content.substring(bodyStart + 1, bodyEnd);
        const fields: ParsedField[] = [];
        
        let fieldMatch;
        while ((fieldMatch = FIELD_REGEX.exec(bodyContent)) !== null) {
          const fieldName = fieldMatch[1] || 'unknown';
          const fieldType = fieldMatch[2] || 'any';
          const isOptional = content.charAt(fieldMatch.index + fieldMatch[0].length - 1) === '?';
          const isRequired = !isOptional;
          
          fields.push({
            name: fieldName,
            type: fieldType,
            isRequired,
            isUnique: false,
            isForeignKey: fieldName.endsWith('Id') && fieldType !== 'string' && fieldType !== 'number',
            referencedModel: fieldName.endsWith('Id') ? fieldName.slice(0, -2) : undefined,
          });
        }
        
models.push({ name, fields, lineNumber });
      }
    }
  }
  
  return { routes, controllers, middlewares, models, imports };
}

function findMatchingBrace(content: string, startIndex: number): number {
  let depth = 1;
  for (let i = startIndex + 1; i < content.length; i++) {
    if (content[i] === '{') depth++;
    else if (content[i] === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

export function parseJavaScriptFile(filePath: string, content: string): ParsedFile {
  // Same logic as TypeScript for now
  return parseTypeScriptFile(filePath, content);
}

export function parseFile(filePath: string, content: string): ParsedFile {
  const ext = extname(filePath).toLowerCase();
  if (ext === '.ts' || ext === '.tsx') return parseTypeScriptFile(filePath, content);
  if (ext === '.js' || ext === '.jsx') return parseJavaScriptFile(filePath, content);
  return { routes: [], controllers: [], middlewares: [], models: [], imports: [] };
}

export function parseRepo(repoStructure: RepoStructure): Map<string, ParsedFile> {
  const parsedFiles = new Map<string, ParsedFile>();
  
  for (const file of repoStructure.files) {
    try {
      const parsed = parseFile(file.path, file.content);
      if (parsed.routes.length > 0 || parsed.controllers.length > 0 || 
          parsed.middlewares.length > 0 || parsed.models.length > 0) {
        parsedFiles.set(file.path, parsed);
      }
    } catch (error) {
      console.warn(`Failed to parse ${file.path}:`, error);
    }
  }
  
  return parsedFiles;
}