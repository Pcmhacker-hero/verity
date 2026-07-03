# Document 14: API Specification

## 1. Purpose and Scope

Document 11 defined the service-level architecture — the modules, the async job pattern, and the request lifecycles for generation and verification at a structural level. Document 10 defined what gets stored. Document 13 defines how the AI subsystems work internally. This document defines the concrete HTTP API contract that connects all three to the frontend: every route, every request/response shape, every error code, and every polling pattern the client needs to implement Document 12's screens against.

This is not a restatement of Document 10's schema or Document 11's service boundaries — it's the external interface those internal structures expose. Where a response shape maps directly to a Document 10 entity, this document references the entity rather than re-listing every field; where the response shape diverges from the storage model (view models, computed fields, omitted internal-only columns), the divergence is explicit and justified.

**What this document resolves:**
- The concrete HTTP contract for every Epic A–I feature from Document 4/9.
- The exact polling pattern for async jobs (Document 11 §4's client-side contract, left unspecified there).
- Standardized error response format (Document 12 §8's error states require a consistent API shape to render against).
- Rate limiting rules by route category (Document 5 §4's requirement, specified here per endpoint tier rather than as a blanket rule).
- Pagination patterns for list endpoints.

**What this document does not resolve:**
- Prompt engineering, structured output schemas for LLM calls, or AI pipeline internals — Document 13.
- OAuth token storage mechanics, threat model, or session internals — Document 16 (Security Architecture).
- Hosting, CDN, or environment configuration — Document 17 (Deployment Architecture).

---

## 2. API Design Principles

1. **RESTful with pragmatic exceptions.** Standard resource-oriented design for CRUD operations; RPC-style `POST` actions for operations that don't map cleanly to resource creation (triggering a generation run, triggering verification). The pragmatic exception is deliberate: forcing "create a VerificationRun resource" to masquerade as `POST /verification-runs` when the client's mental model is "verify my project" adds indirection without benefit. The route is named for what the user is doing, not for the database row it creates.

2. **JSON everywhere, Zod on both sides.** Request and response bodies are JSON. Zod schemas (Document 5 §5's shared-type-contract requirement) are defined once and consumed by three layers: API request validation, API response serialization, and frontend type generation. This document specifies the logical shape; the Zod definitions themselves are build-phase artifacts derived from these shapes.

3. **Async by default for anything touching an LLM or external API.** Per Document 11 §4, generation and verification routes return `202 Accepted` with a job ID immediately; the client polls a status endpoint. No generation or verification route ever blocks the HTTP request cycle waiting for an LLM response — this is a non-negotiable architectural constraint (Document 5 §3, §9), not a convenience.

4. **Responses are view models, not raw entities.** The API never exposes raw database rows. Every response shape is a deliberate projection: internal-only fields (`auth_provider_id`, `oauth_token_ref`, `deleted_at`, `detection_tier` in most contexts) are stripped; computed fields (like the version-context-bar status from Document 12 §3.2) are added. This separation is what lets the data model evolve without breaking the client contract.

5. **Errors are structured and actionable.** Every error response follows one format (§4.3). No endpoint ever returns a bare HTTP status code without a body, and no error body ever contains a raw exception message or stack trace — Document 12 §8's "what happened / what the system did / what to do next" pattern requires the API to provide enough structured information for the frontend to render all three.

6. **Tenant isolation is implicit.** Every authenticated request is scoped to the requesting user's Workspace (Document 10's multi-tenancy model). No endpoint accepts a `workspace_id` parameter — it's derived from the session. A request for a Project that belongs to a different Workspace returns `404`, not `403`, to avoid leaking existence information (a security posture Document 16 will formalize).

---

## 3. Authentication

### 3.1 Mechanism

Better Auth (Document 5 §4, Document 11 §3) handles authentication. Auth routes are Better Auth's own endpoints, mounted at `/api/auth/*`. This document does not redefine Better Auth's built-in routes (signup, login, logout, session refresh, OAuth callbacks) — those follow Better Auth's documentation and are configured, not custom-built.

### 3.2 Session contract

Every non-auth API request must include a valid session cookie (set by Better Auth at login). The API layer validates the session before any route handler executes. Absent or invalid sessions receive:

```
401 Unauthorized
{
  "error": {
    "code": "AUTH_SESSION_INVALID",
    "message": "Session expired or invalid. Please log in again.",
    "action": "redirect_to_login"
  }
}
```

The `action` field is what lets the frontend implement Document 12 §8's "redirected to login with destination preserved" behavior — the client knows to redirect, not show an inline error.

### 3.3 GitHub OAuth (Epic G1)

GitHub repository connection uses a separate OAuth flow (read-only scope, per Document 5 §4). This is distinct from Better Auth's user authentication:

- `GET /api/github/authorize` — initiates the GitHub OAuth flow, returns a redirect URL.
- `GET /api/github/callback` — handles the OAuth callback, stores the token reference (Document 10 §6.1's `oauth_token_ref`), and redirects back to the Repo Connection screen.

These routes are detailed in §8 below.

---

## 4. Common Patterns

### 4.1 Pagination

All list endpoints support cursor-based pagination rather than offset-based. Rationale: the primary list that could grow large enough to matter is Findings (a verification run on a real repository could produce dozens to hundreds), and cursor-based pagination is stable under concurrent writes (new findings being added while paginating) where offset-based is not.

**Request parameters (query string):**

| Parameter | Type | Default | Notes |
|---|---|---|---|
| `cursor` | string, optional | `null` (first page) | Opaque cursor from a previous response's `nextCursor` |
| `limit` | integer, optional | `20` | Max items per page; capped at `100` server-side |

**Response envelope:**

```json
{
  "data": [ ... ],
  "pagination": {
    "nextCursor": "eyJpZCI6Ij...",
    "hasMore": true
  }
}
```

`nextCursor` is `null` when no more pages exist. The cursor is opaque to the client — internally it encodes the last item's sort key, but the client must never parse or construct it.

**Endpoints using pagination:** Projects List (§5), Version History (§9), Verification Runs list (§10), Findings list (§11).

### 4.2 Async Job Polling

Per Document 11 §4, generation and verification operations are asynchronous. The contract:

**Initiation:** the trigger endpoint returns `202 Accepted` with a job reference:

```json
{
  "jobId": "uuid",
  "status": "queued",
  "pollUrl": "/api/jobs/{jobId}"
}
```

**Polling:** the client polls `GET /api/jobs/:jobId` at a recommended interval:

```json
{
  "jobId": "uuid",
  "type": "generation" | "verification",
  "status": "queued" | "running" | "complete" | "failed",
  "stage": "prd" | "architecture" | "schema" | "api" | "repo_structure" | "roadmap" | "tasks" | "deterministic" | "semantic",
  "progress": {
    "currentStep": "Generating architecture...",
    "stepsCompleted": 2,
    "stepsTotal": 7
  },
  "result": { ... },
  "error": { ... },
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601"
}
```

**Key design decisions:**

- `stage` is present only while `status` is `running` — it powers Document 12 §6.7's labeled progress indicator ("Generating PRD…", "Deriving architecture…") and §6.9's two-tier verification progress ("Running deterministic checks…" → "Running semantic analysis…").
- `progress` provides the step-level detail Document 12 §6.7's full-pipeline checklist requires. `stepsCompleted`/`stepsTotal` enable a determinate progress bar for multi-stage runs; single-stage runs set `stepsTotal: 1`.
- `result` is populated only when `status` is `complete`. For generation jobs, it contains the created `specVersionId`. For verification jobs, it contains the `verificationRunId` and a summary finding count by severity.
- `error` is populated only when `status` is `failed`, using the standard error format (§4.3).
- **Recommended polling interval:** 2 seconds. The API does not enforce this; excessively frequent polling is handled by rate limiting (§13).

**Verification-specific status values:** the `VerificationRun.status` enum from Document 10 §6.2 (`running_deterministic`, `running_semantic`) maps to the job's `stage` field rather than overloading the top-level `status` — this keeps the generic job contract simple (four states) while exposing verification-specific detail through the `stage` field that Document 12 §6.9 needs.

### 4.3 Error Response Format

Every non-`2xx` response returns this shape:

```json
{
  "error": {
    "code": "MACHINE_READABLE_CODE",
    "message": "Human-readable explanation of what happened.",
    "details": { },
    "action": "suggested_client_action"
  }
}
```

| Field | Purpose | Notes |
|---|---|---|
| `code` | Machine-readable, stable identifier for the error class | Used by the frontend for conditional rendering (e.g., distinguishing tier-1 vs. tier-2 verification failure per Document 12 §8) |
| `message` | Human-readable, suitable for display | Not a raw exception; written to satisfy Document 12 §8's "what happened" requirement |
| `details` | Optional structured payload with error-specific context | E.g., validation errors include a field-level breakdown; verification failures include which tier failed |
| `action` | Suggested client-side response | `retry`, `redirect_to_login`, `reconnect_github`, `contact_support` — a small, fixed vocabulary the frontend switches on |

**Error code taxonomy** (exhaustive list; each endpoint section below references which codes it can return):

| Code | HTTP Status | Meaning |
|---|---|---|
| `AUTH_SESSION_INVALID` | 401 | Session missing, expired, or invalid |
| `AUTH_INSUFFICIENT_PERMISSIONS` | 403 | Valid session but no access to this resource (should rarely occur in v1's single-user model) |
| `RESOURCE_NOT_FOUND` | 404 | Requested entity does not exist or belongs to another Workspace |
| `VALIDATION_ERROR` | 422 | Request body fails schema validation |
| `GENERATION_FAILED` | 500 | LLM generation failed after retry (Document 11 §5 step 4) |
| `GENERATION_DEPENDENCY_MISSING` | 422 | Cannot generate this artifact because a required upstream artifact doesn't exist yet |
| `VERIFICATION_FAILED` | 500 | Verification run failed; `details.failedTier` indicates which tier |
| `VERIFICATION_NO_SPEC` | 422 | Cannot verify — no SpecVersion exists for this Project |
| `VERIFICATION_NO_REPO` | 422 | Cannot verify — no repository connected |
| `GITHUB_AUTH_FAILED` | 401 | GitHub OAuth token expired or revoked |
| `GITHUB_REPO_INACCESSIBLE` | 422 | Connected repo is no longer accessible (deleted, permissions changed) |
| `RATE_LIMITED` | 429 | Request throttled; `details.retryAfter` in seconds |
| `JOB_NOT_FOUND` | 404 | Polled job ID doesn't exist |
| `INTERNAL_ERROR` | 500 | Unhandled server error; never includes stack trace |

---

## 5. Workspace & Project Endpoints (Epic A)

### GET /api/workspace

Returns the authenticated user's Workspace. v1 always returns exactly one Workspace (Document 4 §4, Document 10 §4.1).

**Response `200 OK`:**

```json
{
  "id": "uuid",
  "name": "Priya's Workspace",
  "createdAt": "ISO-8601"
}
```

No `membership` or `role` details are exposed in v1 — the data model supports them (Document 10 §4.3), but the API doesn't surface what the frontend doesn't render.

### GET /api/projects

Returns all Projects in the user's Workspace. Powers Document 8 §5.1's Projects List screen.

**Query parameters:** pagination (§4.1), plus:

| Parameter | Type | Default | Notes |
|---|---|---|---|
| `sort` | `updated_at` \| `created_at` \| `name` | `updated_at` | |
| `order` | `asc` \| `desc` | `desc` | |

**Response `200 OK`:**

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "My SaaS",
      "currentSpecVersion": {
        "id": "uuid",
        "versionNumber": 4,
        "createdAt": "ISO-8601"
      },
      "hasRepoConnection": true,
      "lastVerificationStatus": "clean" | "findings" | "failed" | "never_run",
      "updatedAt": "ISO-8601",
      "createdAt": "ISO-8601"
    }
  ],
  "pagination": { ... }
}
```

**Design note:** `currentSpecVersion` is inlined as a summary (id, version number, timestamp) rather than a full SpecVersion object — the Projects List screen (Document 12 §6, Document 8 §5.1) needs to show "spec status badge" but never the full spec content. `lastVerificationStatus` is a computed field derived from the most recent VerificationRun — a view-model concern, not stored in the Project table (Document 10), computed at query time.

### POST /api/projects

Creates a new Project. Per Document 9 §2 (Epic A), creation requires only a name — the idea prompt (Epic B1) is a separate step.

**Request body:**

```json
{
  "name": "My SaaS"
}
```

**Validation:** `name` required, non-empty, max 100 characters.

**Response `201 Created`:**

```json
{
  "id": "uuid",
  "name": "My SaaS",
  "currentSpecVersion": null,
  "hasRepoConnection": false,
  "lastVerificationStatus": "never_run",
  "updatedAt": "ISO-8601",
  "createdAt": "ISO-8601"
}
```

### GET /api/projects/:projectId

Returns a single Project with its dashboard data. Powers Document 8 §5.2's Project Dashboard screen.

**Response `200 OK`:**

```json
{
  "id": "uuid",
  "name": "My SaaS",
  "currentSpecVersion": {
    "id": "uuid",
    "versionNumber": 4,
    "createdAt": "ISO-8601",
    "source": "edit",
    "changeSummary": "Updated auth requirements on /api/users endpoint"
  },
  "repoConnection": {
    "id": "uuid",
    "githubRepoFullName": "priya/my-saas",
    "connectedAt": "ISO-8601"
  } | null,
  "verificationSummary": {
    "lastRunId": "uuid",
    "lastRunStatus": "complete",
    "lastRunSpecVersionId": "uuid",
    "lastRunSpecVersionNumber": 3,
    "completedAt": "ISO-8601",
    "findingCounts": {
      "critical": 1,
      "high": 2,
      "medium": 0,
      "low": 3,
      "info": 1
    }
  } | null,
  "versionContextStatus": "verified_clean" | "verified_with_findings" | "spec_changed_since_verification" | "never_verified",
  "updatedAt": "ISO-8601",
  "createdAt": "ISO-8601"
}
```

**`versionContextStatus`** is the computed field that directly powers Document 12 §3.2's Version Context Bar — the three-state status indicator (green/amber/gray). This is the single highest-leverage computed field in the API (Document 8 §6, Document 12 §3.2). The computation:

- `verified_clean`: latest VerificationRun's `spec_version_id` equals `current_spec_version_id` AND no open Critical/High findings exist.
- `verified_with_findings`: same version match, but open Critical/High findings exist.
- `spec_changed_since_verification`: `current_spec_version_id` has advanced past the latest run's `spec_version_id`.
- `never_verified`: no VerificationRun exists for this Project.

### PATCH /api/projects/:projectId

Updates Project metadata (name only in v1).

**Request body:**

```json
{
  "name": "Renamed SaaS"
}
```

**Response `200 OK`:** updated Project object (same shape as GET).

### DELETE /api/projects/:projectId

Soft-deletes a Project (Document 10 Design Principle 5). Sets `deleted_at`; the Project no longer appears in GET /api/projects responses.

**Response `204 No Content`.**

**Possible errors:** `RESOURCE_NOT_FOUND`.

---

## 6. Generation Endpoints (Epics B–F)

All generation endpoints follow the async job pattern (§4.2). Each returns `202 Accepted` with a job reference. The actual generation is performed by Document 11's Generation Service via the Job Queue.

### 6.1 Idea → PRD (Epic B1/B2)

**POST /api/projects/:projectId/generate/prd**

**Request body:**

```json
{
  "ideaText": "A platform that helps solo developers plan and verify their AI-built code..."
}
```

**Validation:**
- `ideaText` required, minimum 50 characters (Document 12 §6.1's soft-validation threshold, enforced server-side as a hard minimum since the frontend provides guidance to meet it), maximum 5,000 characters.
- Project must not have an active (non-failed) generation job running — prevents duplicate concurrent generation.

**Response `202 Accepted`:**

```json
{
  "jobId": "uuid",
  "status": "queued",
  "pollUrl": "/api/jobs/{jobId}"
}
```

**On job completion:** a new SpecVersion is created with a PRDArtifact (Document 10 §5.1–5.2). The job's `result` contains `{ "specVersionId": "uuid", "versionNumber": 1 }`.

**Possible errors:** `VALIDATION_ERROR`, `GENERATION_FAILED`.

### 6.2 PRD → Architecture (Epic C1)

**POST /api/projects/:projectId/generate/architecture**

**Request body:** none required — the Generation Service constructs the prompt from the current SpecVersion's PRDArtifact (Document 11 §5 step 6).

**Precondition:** a SpecVersion with a PRDArtifact must exist. If not: `GENERATION_DEPENDENCY_MISSING` with `details.missingArtifact: "prd"`.

**Response:** same `202` job pattern.

**On job completion:** a new SpecVersion is created with the previous version's PRDArtifact carried forward plus a new ArchitectureArtifact. The `result` contains the new `specVersionId`.

### 6.3 Architecture → Schema (Epic D1)

**POST /api/projects/:projectId/generate/schema**

**Precondition:** current SpecVersion must include both PRDArtifact and ArchitectureArtifact. If not: `GENERATION_DEPENDENCY_MISSING` with `details.missingArtifact: "architecture"`.

**Response:** same `202` job pattern.

### 6.4 Schema → API Design (Epic E1)

**POST /api/projects/:projectId/generate/api**

**Precondition:** current SpecVersion must include PRDArtifact, ArchitectureArtifact, and SchemaArtifact. If not: `GENERATION_DEPENDENCY_MISSING` with `details.missingArtifact: "schema"`.

**Response:** same `202` job pattern.

### 6.5 API → Repo Structure (Epic F1)

**POST /api/projects/:projectId/generate/repo-structure**

**Precondition:** current SpecVersion must include all artifacts through APIArtifact. If not: `GENERATION_DEPENDENCY_MISSING`.

**Response:** same `202` job pattern.

### 6.6 Repo Structure → Roadmap (Epic F2)

**POST /api/projects/:projectId/generate/roadmap**

**Precondition:** current SpecVersion must include all artifacts through RepoStructureArtifact.

**Response:** same `202` job pattern.

### 6.7 Roadmap → Tasks (Epic F3)

**POST /api/projects/:projectId/generate/tasks**

**Precondition:** current SpecVersion must include all artifacts through RoadmapArtifact.

**Response:** same `202` job pattern.

### 6.8 Full Pipeline Generation

**POST /api/projects/:projectId/generate/full-pipeline**

**Request body:**

```json
{
  "ideaText": "A platform that..."
}
```

Triggers the entire PRD → Architecture → Schema → API → Repo Structure → Roadmap → Tasks pipeline as a single multi-stage job. This is the "run the whole thing unattended" flow Document 12 §6.7 describes, where the progress state shows a step-by-step checklist.

**Job `progress` for this route specifically includes:**

```json
{
  "currentStep": "Generating schema...",
  "stepsCompleted": 2,
  "stepsTotal": 7,
  "completedSteps": ["prd", "architecture"]
}
```

`completedSteps` is an ordered array enabling the frontend's checklist UI (Document 12 §6.7's "fills in as each stage completes").

**Failure handling:** if any stage fails, the pipeline halts. The job status becomes `failed` with `details.failedStage` indicating which stage failed and `details.lastSuccessfulSpecVersionId` pointing to the SpecVersion created up to that point — so a failure at the Schema stage still leaves a valid SpecVersion with PRD and Architecture, not nothing.

### 6.9 Regeneration

**POST /api/projects/:projectId/regenerate/:artifactType**

Where `artifactType` is one of: `prd`, `architecture`, `schema`, `api`, `repo-structure`, `roadmap`, `tasks`.

Regenerates the specified artifact and all downstream artifacts from it. For example, regenerating `architecture` also regenerates schema, API, repo structure, roadmap, and tasks — because every artifact derives from the one before it (Document 1 Principle 1), and regenerating an upstream artifact without updating downstream ones would violate the consistency guarantee.

**Request body (optional, for PRD only):**

```json
{
  "refinedPrompt": "Focus more on the B2B use case..."
}
```

For non-PRD artifacts, no body is needed — regeneration uses the current upstream artifacts as context.

**Precondition:** the artifact being regenerated must already exist.

**Response:** same `202` job pattern, with `stepsTotal` reflecting the number of artifacts being regenerated (1 for tasks, 7 for PRD regeneration with full cascade).

**Possible errors:** `GENERATION_DEPENDENCY_MISSING`, `GENERATION_FAILED`.

---

## 7. Spec Artifact Endpoints (read and edit)

These endpoints serve the Spec section's sub-navigation screens (Document 8 §4, Document 12 §6.2–6.6). Each returns the specified artifact from the Project's current SpecVersion, or from a specific SpecVersion if the `version` query parameter is provided.

### 7.1 Common query parameter

| Parameter | Type | Default | Notes |
|---|---|---|---|
| `version` | integer, optional | current | SpecVersion number to retrieve; enables viewing historical versions (Document 8's History screen) |

### 7.2 PRD

**GET /api/projects/:projectId/spec/prd**

**Response `200 OK`:**

```json
{
  "specVersionId": "uuid",
  "versionNumber": 4,
  "prd": {
    "id": "uuid",
    "problemStatement": "...",
    "targetUsers": [
      { "id": "uuid", "description": "Solo developers...", "priority": "primary" }
    ],
    "features": [
      { "id": "uuid", "name": "Spec Generation", "description": "...", "priority": "must_have" }
    ],
    "nonGoals": [
      { "id": "uuid", "description": "Not a code generator" }
    ],
    "successCriteria": [
      { "id": "uuid", "description": "User can go from idea to full artifact set..." }
    ],
    "narrative": "..."
  }
}
```

**Design note:** every array item has a stable `id` — this is what enables Document 12 §6.2's per-feature identifiers and what Architecture traceability links (Document 10 §5.3's `prd_feature_refs`) point at. The `id` is generated at creation time and preserved through edits.

**PUT /api/projects/:projectId/spec/prd**

Saves edits to the PRD. Per Document 10 Design Principle 2, this creates a new SpecVersion with the edited PRDArtifact — the request body is the full PRD shape (same as the GET response's `prd` field), and the server diffs it against the current version to generate a `change_summary`.

**Request body:** full PRD object (same shape as above, minus `id` — the server assigns that).

**Response `200 OK`:**

```json
{
  "specVersionId": "uuid",
  "versionNumber": 5,
  "changeSummary": "Edited problem statement and added one feature"
}
```

**Possible errors:** `VALIDATION_ERROR`, `RESOURCE_NOT_FOUND`.

### 7.3 Architecture

**GET /api/projects/:projectId/spec/architecture**

**Response `200 OK`:**

```json
{
  "specVersionId": "uuid",
  "versionNumber": 4,
  "architecture": {
    "id": "uuid",
    "components": [
      {
        "id": "uuid",
        "name": "Auth Service",
        "description": "...",
        "techChoice": "Better Auth",
        "rationale": "...",
        "prdFeatureRefs": ["uuid", "uuid"],
        "isManuallyEdited": false
      }
    ],
    "dataFlow": [
      {
        "from": "component-uuid",
        "to": "component-uuid",
        "description": "REST/HTTP"
      }
    ]
  }
}
```

`isManuallyEdited` powers Document 12 §6.3's "edited" indicator — components the user has manually overridden are flagged so the frontend can render the persistence marker that makes Document 4 Epic C3's guarantee visible.

**PUT /api/projects/:projectId/spec/architecture** — same edit-creates-new-version pattern as PRD.

### 7.4 Schema

**GET /api/projects/:projectId/spec/schema**

**Response `200 OK`:**

```json
{
  "specVersionId": "uuid",
  "versionNumber": 4,
  "schema": {
    "id": "uuid",
    "entities": [
      {
        "id": "uuid",
        "name": "User",
        "architectureComponentRef": "uuid",
        "fields": [
          {
            "id": "uuid",
            "name": "email",
            "dataType": "string",
            "isRequired": true,
            "isUnique": true,
            "foreignKeyRef": null
          }
        ]
      }
    ]
  }
}
```

**Design note:** entities and fields are returned as nested JSON here (the view model), even though they're stored as separate tables (Document 10 §5.4). The API denormalizes for client convenience; the storage normalization serves verification's query needs (Document 10's rationale), not the client's.

**PUT /api/projects/:projectId/spec/schema** — full schema object; creates new SpecVersion.

### 7.5 API Design

**GET /api/projects/:projectId/spec/api**

**Response `200 OK`:**

```json
{
  "specVersionId": "uuid",
  "versionNumber": 4,
  "api": {
    "id": "uuid",
    "endpoints": [
      {
        "id": "uuid",
        "method": "POST",
        "path": "/api/users",
        "requestShape": { "type": "object", "properties": { ... } },
        "responseShape": { "type": "object", "properties": { ... } },
        "authRequired": true,
        "requiredRole": "admin",
        "schemaEntityRefs": ["uuid"]
      }
    ]
  }
}
```

**PUT /api/projects/:projectId/spec/api** — same pattern.

### 7.6 Repository Structure

**GET /api/projects/:projectId/spec/repo-structure**

**Response `200 OK`:**

```json
{
  "specVersionId": "uuid",
  "versionNumber": 4,
  "repoStructure": {
    "id": "uuid",
    "tree": {
      "name": "root",
      "type": "directory",
      "purpose": "Project root",
      "children": [
        {
          "name": "src",
          "type": "directory",
          "purpose": "Source code",
          "children": [ ... ]
        }
      ]
    }
  }
}
```

Read-only in v1 — no PUT endpoint. Document 9 §2 marks Repo Structure as MVP-Complete, and editing a generated folder tree has no downstream verification dependency. If editing is needed later, it follows the same pattern.

### 7.7 Roadmap

**GET /api/projects/:projectId/spec/roadmap**

**Response `200 OK`:**

```json
{
  "specVersionId": "uuid",
  "versionNumber": 4,
  "roadmap": {
    "id": "uuid",
    "phases": [
      {
        "id": "uuid",
        "order": 1,
        "name": "Foundation",
        "description": "Core auth, database, and project setup"
      }
    ]
  }
}
```

Read-only in v1, same rationale as Repo Structure.

### 7.8 Tasks

**GET /api/projects/:projectId/spec/tasks**

**Query parameters:** pagination (§4.1), plus:

| Parameter | Type | Default | Notes |
|---|---|---|---|
| `phaseId` | uuid, optional | all phases | Filter by roadmap phase |

**Response `200 OK`:**

```json
{
  "specVersionId": "uuid",
  "versionNumber": 4,
  "data": [
    {
      "id": "uuid",
      "title": "Implement user registration endpoint",
      "description": "Create POST /api/users with email/password...",
      "roadmapPhaseId": "uuid",
      "prdFeatureRef": "uuid",
      "architectureComponentRef": "uuid",
      "schemaEntityRefs": ["uuid"],
      "apiEndpointRefs": ["uuid"]
    }
  ],
  "pagination": { ... }
}
```

### 7.9 Task Export (Epic F4)

**GET /api/projects/:projectId/spec/tasks/export**

Returns all tasks formatted as structured markdown, optimized for pasting into an external AI coding tool (Document 4 F4, Document 7 Stage 7, Document 12 §6.6).

**Query parameters:**

| Parameter | Type | Default | Notes |
|---|---|---|---|
| `format` | `markdown` | `markdown` | Extensible for future formats; v1 supports markdown only |

**Response `200 OK` (Content-Type: text/markdown):**

```markdown
# Project: My SaaS — Implementation Tasks
## Generated from SpecVersion v4

### Phase 1: Foundation

#### Task 1.1: Implement user registration endpoint
**References:** PRD Feature: User Authentication | Architecture: Auth Service | Schema: User | API: POST /api/users
**Description:** Create POST /api/users with email/password. Must include input validation...

...
```

**Design note:** the export includes traceability references as human-readable labels (not UUIDs) — because Priya is pasting this into Claude Code, where a UUID reference is meaningless but "Architecture: Auth Service" gives the AI coding tool useful context about where this task fits in the system.

---

## 8. Repository Connection Endpoints (Epic G)

### POST /api/projects/:projectId/repo/connect

Initiates GitHub OAuth flow for repository connection.

**Request body:**

```json
{
  "githubRepoFullName": "priya/my-saas"
}
```

**Response `200 OK`:**

```json
{
  "authorizationUrl": "https://github.com/login/oauth/authorize?client_id=...&scope=repo:read&state=..."
}
```

The `state` parameter encodes the `projectId` and a CSRF token. The frontend redirects the user to `authorizationUrl`.

### GET /api/github/callback

Handles the GitHub OAuth callback. This is not called by the frontend directly — it's the redirect target GitHub sends the user back to.

**Query parameters:** `code` (authorization code from GitHub), `state` (the CSRF + project reference).

**Behavior:**
1. Validates `state` against the stored CSRF token.
2. Exchanges `code` for an access token via GitHub's token endpoint.
3. Stores the token reference in `RepoConnection.oauth_token_ref` (Document 10 §6.1) — the actual token is stored in the secrets store, never in the database directly (Document 5 §4).
4. Creates the `RepoConnection` record.
5. Updates `Project.repo_connection_id`.
6. Redirects the user back to the Project's Repo Connection screen with a success indicator.

### GET /api/projects/:projectId/repo

Returns the current repository connection status.

**Response `200 OK` (connected):**

```json
{
  "id": "uuid",
  "githubRepoFullName": "priya/my-saas",
  "connectedAt": "ISO-8601",
  "status": "connected" | "token_expired" | "repo_inaccessible"
}
```

**Response `200 OK` (not connected):**

```json
{
  "connection": null
}
```

`status` is computed at request time by checking the GitHub token's validity — this powers Document 12 §8's GitHub connection failure states without requiring the user to trigger a verification run to discover a stale token.

### DELETE /api/projects/:projectId/repo

Disconnects the repository. Revokes the GitHub token and deletes the `RepoConnection` record.

**Response `204 No Content`.**

---

## 9. Version Management Endpoints (Epic I)

### GET /api/projects/:projectId/versions

Returns the SpecVersion history for a Project. Powers Document 8 §5.2's Version History screen and Document 12 §6.12.

**Query parameters:** pagination (§4.1).

**Response `200 OK`:**

```json
{
  "data": [
    {
      "id": "uuid",
      "versionNumber": 4,
      "source": "edit",
      "changeSummary": "Updated auth requirements",
      "createdAt": "ISO-8601",
      "artifactsPresent": ["prd", "architecture", "schema", "api", "repo_structure", "roadmap", "tasks"],
      "isCurrentVersion": true
    }
  ],
  "pagination": { ... }
}
```

`artifactsPresent` indicates which artifact types exist in this version — useful for the History screen to show at a glance whether a version is a full pipeline output or a partial one (e.g., early versions may have only PRD and Architecture).

### GET /api/projects/:projectId/versions/:versionNumber/diff

Returns a structured diff between this version and the one immediately preceding it (using `previous_version_id` from Document 10 §5.1). Powers Document 12 §6.12's Version Diff drawer.

**Query parameters:**

| Parameter | Type | Default | Notes |
|---|---|---|---|
| `compareWith` | integer, optional | previous version | Compare against a specific version number instead of the immediately preceding one |

**Response `200 OK`:**

```json
{
  "baseVersion": 3,
  "compareVersion": 4,
  "changes": [
    {
      "artifactType": "schema",
      "changeType": "modified",
      "details": [
        {
          "path": "entities[User].fields[role]",
          "change": "added",
          "newValue": { "name": "role", "dataType": "string", "isRequired": true }
        },
        {
          "path": "entities[Order].fields[total]",
          "change": "type_changed",
          "oldValue": "integer",
          "newValue": "decimal"
        }
      ]
    },
    {
      "artifactType": "api",
      "changeType": "modified",
      "details": [
        {
          "path": "endpoints[POST /api/orders].authRequired",
          "change": "value_changed",
          "oldValue": false,
          "newValue": true
        }
      ]
    }
  ]
}
```

**Scope:** v1 diffs structured fields only (schema, API, architecture components) — prose diffing (PRD narrative, descriptions) is explicitly Later per Document 4 I3 and Document 9 §5. Prose-only artifacts in the diff response show `changeType: "modified"` with no `details` array and a note: `"note": "Prose changes detected; structured diff not available in v1"`.

---

## 10. Verification Endpoints (Epics G, H)

### POST /api/projects/:projectId/verify

Triggers a manual verification run (Epic G3). This is the single most consequential action in the product (Document 7 Stage 10).

**Request body:** none.

**Preconditions (all checked before the job is enqueued):**
- Project must have a current SpecVersion (`VERIFICATION_NO_SPEC`).
- Project must have a connected repository (`VERIFICATION_NO_REPO`).
- No active verification run already in progress for this Project (prevents duplicate runs).

**Behavior:**
1. Creates a `VerificationRun` record (Document 10 §6.2) with `status: queued`, `spec_version_id` set to the Project's `current_spec_version_id` at this exact moment, and `commit_sha` captured from the repo's current HEAD.
2. Enqueues the verification job.
3. Returns `202 Accepted` with job reference.

**Response `202 Accepted`:**

```json
{
  "jobId": "uuid",
  "verificationRunId": "uuid",
  "status": "queued",
  "specVersionNumber": 4,
  "pollUrl": "/api/jobs/{jobId}"
}
```

`specVersionNumber` is included in the initiation response so the frontend can immediately display "Verifying against v4…" in the progress UI (Document 12 §6.9) without a separate lookup.

### GET /api/projects/:projectId/verification-runs

Returns the history of verification runs. Powers the Verify section's run list.

**Query parameters:** pagination (§4.1).

**Response `200 OK`:**

```json
{
  "data": [
    {
      "id": "uuid",
      "specVersionNumber": 4,
      "status": "complete",
      "commitSha": "abc123f",
      "triggeredAt": "ISO-8601",
      "completedAt": "ISO-8601",
      "findingSummary": {
        "critical": 1,
        "high": 2,
        "medium": 0,
        "low": 3,
        "info": 1,
        "total": 7
      }
    }
  ],
  "pagination": { ... }
}
```

### GET /api/projects/:projectId/verification-runs/:runId

Returns a single verification run's detail.

**Response `200 OK`:**

```json
{
  "id": "uuid",
  "specVersionId": "uuid",
  "specVersionNumber": 4,
  "status": "complete",
  "commitSha": "abc123f",
  "triggeredAt": "ISO-8601",
  "completedAt": "ISO-8601",
  "findingSummary": {
    "critical": 1,
    "high": 2,
    "medium": 0,
    "low": 3,
    "info": 1,
    "total": 7
  },
  "tierSummary": {
    "deterministic": { "findingsCount": 4, "durationMs": 12000 },
    "semantic": { "findingsCount": 3, "durationMs": 85000 }
  }
}
```

`tierSummary` provides the per-tier breakdown useful for internal quality tracking (Document 10 §6.3's `detection_tier` rationale) and could power a future per-tier detail view. In v1, it's exposed in the API for observability even though Document 12 §6.10 treats tier as a secondary filter rather than primary information.

---

## 11. Findings Endpoints (Epic H)

### GET /api/projects/:projectId/verification-runs/:runId/findings

Returns findings for a specific verification run. Powers Document 12 §6.10's Findings Dashboard.

**Query parameters:** pagination (§4.1), plus:

| Parameter | Type | Default | Notes |
|---|---|---|---|
| `severity` | comma-separated: `critical,high,medium,low,info` | all | Filter by severity |
| `specArea` | comma-separated: `auth,schema,api_contract,architecture,other` | all | Filter by spec area |
| `detectionTier` | `deterministic` \| `semantic` | all | Filter by which tier produced the finding |
| `status` | `open` \| `acknowledged` | `open` | Default to open findings; Document 12 §6.10's dashboard shows open by default |
| `groupBy` | `severity` \| `spec_area` | `severity` | Controls the grouping in the response; maps to Document 12 §6.10's toggle |

**Response `200 OK`:**

```json
{
  "data": [
    {
      "id": "uuid",
      "severity": "critical",
      "specArea": "auth",
      "specElementRef": {
        "type": "api_endpoint",
        "id": "uuid",
        "label": "POST /api/users",
        "detail": "authRequired: true, requiredRole: admin"
      },
      "filePath": "src/routes/users.ts",
      "lineNumber": 42,
      "explanation": "Endpoint spec requires admin-only authentication, but the implementation has no auth middleware applied to this route.",
      "confidence": 0.95,
      "detectionTier": "deterministic",
      "status": "open"
    }
  ],
  "pagination": { ... },
  "groupedCounts": {
    "severity": { "critical": 1, "high": 2, "medium": 0, "low": 3, "info": 1 },
    "specArea": { "auth": 2, "schema": 1, "api_contract": 3, "architecture": 0, "other": 1 }
  }
}
```

**Key design decisions:**

- **`specElementRef` is an expanded object, not a raw ID.** The raw `spec_element_ref` in Document 10 §6.3 is a text pointer (e.g., an APIEndpoint ID). The API response expands this into a typed, labeled reference so the frontend can render the traceability chip (Document 12 §7's interaction pattern) without a separate lookup for the label. `type` is one of `api_endpoint`, `schema_entity`, `schema_field`, `architecture_component` — the taxonomy of checkable spec elements Document 10 §9 flagged as potentially needing extension.

- **`confidence` is a float between 0.0 and 1.0.** Deterministic findings always have `confidence: 1.0` (they are structurally certain). Semantic findings carry a model-assessed confidence score — this is what powers Document 9 §3's `Info` severity ("verification could not conclusively determine a match") when confidence falls below a threshold (defined in Document 13's verification architecture).

- **`groupedCounts` are returned alongside the paginated list** so the frontend can render Document 12 §6.10's severity/spec-area toggle with accurate counts without a separate aggregation call.

### GET /api/projects/:projectId/verification-runs/:runId/findings/:findingId

Returns a single finding's full detail. Powers Document 12 §6.11's Finding Detail screen.

**Response `200 OK`:**

```json
{
  "id": "uuid",
  "severity": "critical",
  "specArea": "auth",
  "specElementRef": {
    "type": "api_endpoint",
    "id": "uuid",
    "label": "POST /api/users",
    "detail": "authRequired: true, requiredRole: admin"
  },
  "filePath": "src/routes/users.ts",
  "lineNumber": 42,
  "explanation": "Endpoint spec requires admin-only authentication, but the implementation has no auth middleware applied to this route.",
  "recommendation": "Add authentication middleware to the POST /api/users route handler and enforce the 'admin' role check.",
  "evidence": {
    "specValue": "authRequired: true, requiredRole: admin",
    "implementationValue": "No auth middleware detected on route handler",
    "codeSnippet": "router.post('/api/users', async (req, res) => { ... })"
  },
  "confidence": 0.95,
  "detectionTier": "deterministic",
  "status": "open"
}
```

**Extended fields vs. list response:**

- `recommendation` — a concrete, actionable suggestion (Document 4 Epic H3's "specific enough to act on"). Only present in the detail response, not the list, to keep the list response lightweight.
- `evidence` — the specific spec value, the detected implementation value, and a code snippet. This is the "show your work" layer that reduces false-positive perception: if a finding looks wrong, the evidence lets Priya evaluate *why* the system flagged it, rather than just dismissing it on gut feel.

### PATCH /api/projects/:projectId/verification-runs/:runId/findings/:findingId

Updates a finding's status. Powers Document 12 §6.11's acknowledge/won't-fix action (Epic H6, Later — but the endpoint is defined now to avoid API restructuring later, consistent with Document 10 §6.3's preemptive `status` column).

**Request body:**

```json
{
  "status": "acknowledged"
}
```

**Validation:** status must be `open` or `acknowledged`.

**Response `200 OK`:** updated finding object.

---

## 12. Job Status Endpoint

### GET /api/jobs/:jobId

The universal job polling endpoint (§4.2). Returns the current state of any async job (generation or verification).

**Response `200 OK`:** the job status shape defined in §4.2.

**Possible errors:** `JOB_NOT_FOUND`.

**Authorization:** a user can only poll jobs belonging to their own Workspace. Jobs belonging to other Workspaces return `JOB_NOT_FOUND` (not `403`, per §2 Principle 6's tenant isolation rule).

---

## 13. Rate Limiting

Per Document 5 §4, rate limiting is enforced at the API layer with stricter limits on LLM-backed routes (Document 11 §8). Three tiers:

| Tier | Routes | Limit | Window | Rationale |
|---|---|---|---|---|
| **Standard** | All read endpoints (GET) | 120 requests | per minute | Generous enough for normal browsing + polling; tight enough to block scraping |
| **Write** | All mutation endpoints (POST/PUT/PATCH/DELETE) except generation/verification | 30 requests | per minute | Standard write-rate ceiling |
| **Expensive** | All generation and verification trigger endpoints (§6, §10) | 10 requests | per minute | These enqueue LLM-backed work (Document 5 §9's cost constraint); a higher rate either indicates abuse or a misbehaving client — legitimate usage never needs 10 generation triggers in a minute |

Rate limit headers are included on every response:

```
X-RateLimit-Limit: 120
X-RateLimit-Remaining: 117
X-RateLimit-Reset: 1719936000
```

When a limit is exceeded:

```
429 Too Many Requests
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests. Please wait before retrying.",
    "details": { "retryAfter": 12 },
    "action": "retry"
  }
}
```

Rate limits are per-user (derived from session), not per-IP — this is deliberate: IP-based limiting would incorrectly throttle multiple users behind a shared network, while per-user limiting directly bounds the resource (LLM calls) that rate limiting is designed to protect.

---

## 14. API Versioning Strategy

v1 does not implement URL-path versioning (`/api/v1/...`) or header-based versioning. Rationale: versioning adds complexity that serves an audience (third-party API consumers) this product does not have in v1 — the only API consumer is the product's own frontend, deployed in lockstep with the backend. Adding versioning for an internal-only consumer would be premature architecture for a portfolio project, exactly the kind of false sophistication Document 1 §9 warns against.

**When versioning becomes necessary (Document 21 scope):**
- If a public API or third-party integration is ever exposed, URL-path versioning (`/api/v2/...`) is the preferred approach — it's the most explicit, debuggable, and broadly understood versioning strategy, and avoids the content-negotiation ambiguity of header-based versioning.
- The current route structure (`/api/projects/:id/...`) is designed to nest cleanly under a version prefix without restructuring.

**Breaking-change policy for v1's internal API:**
- The frontend and backend are deployed together. Schema changes to request/response shapes are coordinated at the PR level, validated by the shared Zod schemas (Document 5 §5), and caught by TypeScript's type system before deployment — not by runtime versioning logic.

---

## 15. CORS and Security Headers

Specified here for API-level completeness; detailed threat model and session security live in Document 16 (Security Architecture).

- **CORS:** restricted to the application's own origin. No wildcard `Access-Control-Allow-Origin`. Credential-carrying requests (cookies) require the explicit origin, not `*`.
- **Security headers** set on all API responses:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains` (HSTS, per Document 5 §4's TLS requirement)
  - `Content-Security-Policy` — defined in Document 16, referenced from here.

---

## 16. What This Document Deliberately Does Not Specify

- **Prompt construction, LLM call mechanics, or structured-output validation logic** — those are Document 13's (AI Architecture) domain. This document specifies the HTTP boundary: what the client sends, what it gets back, and what happens if the internal AI pipeline fails. The internals between "job enqueued" and "job complete/failed" are opaque to the API consumer.
- **Exact Zod schema definitions** — this document specifies shapes as JSON examples; the canonical Zod schemas are build-phase artifacts derived from these shapes, shared across API validation, frontend types, and LLM structured output (Document 5 §5). Specifying them here in Zod syntax would create a maintenance burden between this document and the actual code.
- **WebSocket/SSE push mechanisms** — Document 4 §6 explicitly defers real-time push to Later. The polling contract in §4.2 is the v1 mechanism.
- **GitHub webhook endpoints** — CI-triggered verification (Epic G4) is Later per Document 4/9. No webhook receiver is defined in v1.
- **OAuth token refresh mechanics** — the refresh strategy for GitHub tokens (silent re-authorization vs. user-prompted reconnection) is a Document 16 decision with security implications this document should not preempt.
- **Admin or internal-only endpoints** — no admin panel or internal API exists in v1 (Document 4 §4: single Owner role only). Observability data (Document 5 §7) is consumed via external tools (Sentry, structured logs), not an internal API.

---

## 17. Endpoint Summary Table

A complete, sortable reference for implementation:

| Method | Path | Epic | Priority | Async | Auth | Rate Tier |
|---|---|---|---|---|---|---|
| GET | /api/workspace | A1 | MVP-Core | No | Required | Standard |
| GET | /api/projects | A3 | MVP-Core | No | Required | Standard |
| POST | /api/projects | A2 | MVP-Core | No | Required | Write |
| GET | /api/projects/:id | A4 | MVP-Core | No | Required | Standard |
| PATCH | /api/projects/:id | A2 | MVP-Core | No | Required | Write |
| DELETE | /api/projects/:id | A2 | MVP-Core | No | Required | Write |
| POST | /api/projects/:id/generate/prd | B1/B2 | MVP-Core | Yes | Required | Expensive |
| POST | /api/projects/:id/generate/architecture | C1 | MVP-Core | Yes | Required | Expensive |
| POST | /api/projects/:id/generate/schema | D1 | MVP-Core | Yes | Required | Expensive |
| POST | /api/projects/:id/generate/api | E1 | MVP-Core | Yes | Required | Expensive |
| POST | /api/projects/:id/generate/repo-structure | F1 | MVP-Complete | Yes | Required | Expensive |
| POST | /api/projects/:id/generate/roadmap | F2 | MVP-Complete | Yes | Required | Expensive |
| POST | /api/projects/:id/generate/tasks | F3 | MVP-Core | Yes | Required | Expensive |
| POST | /api/projects/:id/generate/full-pipeline | B–F | MVP-Core | Yes | Required | Expensive |
| POST | /api/projects/:id/regenerate/:artifactType | B–F | MVP-Core | Yes | Required | Expensive |
| GET | /api/projects/:id/spec/prd | B2/B3 | MVP-Core | No | Required | Standard |
| PUT | /api/projects/:id/spec/prd | B3 | MVP-Core | No | Required | Write |
| GET | /api/projects/:id/spec/architecture | C1 | MVP-Core | No | Required | Standard |
| PUT | /api/projects/:id/spec/architecture | C3 | MVP-Complete | No | Required | Write |
| GET | /api/projects/:id/spec/schema | D1 | MVP-Core | No | Required | Standard |
| PUT | /api/projects/:id/spec/schema | D2 | MVP-Core | No | Required | Write |
| GET | /api/projects/:id/spec/api | E1 | MVP-Core | No | Required | Standard |
| PUT | /api/projects/:id/spec/api | E3 | MVP-Core | No | Required | Write |
| GET | /api/projects/:id/spec/repo-structure | F1 | MVP-Complete | No | Required | Standard |
| GET | /api/projects/:id/spec/roadmap | F2 | MVP-Complete | No | Required | Standard |
| GET | /api/projects/:id/spec/tasks | F3 | MVP-Core | No | Required | Standard |
| GET | /api/projects/:id/spec/tasks/export | F4 | MVP-Core | No | Required | Standard |
| POST | /api/projects/:id/repo/connect | G1 | MVP-Core | No | Required | Write |
| GET | /api/projects/:id/repo | G1 | MVP-Core | No | Required | Standard |
| DELETE | /api/projects/:id/repo | G1 | MVP-Core | No | Required | Write |
| GET | /api/github/callback | G1 | MVP-Core | No | Implicit | Standard |
| GET | /api/projects/:id/versions | I2 | MVP-Core | No | Required | Standard |
| GET | /api/projects/:id/versions/:num/diff | I3 | MVP-Complete | No | Required | Standard |
| POST | /api/projects/:id/verify | G3 | MVP-Core | Yes | Required | Expensive |
| GET | /api/projects/:id/verification-runs | H5 | MVP-Core | No | Required | Standard |
| GET | /api/projects/:id/verification-runs/:runId | H5 | MVP-Core | No | Required | Standard |
| GET | /api/projects/:id/verification-runs/:runId/findings | H3/H5 | MVP-Core | No | Required | Standard |
| GET | /api/projects/:id/verification-runs/:runId/findings/:id | H3 | MVP-Core | No | Required | Standard |
| PATCH | /api/projects/:id/verification-runs/:runId/findings/:id | H6 | Later | No | Required | Write |
| GET | /api/jobs/:jobId | — | MVP-Core | No | Required | Standard |

**Total: 38 endpoints** (36 MVP-relevant, 2 Later-priority).

---

## 18. Open Questions Carried Into Later Documents

- **OAuth token refresh strategy** — when a GitHub token expires mid-session, should the API silently attempt a refresh (if a refresh token exists) or immediately surface `GITHUB_AUTH_FAILED` and redirect to reconnect? Both are valid; the choice depends on GitHub's OAuth grant type and the security posture Document 16 establishes. Resolved there.
- **Whether the diff endpoint (§9) should pre-compute and cache diffs at SpecVersion creation time, or compute them on-demand** — a performance vs. storage tradeoff. At the scale Document 5 §2 targets, on-demand computation is likely sufficient, but Document 18 (Scalability Strategy) should confirm this based on the diffing algorithm's expected cost for large artifact sets.
- **Whether `GET /api/projects/:id` should include a `hasActiveJob` field** — to let the Dashboard show "generation in progress" state without the frontend needing to independently track job IDs across page navigations. Leaning yes; implementation cost is low (a single query against the job queue for the Project's active jobs). Confirmed during build phase.
- **Exact `Content-Security-Policy` header value** — depends on Document 17's hosting/CDN decisions and Document 16's threat model. The API sets the header; its value is defined in those documents.
- **Whether task export (§7.9) should support additional formats beyond markdown** (JSON, YAML) for use with different AI coding tools' preferred input formats — a low-cost extension if needed, but markdown covers the primary persona's workflow (Document 6/7). Revisited based on user feedback post-launch, or in Document 21 (Future Roadmap).
