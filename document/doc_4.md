# Document 4: Functional Requirements (PRD)

## 1. Purpose and Scope

This document defines what the platform must *do* — functional capabilities only. Performance, security, and reliability targets live in Document 5 (Non-Functional Requirements). Detailed personas live in Document 6; this document assumes the primary user established in Document 1 (solo developers/indie hackers using AI coding tools) without re-deriving it.

## 2. Product Goals

1. Take a rough product idea from prompt to a complete, internally consistent planning package (PRD → architecture → schema → API design → repo structure → roadmap → tasks) that a developer or AI coding tool can build from.
2. Verify real, built code — from any source — against that spec, surfacing specific, actionable drift rather than generic lint findings.
3. Keep every artifact versioned and traceable, so verification always checks against a known, exact spec state, not "whatever the spec currently says."
4. Do all of this without requiring the user to abandon their existing AI coding tool (Cursor, Claude Code, Bolt, etc.) — Verity plans and verifies; it does not replace their builder.

## 3. Non-Goals (explicit exclusions, referencing Document 3's positioning findings)

- **Not a UI/canvas design tool.** No visual design generation, no Figma sync — this is Flowstep's domain, not this platform's.
- **Not a code generator.** The platform produces tasks; implementation happens in the user's own AI coding tool. This is a deliberate scope boundary, not a temporary limitation.
- **Not a generic PR-comment bot.** Per Document 3's Cluster 2 findings, that surface area is dominated by CodeRabbit/Greptile with enormous distribution advantages. Verification output is structured, spec-grounded findings — not a diff-scoped comment stream competing on the same turf.
- **Not, in v1, a multi-user real-time collaboration platform, a billing/subscription system, or an enterprise RBAC system.** These are legitimate future phases (see Document 19) but are explicitly out of MVP scope so the core loop gets built and proven first.

## 4. User Roles (v1)

| Role | Description |
|---|---|
| **Owner** | The user themself. Every account gets a personal workspace automatically (per the Org/Membership data model principle) even though team features aren't user-facing in v1. |
| *(Future)* Member, Admin | Reserved roles for Document 19's later-phase team features; not implemented in v1, but the data model accommodates them without redesign. |

## 5. Functional Requirements by Epic

### Epic A — Workspace & Project Management

| ID | Requirement | Acceptance Criteria | Priority |
|---|---|---|---|
| A1 | User can sign up / log in | Account created; personal workspace auto-provisioned | MVP |
| A2 | User can create a Project | Project has a name and belongs to the user's workspace | MVP |
| A3 | User can view a list of their Projects | List shows name, last-updated, and current spec version status | MVP |
| A4 | User can view a single Project's dashboard | Shows spec status, linked repo (if any), latest verification run summary | MVP |

### Epic B — PRD Generation

| ID | Requirement | Acceptance Criteria | Priority |
|---|---|---|---|
| B1 | User can describe a product idea in natural language | Free-text input, minimum/maximum length guidance shown | MVP |
| B2 | System generates a structured PRD from the idea | Output includes: problem statement, target users, core features (prioritized), explicit non-goals, success criteria — both structured fields and narrative prose | MVP |
| B3 | User can review and edit the generated PRD before proceeding | Inline editing of structured fields; regeneration option with a refined prompt | MVP |
| B4 | User can request regeneration of specific PRD sections without discarding the whole document | Section-level regeneration preserves unrelated sections | Later |

### Epic C — Architecture Generation

| ID | Requirement | Acceptance Criteria | Priority |
|---|---|---|---|
| C1 | System generates a technical architecture derived from the approved PRD | Output includes: high-level component diagram (structured, renderable), major services/modules, data flow between them, key technology choices with brief rationale | MVP |
| C2 | Architecture explicitly traces back to PRD features | Each major architectural component references which PRD feature(s) it exists to support — this traceability is what later distinguishes this from a disconnected architecture doc (Document 2's core differentiation) | MVP |
| C3 | User can edit or override generated architecture decisions | Manual edits are preserved through downstream regeneration where possible; conflicts are surfaced, not silently overwritten | MVP |

### Epic D — Database Schema Generation

| ID | Requirement | Acceptance Criteria | Priority |
|---|---|---|---|
| D1 | System generates a database schema derived from the architecture and PRD | Entities, fields, types, relationships, and key constraints (unique, required, foreign key) | MVP |
| D2 | Schema is represented in a structured, checkable format (not prose) | This is the artifact type verification will check most precisely against — see Document 13 (AI Architecture) for schema format details | MVP |
| D3 | User can view schema as both a visual ER-style diagram and structured data | Visual for human review, structured for machine use | MVP |

### Epic E — API Design Generation

| ID | Requirement | Acceptance Criteria | Priority |
|---|---|---|---|
| E1 | System generates API endpoint definitions derived from the schema and architecture | Each endpoint: method, path, request/response shape, and — critically — auth requirements | MVP |
| E2 | Auth/authorization rules are explicit, structured fields per endpoint, not prose | This is the single most important field for the verification engine's flagship use case (Document 2's "missing auth check" scenario) — it must be unambiguous and machine-checkable | MVP |
| E3 | User can review and edit endpoint definitions | Same edit/regenerate pattern as prior epics | MVP |

### Epic F — Repository Structure & Roadmap Generation

| ID | Requirement | Acceptance Criteria | Priority |
|---|---|---|---|
| F1 | System generates a proposed repository/folder structure consistent with the architecture | Output is a structured file/folder tree with brief purpose notes, not just prose description | MVP |
| F2 | System generates a development roadmap breaking the project into phases | Phases sequence logically (e.g., foundation before features that depend on it) | MVP |
| F3 | System breaks the roadmap into discrete developer tasks | Each task references the PRD feature, architecture component, and API/schema elements it implements — maintaining the traceability chain from Epic C through here | MVP |
| F4 | User can export the task list in a format usable by their AI coding tool | At minimum, structured markdown; task format should be usable as-is when pasted into Claude Code/Cursor as implementation instructions | MVP |

### Epic G — Repository Connection

| ID | Requirement | Acceptance Criteria | Priority |
|---|---|---|---|
| G1 | User can connect a GitHub repository to a Project | OAuth-based connection; read-only access scope | MVP |
| G2 | System can ingest repository contents for analysis | Files are read, not executed — this boundary is a Document 16 (Security Architecture) requirement surfaced here because it constrains what verification can and cannot check | MVP |
| G3 | User can trigger a verification run manually | On-demand run against the currently linked SpecVersion and current repo state | MVP |
| G4 | *(Later)* Verification runs automatically on push/PR via CI integration | Deferred — manual trigger proves the core loop first, per the "balanced scope" principle from earlier planning | Later |

### Epic H — Verification Engine (the differentiator — see Document 3)

| ID | Requirement | Acceptance Criteria | Priority |
|---|---|---|---|
| H1 | System runs deterministic checks first | Structured spec fields (endpoint existence, auth requirement presence, schema field presence/types) checked via static analysis — no LLM call required for this pass | MVP |
| H2 | System runs semantic/LLM-judgment checks second, only where deterministic checks can't resolve | E.g., "auth check exists but enforces the wrong role" — requires code + narrative spec context, not just pattern matching | MVP |
| H3 | Verification produces structured Findings, not free-form prose | Each finding: severity, the specific spec element violated, the file/line implicated, and a plain-language explanation | MVP |
| H4 | Findings are traceable to the exact SpecVersion checked against | Re-running verification after a spec edit produces a new run tied to the new version — old runs remain valid historical records | MVP |
| H5 | User can view findings in a dashboard, grouped by severity and spec area (auth, schema, API contract) | Sortable/filterable | MVP |
| H6 | User can mark a finding as acknowledged/won't-fix | Distinct from resolved — supports realistic workflows where not every finding gets fixed immediately | Later |

### Epic I — Spec & Version Management

| ID | Requirement | Acceptance Criteria | Priority |
|---|---|---|---|
| I1 | Every generation or edit creates a new immutable SpecVersion | No spec artifact is ever overwritten in place | MVP |
| I2 | User can view version history for any Project | List of versions with timestamps and a summary of what changed | MVP |
| I3 | User can view a diff between two spec versions | At minimum for the structured fields (schema, API); prose diffing is a nice-to-have | Later |

## 6. Out of Scope for v1 (deferred to later phases per Document 19)

- Team invites, multi-user collaboration, RBAC enforcement
- Billing/subscription and plan gating
- CI/CD-triggered automatic verification (GitHub Action/App)
- Spec import from external tools (Spec Kit, BMAD format) — noted in Document 3 as valuable future scope
- Real-time verification progress UI (SSE/WebSockets) — v1 uses simple polling/refresh

## 7. Assumptions and Dependencies

- Relies on Claude API for all generation and semantic verification steps; generation quality is bounded by underlying model capability, not purely by prompt engineering.
- Relies on GitHub's OAuth and REST/GraphQL APIs for repository access; no support for GitLab/Bitbucket in v1.
- Assumes users have at least one existing AI coding tool of their own choosing — the platform does not need to teach users how to build, only how to plan and verify.
- Deterministic verification (Epic H1) depends on static analysis tooling (Semgrep, tree-sitter per Document 3/13) supporting the target languages; v1 should scope to one or two languages/frameworks well rather than claiming broad language support prematurely.

## 8. Success Metrics (product-level, for this planning exercise's own evaluation)

- A user can go from idea to a complete, internally consistent artifact set (PRD → tasks) without needing to leave the platform.
- A verification run against a real, non-trivial repository surfaces at least one finding a careful human reviewer would also flag, with an explanation specific enough to act on without additional investigation.
- Every generated artifact traces to the one before it — verifiable by inspecting any task and confirming it references real PRD/architecture/schema/API elements, not orphaned content.

## 9. Open Questions Carried Into Later Documents

- Exact schema/notation for structured spec fields (EARS-style, per Document 2's research, or a custom format) — resolved in Document 13 (AI Architecture).
- Precise severity taxonomy for Findings — resolved in Document 9 (Feature Breakdown) or Document 13.
- Which language(s)/frameworks the verification engine targets first — resolved in Document 13, constrained by Document 5's non-functional scope decisions.