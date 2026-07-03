/**
 * Schema Checker — Tier 1 Deterministic Verification.
 * Verifies database entities and fields exist in repository.
 */

import type { Checker, VerificationContext, CheckerResult, DeterministicFinding, ParsedFile, ParsedModel, ParsedField } from './types.js';
import { parseRepo } from '../utils/ast.js';

export class SchemaChecker implements Checker {
  name = 'schema-checker';

  async check(context: VerificationContext): Promise<CheckerResult> {
    const startTime = Date.now();
    const findings: DeterministicFinding[] = [];

    // Parse repository files
    const parsedFiles = parseRepo(context.repoStructure);

    // Build map of actual models found in repo
    const actualModels = new Map<string, ParsedModel>();
    for (const [filePath, parsed] of parsedFiles) {
      for (const model of parsed.models) {
        actualModels.set(model.name.toLowerCase(), { ...model, filePath });
      }
    }

    // Check each spec entity
    for (const specEntity of context.specArtifacts.schemaEntities) {
      const actualModel = actualModels.get(specEntity.name.toLowerCase());

      if (!actualModel) {
        findings.push(this.createFinding({
          severity: 'critical',
          specArea: 'schema',
          specElementRef: `SchemaEntity:${specEntity.id}`,
          explanation: `Entity "${specEntity.name}" defined in spec but not found in repository`,
          filePath: undefined,
          lineNumber: undefined,
        }));
        continue;
      }

      // Check fields for this entity
      const specFields = context.specArtifacts.schemaFields.get(specEntity.id) || [];
      
      for (const specField of specFields) {
        const actualField = actualModel.fields.find(f => 
          f.name.toLowerCase() === specField.name.toLowerCase()
        );

        if (!actualField) {
          findings.push(this.createFinding({
            severity: 'high',
            specArea: 'schema',
            specElementRef: `SchemaField:${specField.id}`,
            explanation: `Field "${specField.name}" on entity "${specEntity.name}" defined in spec but not found in repository`,
            filePath: actualModel.filePath,
            lineNumber: actualModel.lineNumber,
          }));
          continue;
        }

        // Check field type matches
        if (!this.typesMatch(specField.dataType, actualField.type)) {
          findings.push(this.createFinding({
            severity: 'medium',
            specArea: 'schema',
            specElementRef: `SchemaField:${specField.id}`,
            explanation: `Field "${specField.name}" on entity "${specEntity.name}" has type "${specField.dataType}" in spec but "${actualField.type}" in repository`,
            filePath: actualModel.filePath,
            lineNumber: actualField.lineNumber || actualModel.lineNumber,
          }));
        }

        // Check required
        if (specField.isRequired && !actualField.isRequired) {
          findings.push(this.createFinding({
            severity: 'medium',
            specArea: 'schema',
            specElementRef: `SchemaField:${specField.id}`,
            explanation: `Field "${specField.name}" on entity "${specEntity.name}" is required in spec but optional in repository`,
            filePath: actualModel.filePath,
            lineNumber: actualField.lineNumber || actualModel.lineNumber,
          }));
        }

        // Check unique
        if (specField.isUnique && !actualField.isUnique) {
          findings.push(this.createFinding({
            severity: 'low',
            specArea: 'schema',
            specElementRef: `SchemaField:${specField.id}`,
            explanation: `Field "${specField.name}" on entity "${specEntity.name}" is unique in spec but not marked unique in repository`,
            filePath: actualModel.filePath,
            lineNumber: actualField.lineNumber || actualModel.lineNumber,
          }));
        }

        // Check foreign key
        if (specField.foreignKeyRef && !actualField.isForeignKey) {
          findings.push(this.createFinding({
            severity: 'medium',
            specArea: 'schema',
            specElementRef: `SchemaField:${specField.id}`,
            explanation: `Field "${specField.name}" on entity "${specEntity.name}" references "${specField.foreignKeyRef}" in spec but not a foreign key in repository`,
            filePath: actualModel.filePath,
            lineNumber: actualField.lineNumber || actualModel.lineNumber,
          }));
        }
      }
    }

    // Check for extra entities in repo not in spec
    const specEntityNames = new Set(context.specArtifacts.schemaEntities.map(e => e.name.toLowerCase()));
    for (const [name, model] of actualModels) {
      if (!specEntityNames.has(name)) {
        findings.push(this.createFinding({
          severity: 'info',
          specArea: 'schema',
          specElementRef: `SchemaEntity:repo:${name}`,
          explanation: `Entity "${model.name}" exists in repository but not defined in spec`,
          filePath: model.filePath,
          lineNumber: model.lineNumber,
        }));
      }
    }

    return {
      findings,
      durationMs: Date.now() - startTime,
      filesProcessed: parsedFiles.size,
    };
  }

  private typesMatch(specType: string, actualType: string): boolean {
    const normalize = (t: string) => t.toLowerCase().replace(/[<>\[\]]/g, '');
    const specNorm = normalize(specType);
    const actualNorm = normalize(actualType);

    // Direct match
    if (specNorm === actualNorm) return true;

    // Common type aliases
    const typeAliases: Record<string, string[]> = {
      'string': ['string', 'text', 'varchar'],
      'number': ['number', 'integer', 'int', 'float', 'decimal', 'bigint'],
      'boolean': ['boolean', 'bool'],
      'date': ['date', 'datetime', 'timestamp'],
      'uuid': ['uuid', 'guid'],
      'json': ['json', 'jsonb', 'object'],
    };

    for (const [canonical, aliases] of Object.entries(typeAliases)) {
      if (aliases.includes(specNorm) && aliases.includes(actualNorm)) {
        return true;
      }
    }

    return false;
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