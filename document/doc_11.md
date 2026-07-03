# Document 11: System Architecture

## 1. Purpose and Scope

This document defines the service-level structure of Verity: the major services, how they communicate, the async job architecture Document 5 §3 and §9 both depend on, and the request lifecycle for the two most complex flows (spec generation and verification). It builds directly on Document 10's data model and sets the constraints Document 13 (AI Architecture), Document 16 (Security Architecture), Document 17 (Deployment Architecture), and Document 18 (Scalability Strategy) each implement in more depth.

## 2. Architectural Style

**Modular monolith, not microservices.** For a solo-built, portfolio-stage product with the traffic profile Document 5 §2 describes (100 concurrent verification runs, not enterprise scale), microservices would add operational overhead — service discovery, distributed tracing, network-boundary failure modes — without a corresponding benefit. A modular monolith with clean internal service boundaries gets the architectural defensibility Document 1 §9 asks for (interview-defensible decisions) without the premature-scaling smell a "12 microservices for 100 concurrent users" design would signal to a technical reviewer.

The boundaries below are enforced at the module/package level (clear interfaces, no reaching across boundaries into another module's internals) so that extraction into real services later — if usage ever justified it — is a refactor, not a rewrite. This is the same "designed to scale conceptually, low usage today" posture Document 1 §9 sets for the whole project.

## 3. Core Services (Modules)

| Service | Responsibility | Depends on |
|---|---|---|
| **Auth Service** | User/session management via Better Auth | — |
| **Workspace Service** | Workspace/Membership/Project CRUD | Auth Service |
| **Generation Service** | Orchestrates PRD → Architecture → Schema → API → Repo/Roadmap → Tasks generation; owns prompt construction and structured-output parsing | Claude API, Workspace Service |
| **Spec Service** | SpecVersion creation/immutability enforcement, version history, diffing | Workspace Service |
| **Repo Service** | GitHub OAuth connection, repository ingestion (read-only) | GitHub API |
| **Verification Service** | Orchestrates the two-tier check (deterministic then semantic), produces Findings | Repo Service, Spec Service, Claude API, static analysis tooling |
| **Job Queue / Worker Service** | Executes async generation and verification work; retry/backoff; status tracking | All of the above |
| **Notification/Status Service** | Surfaces progress state to the frontend (polling-backed per Document 4 §6) | Job Queue |

**Deliberately not a separate service:** Findings storage and the Findings dashboard's query logic live inside Verification Service, not split into a separate "Reporting Service" — there's no independent scaling or team-ownership reason to split them at this stage, and doing so would violate the "boundaries where they earn their keep" version of Document 1 Principle 1.

## 4. Async Job Architecture

Per Document 5 §3 ("generation and verification are asynchronous by design"), both the Generation Service and Verification Service submit work to the Job Queue rather than executing inline within the HTTP request cycle:

```
Client request → API layer validates + creates job record → 202 Accepted, job id returned
                                                    ↓
                                          Job Queue (Postgres-backed, e.g. pg-boss,
                                          or Redis-backed, e.g. BullMQ — see Document 18
                                          for the tradeoff decision)
                                                    ↓
                                          Worker picks up job → executes → updates status
                                                    ↓
                                          Client polls job status endpoint (Document 4 §6:
                                          no SSE/WebSockets in v1) → renders progress state
                                          (Document 8 §7 requirement)
```

**Why polling, not push, in v1:** Document 4 §6 explicitly defers real-time progress UI. Polling is simpler to build correctly, has no persistent-connection scaling concern (irrelevant at this scale anyway, but still a simpler default), and the UX cost is minor given generation/verification targets (Document 5 §1) are measured in seconds to a few minutes, not hours.

**Retry/backoff:** every job that calls the Claude API or GitHub API wraps that call in exponential backoff (Document 5 §3). A job's terminal state is always one of `complete` or `failed` with a surfaced, specific error — never left indefinitely `running`, which is what Document 10's `VerificationRun.status` enum and equivalent generation-job status tracking exist to prevent.

## 5. Request Lifecycle: Spec Generation

1. User submits idea text (Epic B1) → API layer creates a `generation_job` record, enqueues it, returns job id.
2. Worker picks up job → Generation Service constructs a PRD-generation prompt → calls Claude API with structured-output schema (Zod, per Document 5 §5) → validates response against schema.
3. On success: Spec Service creates a new SpecVersion + PRDArtifact row (Document 10 §5.1–5.2) → job marked complete.
4. On validation failure (malformed structured output): retry once with a corrective prompt before surfacing failure — this is a Generation Service concern, not a generic job-retry concern, since the fix is prompt-level, not transport-level.
5. User reviews/edits (Epic B3) → edits write directly to a *new* SpecVersion (Design Principle 2, Document 10) — even a single-field edit is a new immutable version, not a patch.
6. Subsequent stages (Architecture, Schema, API, Repo/Roadmap, Tasks) repeat this pattern, each stage's prompt including the prior stages' current artifacts as context — this is the literal mechanism behind Document 1 Principle 1 ("every artifact derives from the one before it").

## 6. Request Lifecycle: Verification

This is the flow Document 7 identifies as the highest-stakes moment in the product, and the architecture reflects that with the most deliberate sequencing in the system:

1. User triggers verification (Epic G3) → API layer creates a `VerificationRun` row (status `queued`) referencing the Project's `current_spec_version_id` at that exact moment (Document 10 §6.2) → enqueues job.
2. Repo Service ingests the connected repository (Epic G2) — clones/reads files into ephemeral storage only (Document 5 §10), never executes anything.
3. **Tier 1 — Deterministic (status → `running_deterministic`):** Verification Service runs static analysis (tree-sitter/Semgrep-based, per Document 3/13) against the SchemaArtifact and APIArtifact's structured fields — endpoint existence, `auth_required` presence, field type matches. This tier makes zero Claude API calls, per Document 5 §9's cost constraint.
4. **Tier 2 — Semantic (status → `running_semantic`):** for anything Tier 1 flags as ambiguous or can't resolve structurally (e.g., "auth check exists — does it enforce the correct `required_role`?"), Verification Service batches relevant code + spec context into Claude API calls. Document 5 §1 requires this batched, not one-call-per-file, both for latency and cost.
5. Findings from both tiers are written to the `Finding` table (Document 10 §6.3), each tagged with `detection_tier`, `severity`, `spec_area`, and `spec_element_ref`.
6. `VerificationRun.status → complete` (or `failed`, with the run resumable per Document 5 §3 — a crash mid-Tier-2 should not force Tier 1's already-computed findings to be discarded and recomputed).
7. Client polls, then renders the Findings dashboard (Document 8 §5).

## 7. Data Flow Diagram (Textual)

```
                         ┌────────────────┐
                         │   Frontend      │
                         └───────┬────────┘
                                 │ REST/HTTP
                         ┌───────▼────────┐
                         │   API Layer     │  (auth, validation, job creation)
                         └───────┬────────┘
              ┌──────────────────┼──────────────────┐
      ┌───────▼───────┐  ┌───────▼────────┐  ┌───────▼────────┐
      │ Generation Svc │  │  Spec Service   │  │ Verification Svc│
      └───────┬───────┘  └───────┬────────┘  └───────┬────────┘
              │                  │                     │
      ┌───────▼──────────────────▼─────────────────────▼───────┐
      │                    Job Queue / Workers                  │
      └───────┬──────────────────────────────────────┬─────────┘
              │                                        │
      ┌───────▼───────┐                       ┌────────▼────────┐
      │  Claude API    │                       │   Repo Service   │
      └───────────────┘                       └────────┬────────┘
                                                          │
                                                 ┌────────▼────────┐
                                                 │   GitHub API     │
                                                 └─────────────────┘
                                 │
                         ┌───────▼────────┐
                         │   Postgres      │  (all persistent state, Document 10)
                         └────────────────┘
```

## 8. Cross-Cutting Concerns

- **Observability (Document 5 §7):** every job records structured logs at enqueue, start, and completion/failure, including Claude API latency and token usage — this is what feeds Document 5 §9's cost-visibility requirement, so it's built into the Job Queue layer itself rather than added per-service inconsistently.
- **Rate limiting (Document 5 §4):** enforced at the API layer, specifically stricter on routes that enqueue Generation/Verification jobs than on read-only routes, since those are the costly-to-abuse ones.
- **Type safety (Document 5 §5):** Zod schemas used for Claude structured-output validation (§5 above) are the same schemas used for API request/response validation and frontend type generation — one definition, three consumers, per Document 5's shared-contract requirement.

## 9. What This Document Deliberately Does Not Specify

- Exact job queue technology choice (Postgres-backed vs. Redis-backed) — tradeoff resolved in Document 18 (Scalability Strategy), since it's fundamentally a scaling/ops decision.
- Prompt engineering details for Generation/Verification Services — Document 13 (AI Architecture).
- Deployment topology (containers, hosting provider, environments) — Document 17 (Deployment Architecture).
- Threat model and detailed auth/session mechanics — Document 16 (Security Architecture).

## 10. Open Questions Carried Into Later Documents

- Whether Tier 2 semantic checks should run as one batched multi-file call per run or several smaller batched calls with intermediate checkpointing (relevant to the "resumable on failure" requirement in §6 step 6) — resolved in Document 13, since it's a prompt/context-window tradeoff.
- Ephemeral repo storage lifetime — how long ingested files persist post-run before deletion (Document 5 §10 says "no longer than a verification run requires," but the exact mechanism — in-memory only vs. short-TTL disk cache — is a Document 16/17 decision.
- Job queue technology's implication for the 100-concurrent-run scalability target (Document 5 §2) — flagged here, resolved with real tradeoff analysis in Document 18.