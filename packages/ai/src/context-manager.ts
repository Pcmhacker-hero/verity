/**
 * Context Manager — Doc 13 §8.
 *
 * Manages the assembly of prior artifacts into a token-efficient text representation
 * for inclusion in prompts. Helps prevent context window overflow.
 */

import type { ARTIFACT_TYPES } from '@verity/shared/types';

export class ArtifactDependencyManager {
  /**
   * Returns an array of artifact types that are required as context
   * to generate the target artifact. Order matters (chronological).
   */
  static getDependencies(target: typeof ARTIFACT_TYPES[number]): Array<typeof ARTIFACT_TYPES[number]> {
    switch (target) {
      case 'prd':
        return []; // Requires just the raw Idea text
      case 'architecture':
        return ['prd'];
      case 'schema':
        return ['prd', 'architecture'];
      case 'api':
        return ['prd', 'architecture', 'schema'];
      case 'repo_structure':
        return ['architecture', 'api'];
      case 'roadmap':
        return ['prd', 'architecture'];
      case 'tasks':
        return ['prd', 'architecture', 'schema', 'api', 'roadmap'];
      default:
        return [];
    }
  }
}

export class ContextManager {
  /**
   * Serializes a dictionary of artifacts into a compact Markdown representation.
   * To save tokens, we strip excessive metadata and format densely.
   */
  static serializeContext(artifacts: Record<string, any>): string {
    let contextString = '';

    if (artifacts['prd']) {
      contextString += `\n<PRD>\n${JSON.stringify(artifacts['prd'])}\n</PRD>\n`;
    }

    if (artifacts['architecture']) {
      contextString += `\n<Architecture>\n${JSON.stringify(artifacts['architecture'])}\n</Architecture>\n`;
    }

    if (artifacts['schema']) {
      contextString += `\n<DatabaseSchema>\n${JSON.stringify(artifacts['schema'])}\n</DatabaseSchema>\n`;
    }

    if (artifacts['api']) {
      contextString += `\n<APISpecification>\n${JSON.stringify(artifacts['api'])}\n</APISpecification>\n`;
    }

    if (artifacts['roadmap']) {
      contextString += `\n<Roadmap>\n${JSON.stringify(artifacts['roadmap'])}\n</Roadmap>\n`;
    }

    return contextString.trim();
  }
}
