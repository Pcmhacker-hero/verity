/**
 * Artifact types — Doc 4 §3, Doc 10 §5.
 *
 * The 7 artifact types generated in the spec pipeline.
 * Order matters: each stage's prompt includes prior stages as context
 * (Doc 1 Principle 1: "every artifact derives from the one before it").
 */

export const ARTIFACT_TYPES = [
  'prd',
  'architecture',
  'schema',
  'api',
  'repo_structure',
  'roadmap',
  'tasks',
] as const;

export type ArtifactType = (typeof ARTIFACT_TYPES)[number];

/**
 * Artifact type metadata — display names, generation order, descriptions.
 */
export const ARTIFACT_TYPE_META: Record<
  ArtifactType,
  { label: string; order: number; description: string }
> = {
  prd: {
    label: 'Product Requirements',
    order: 1,
    description: 'Problem statement, users, features, non-goals, success criteria',
  },
  architecture: {
    label: 'Architecture',
    order: 2,
    description: 'Components, technology choices, data flow',
  },
  schema: {
    label: 'Data Schema',
    order: 3,
    description: 'Entities, fields, relationships, constraints',
  },
  api: {
    label: 'API Specification',
    order: 4,
    description: 'Endpoints, methods, auth, request/response shapes',
  },
  repo_structure: {
    label: 'Repository Structure',
    order: 5,
    description: 'Folder layout, file naming, module organization',
  },
  roadmap: {
    label: 'Roadmap',
    order: 6,
    description: 'Development phases and sequencing',
  },
  tasks: {
    label: 'Tasks',
    order: 7,
    description: 'Implementation tasks with cross-artifact traceability',
  },
};

/**
 * SpecVersion source — Doc 10 §5.1.
 * Distinguishes how a version came to exist.
 */
export type SpecVersionSource = 'generation' | 'edit' | 'regeneration';
