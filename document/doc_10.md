# Document 10: Data Model

## 1. Purpose and Scope

This document defines the persistent data model underlying Documents 4, 8, and 9 — the actual entities, fields, relationships, and constraints, not the conceptual containment hierarchy (Document 8 §3) or the feature list (Document 9). It is the schema Document 11 (System Architecture) builds services around and Document 13 (AI Architecture) generates structured output into. Postgres is assumed throughout, consistent with Document 5 §4's managed-Postgres encryption-at-rest requirement.

Naming convention: entities are singular PascalCase (e.g., `Project`), matching typical ORM/ Zod-schema conventions referenced in Document 5 §5's shared-type-contract requirement.

## 2. Design Principles

1. **Multi-tenancy from day one, invisible in v1.** Every entity below traces to a Workspace, even though v1 exposes exactly one Workspace per user with no team features (Document 4 §4, Document 5 §2). This is Document 1 Principle 2 and Document 5 §2's explicit scalability requirement made concrete — retrofitting tenancy later would touch every table.
2. **Immutability where trust depends on it.** SpecVersion and its child artifacts are never updated in place (Epic I1). Mutation always means "create a new version," never "overwrite a row." This is the data-layer foundation the entire verification trust model (Document 3) rests on.
3. **Structured over prose wherever verification touches it.** Schema and API artifacts store typed, queryable fields, not markdown blobs — per Document 4 §9 and Document 9 §4's flagged dependency, deterministic verification (Epic H1) is only as good as this being real.
4. **Every Finding is traceable to one SpecVersion and one spec element.** No orphaned findings — this is Epic H4's requirement expressed as a foreign-key constraint, not just a UI convention.
5. **Soft-delete over hard-delete for user-generated content**, with a hard-delete path available to satisfy Document 5 §10's data-export/deletion requirement on explicit request.

## 3. Entity Overview

```
Workspace
└── User (via Membership; v1: exactly one User per Workspace, Owner role only)
└── Project
    ├── SpecVersion (immutable; one "current" per Project, many historical)
    │   ├── PRDArtifact
    │   ├── ArchitectureArtifact
    │   ├── SchemaArtifact
    │   │   └── SchemaEntity → SchemaField
    │   ├── APIArtifact
    │   │   └── APIEndpoint
    │   ├── RepoStructureArtifact
    │   ├── RoadmapArtifact
    │   │   └── RoadmapPhase
    │   └── TaskArtifact
    │       └── Task
    ├── RepoConnection (0 or 1 per Project)
    └── VerificationRun (references exactly one SpecVersion)
        └── Finding
```

## 4. Core Entities

### 4.1 Workspace

| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| name | text | Defaults to "{User}'s Workspace" at auto-provisioning (Epic A1) |
| created_at | timestamptz | |

### 4.2 User

| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| email | text, unique | |
| auth_provider_id | text | Better Auth reference (Document 5 §4) |
| created_at | timestamptz | |

### 4.3 Membership

| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| workspace_id | UUID (FK → Workspace) | |
| user_id | UUID (FK → User) | |
| role | enum: `owner`, `admin`, `member` | v1: only `owner` is ever assigned (Document 4 §4); other values reserved, not enforced, for later phases |
| created_at | timestamptz | |

*Rationale for the join table existing at all in a one-user-per-workspace v1: this is the single piece of schema that lets Document 19's later team-features phase add collaborators without a migration that touches every downstream table — direct implementation of Design Principle 1.*

### 4.4 Project

| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| workspace_id | UUID (FK → Workspace) | |
| name | text | |
| current_spec_version_id | UUID (FK → SpecVersion, nullable) | Null until first generation completes |
| repo_connection_id | UUID (FK → RepoConnection, nullable) | |
| created_at, updated_at | timestamptz | |
| deleted_at | timestamptz, nullable | Soft delete (Design Principle 5) |

## 5. Spec & Artifact Entities

### 5.1 SpecVersion

| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| project_id | UUID (FK → Project) | |
| version_number | integer | Monotonically increasing per Project |
| created_at | timestamptz | |
| change_summary | text, nullable | Human-readable note on what changed (Epic I2's "summary of what changed") |
| source | enum: `generation`, `edit`, `regeneration` | Distinguishes how the version came to exist, useful for History screen (Document 8) context |

**Immutability enforcement:** no `updated_at` field exists on this table by design — any change produces a new row with an incremented `version_number`, referencing the prior version via `previous_version_id` for diffing (Epic I3).

| Additional field | Type | Notes |
|---|---|---|
| previous_version_id | UUID (FK → SpecVersion, nullable) | Null only for a Project's first version |

### 5.2 PRDArtifact

| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| spec_version_id | UUID (FK → SpecVersion) | |
| problem_statement | text | |
| target_users | jsonb | Structured list, editable per-entry (Epic B3) |
| features | jsonb | Structured, prioritized list |
| non_goals | jsonb | Structured list |
| success_criteria | jsonb | Structured list |
| narrative | text | Prose form, generated alongside structured fields (Epic B2) |

### 5.3 ArchitectureArtifact

| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| spec_version_id | UUID (FK → SpecVersion) | |
| components | jsonb | Array of `{ id, name, description, tech_choice, rationale, prd_feature_refs: [feature_id] }` — the `prd_feature_refs` array is the Epic C2 traceability requirement as a literal field |
| data_flow | jsonb | Structured edges between component ids, renderable per Document 8's diagram screen |

### 5.4 SchemaArtifact / SchemaEntity / SchemaField

Split into three tables rather than nested JSON — this is the artifact deterministic verification (Epic H1) depends on most (Document 9 §2), and flat, queryable rows are materially easier to check against than parsing nested JSON at verification time.

**SchemaArtifact**

| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| spec_version_id | UUID (FK → SpecVersion) | |

**SchemaEntity**

| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| schema_artifact_id | UUID (FK → SchemaArtifact) | |
| name | text | e.g., "User", "Project" (product-level entities, not this document's own tables) |
| architecture_component_ref | UUID, nullable | Traceability to ArchitectureArtifact.components[].id |

**SchemaField**

| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| schema_entity_id | UUID (FK → SchemaEntity) | |
| name | text | |
| data_type | text | |
| is_required | boolean | |
| is_unique | boolean | |
| foreign_key_ref | UUID, nullable | References another SchemaEntity.id |

### 5.5 APIArtifact / APIEndpoint

**APIArtifact**

| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| spec_version_id | UUID (FK → SpecVersion) | |

**APIEndpoint**

| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| api_artifact_id | UUID (FK → APIArtifact) | |
| method | enum: GET/POST/PUT/PATCH/DELETE | |
| path | text | |
| request_shape | jsonb | |
| response_shape | jsonb | |
| **auth_required** | boolean | Explicit, not inferred — Document 4 Epic E2's single most important field |
| **required_role** | text, nullable | Supports the "wrong role" semantic-check scenario (Document 4 Epic H2) |
| schema_entity_refs | UUID[] | Traceability to SchemaEntity |

### 5.6 RepoStructureArtifact, RoadmapArtifact/RoadmapPhase, TaskArtifact/Task

| Entity | Key fields | Notes |
|---|---|---|
| RepoStructureArtifact | `spec_version_id`, `tree` (jsonb, nested folder/file structure with purpose notes) | Epic F1 |
| RoadmapArtifact | `spec_version_id` | Container only; phases below |
| RoadmapPhase | `roadmap_artifact_id`, `order`, `name`, `description` | Sequencing per Epic F2 |
| TaskArtifact | `spec_version_id` | Container only; tasks below |
| Task | `task_artifact_id`, `roadmap_phase_id`, `title`, `description`, `prd_feature_ref`, `architecture_component_ref`, `schema_entity_refs[]`, `api_endpoint_refs[]` | The four `*_ref` fields are Epic F3's traceability requirement, literally enforced as foreign keys rather than descriptive text |

## 6. Verification Entities

### 6.1 RepoConnection

| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| project_id | UUID (FK → Project) | |
| github_repo_full_name | text | e.g., `priya/my-saas` |
| oauth_token_ref | text | Reference to token in a secrets store, never the raw token itself — Document 5 §4's "never persisted in plaintext" requirement |
| connected_at | timestamptz | |

### 6.2 VerificationRun

| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| project_id | UUID (FK → Project) | |
| spec_version_id | UUID (FK → SpecVersion) | Fixed at trigger time — this is Epic H4's traceability requirement |
| status | enum: `queued`, `running_deterministic`, `running_semantic`, `complete`, `failed` | Supports Document 5 §3's resumability and Document 8 §7's progress-state requirement |
| triggered_at, completed_at | timestamptz | |
| commit_sha | text | Exact repo state checked, for reproducibility |

### 6.3 Finding

| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| verification_run_id | UUID (FK → VerificationRun) | |
| severity | enum: `critical`, `high`, `medium`, `low`, `info` | Per Document 9 §3's taxonomy |
| spec_area | enum: `auth`, `schema`, `api_contract`, `architecture`, `other` | Powers Document 8's spec-area grouping |
| spec_element_ref | text | Points to the specific violated element (e.g., `APIEndpoint.id`) — Design Principle 4 |
| file_path | text, nullable | Null permitted for architecture-level findings with no single file locus |
| line_number | integer, nullable | |
| explanation | text | Plain-language, per Epic H3 |
| detection_tier | enum: `deterministic`, `semantic` | Which check tier produced it — useful for internal quality tracking, not necessarily user-facing |
| status | enum: `open`, `acknowledged` | `acknowledged` maps to Epic H6 (Later) — column exists now since it's zero-cost to add and avoids a later migration |

## 7. Indexes and Constraints Worth Calling Out Early

- `SpecVersion(project_id, version_number)` — unique composite index; this is the constraint that makes version integrity enforceable at the database level, not just application logic.
- `Project.current_spec_version_id` — foreign key with `ON DELETE RESTRICT`, not cascade; a Project should never silently lose its pointer to a valid current version.
- `VerificationRun.spec_version_id` — foreign key with `ON DELETE RESTRICT` for the same reason as above; historical runs (Document 8 §3's cardinality note) must remain valid even if a SpecVersion is otherwise archived.
- `Finding.verification_run_id` — cascade delete is acceptable here only if a VerificationRun itself is hard-deleted, which per Design Principle 5 should be rare and explicit.

## 8. What This Document Deliberately Does Not Specify

- Exact jsonb internal shapes beyond what's needed to show traceability and verification-readiness — full Zod schema definitions are Document 13's responsibility (AI Architecture), since they're tied to LLM structured-output design, not just storage.
- Indexing/performance tuning beyond the constraints above — Document 18 (Scalability Strategy).
- Secrets storage mechanism for `oauth_token_ref` — Document 16 (Security Architecture).

## 9. Open Questions Carried Into Later Documents

- Whether SchemaEntity/SchemaField should additionally store a denormalized jsonb snapshot for fast diffing (Epic I3), or whether diffing should be computed on read from the normalized tables — resolved in Document 11 (System Architecture) as a service-design tradeoff, not a schema-design one.
- Exact enum values for `spec_area` may need extension once Document 13 finalizes the full taxonomy of checkable spec elements — this table is intentionally not exhaustive yet.
- Whether `Task.roadmap_phase_id` should be nullable to support tasks generated before roadmap phasing is finalized (per Document 9 §6's sequencing question) — resolved once Document 19 settles that ordering question.