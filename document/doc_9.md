# Document 9: Feature Breakdown

## 1. Purpose and Scope

Document 4 defined *what the platform must do*, organized by epic. Document 8 defined *where things live*. This document translates both into a prioritized, buildable feature list — the level of granularity that feeds directly into Document 19 (Development Roadmap) and Document 20 (Sprint/Task Planning). Each feature carries a priority tier, its epic and screen references, and the specific severity taxonomy for Findings that Document 4 §9 flagged as an open question to resolve here.

Priority tiers use Document 4's MVP/Later labels, split further where sequencing within MVP matters:

- **MVP-Core** — the minimum slice needed for Journey 1 (Document 7) to be completable end-to-end, including one full pass through Journey 2.
- **MVP-Complete** — required for v1 launch quality but not required to prove the core loop internally.
- **Later** — explicitly deferred, per Document 4 §6 or new deferrals identified here.

## 2. Feature List by Epic

### Epic A — Workspace & Project Management

| Feature | Priority | Screen (Doc 8) | Notes |
|---|---|---|---|
| Auth (sign up / log in) | MVP-Core | Login/Sign-up | Better Auth per Document 5 §4 |
| Auto-provisioned personal workspace | MVP-Core | (invisible) | Zero user-facing setup step |
| Create Project | MVP-Core | Idea Input | Name only at creation — description comes from the idea prompt itself |
| Projects List | MVP-Core | Projects List | Name, last-updated, spec status badge |
| Project Dashboard | MVP-Core | Project Dashboard | Per Doc 8 §6, this is the highest-leverage retention screen — build early, iterate |

### Epic B — PRD Generation

| Feature | Priority | Screen (Doc 8) | Notes |
|---|---|---|---|
| Idea input with length guidance | MVP-Core | Idea Input | Guidance text is a small feature with outsized effect on Document 7's "vague prompt" failure mode — worth real design attention, not a placeholder |
| Structured + narrative PRD generation | MVP-Core | PRD View/Edit | Problem statement, target users, prioritized features, non-goals, success criteria |
| Inline PRD editing | MVP-Core | PRD View/Edit | Structured fields editable directly |
| Full PRD regeneration with refined prompt | MVP-Core | PRD View/Edit | |
| Section-level regeneration | Later | PRD View/Edit | Document 4, B4 — genuinely lower priority since full regeneration unblocks Journey 1 on its own |

### Epic C — Architecture Generation

| Feature | Priority | Screen (Doc 8) | Notes |
|---|---|---|---|
| Architecture generation derived from PRD | MVP-Core | Architecture View/Edit | Component diagram, services/modules, data flow, tech choices with rationale |
| PRD traceability links per component | MVP-Core | Architecture View/Edit | This is Document 3's differentiation made concrete — not optional polish |
| Manual override with conflict surfacing | MVP-Complete | Architecture View/Edit | Preservation-through-regeneration logic (Epic C3) is non-trivial; core generation must work first |

### Epic D — Database Schema Generation

| Feature | Priority | Screen (Doc 8) | Notes |
|---|---|---|---|
| Schema generation (entities, fields, types, relationships, constraints) | MVP-Core | Schema View/Edit | This is the artifact deterministic verification depends on most (Epic H1) — quality here has downstream effects on the whole verification engine |
| Structured (machine-readable) representation | MVP-Core | Schema View/Edit | Format decided in Document 13 |
| Visual ER diagram | MVP-Complete | Schema View/Edit | Human-review value is real but the structured format is what verification needs to function |

### Epic E — API Design Generation

| Feature | Priority | Screen (Doc 8) | Notes |
|---|---|---|---|
| API endpoint generation with auth fields | MVP-Core | API Design View/Edit | Auth as explicit structured field, not prose — the flagship verification scenario (Document 2) depends entirely on this being unambiguous |
| Endpoint review/edit | MVP-Core | API Design View/Edit | |

### Epic F — Repository Structure & Roadmap Generation

| Feature | Priority | Screen (Doc 8) | Notes |
|---|---|---|---|
| Repo structure generation | MVP-Complete | Repo Structure View | Valuable but not on the critical path to a first verification run |
| Roadmap generation (phased) | MVP-Complete | Roadmap View | |
| Task breakdown with full traceability | MVP-Core | Task List/Export | Tasks are what Priya actually hands to Claude Code (Document 7, Stage 7) — this is load-bearing for Journey 1, not deferrable |
| Task export (structured markdown) | MVP-Core | Task List/Export | Must paste cleanly into an external coding tool — Document 7 flags broken export as a wasted-effort failure point |

### Epic G — Repository Connection

| Feature | Priority | Screen (Doc 8) | Notes |
|---|---|---|---|
| GitHub OAuth connection (read-only) | MVP-Core | Repo Connection | Structural read-only enforcement per Document 5 §4 |
| Repository ingestion for analysis | MVP-Core | Repo Connection | Files read, never executed |
| Manual verification trigger | MVP-Core | Verification Run — Trigger/Progress | |
| CI-triggered automatic verification | Later | — | Document 4 explicitly defers this; manual trigger proves the loop first |

### Epic H — Verification Engine

| Feature | Priority | Screen (Doc 8) | Notes |
|---|---|---|---|
| Deterministic checks (endpoint existence, auth presence, schema field/type match) | MVP-Core | Verification Run, Findings Dashboard | No LLM call — this tier exists specifically to be fast and free (Document 5 §9) |
| Semantic/LLM checks (auth correctness, logic-level drift) | MVP-Core | Findings Dashboard | Only invoked where deterministic checks can't resolve, per Document 5's cost constraints |
| Structured Findings output | MVP-Core | Findings Dashboard, Finding Detail | Severity, spec element, file/line, plain-language explanation |
| Findings dashboard (severity + spec-area grouping) | MVP-Core | Findings Dashboard | Per Doc 8 §6, toggle between groupings rather than separate screens |
| SpecVersion traceability on runs | MVP-Core | Findings Dashboard, Version context bar | Epic H4 — required for Principle 4 (Doc 8) to hold at all |
| Acknowledge/won't-fix on findings | Later | Finding Detail | Document 4 explicitly marks this Later; additive to an existing screen per Doc 8 §10 |

### Epic I — Spec & Version Management

| Feature | Priority | Screen (Doc 8) | Notes |
|---|---|---|---|
| Immutable SpecVersion on every generation/edit | MVP-Core | (system-level) | Foundational — verification's integrity depends on this existing from day one, not retrofitted |
| Version history list | MVP-Core | Version History | |
| Structured-field version diff | MVP-Complete | Version Diff | Document 4 marks prose diffing Later; structured diffing is more directly useful and cheaper to build correctly |

## 3. Findings Severity Taxonomy (resolves Document 4 §9)

| Severity | Definition | Example |
|---|---|---|
| **Critical** | Spec requirement entirely unmet in a way that creates a security or data-integrity risk | Endpoint spec requires auth; implementation has none |
| **High** | Spec requirement partially or incorrectly implemented, non-security | Endpoint enforces the wrong role; schema field has the wrong type |
| **Medium** | Spec element present but diverges in a way unlikely to cause direct harm | Field naming/shape drift that still functions but breaks the contract |
| **Low** | Cosmetic or non-binding drift | Extra field present in implementation, not in spec, with no apparent conflict |
| **Info** | Verification could not conclusively determine a match (ambiguous case) | Semantic check inconclusive; surfaced for human judgment rather than suppressed |

This taxonomy applies uniformly across both deterministic (H1) and semantic (H2) checks — a deterministic check can produce a Critical finding just as easily as a semantic one; severity is about impact, not which tier caught it. This taxonomy is also the basis for the "auto-derived, zero authoring effort" claim in Document 3's competitive response to a Semgrep-based stack — severities come from the spec structure itself, not hand-written per-project rules.

## 4. Feature Dependencies Worth Flagging Early

- **Task export quality (F4) depends on task generation quality (F3), which depends on the full traceability chain being intact from B through F** — a break anywhere upstream degrades the one artifact that determines whether Journey 1 completes at all. This is the single most sequencing-sensitive dependency in the MVP-Core list.
- **Deterministic verification (H1) depends on schema/API structured formats being genuinely machine-parseable (D2, E1/E2)**, not just human-readable. If those artifacts are generated as good-looking prose with structured fields bolted on loosely, H1 silently degrades into H2-style LLM checking for everything — quietly breaking Document 5 §9's cost constraint without an obvious failure signal.
- **The version context bar (Document 8 §6) has no dedicated feature line above because it's cross-cutting** — it must be implemented alongside Epic I's SpecVersion model and Epic H's run-to-version linkage simultaneously, not bolted on after either ships independently.

## 5. Explicitly Deferred (confirmed Later, consolidated from Document 4 and this document)

- Section-level PRD regeneration (B4)
- Manual architecture-edit conflict surfacing beyond basic preservation (C3, partial)
- CI/CD-triggered automatic verification (G4)
- Finding acknowledge/won't-fix (H6)
- Prose-level version diffing (I3, partial — structured diffing ships in MVP-Complete)
- Team invites, RBAC, billing (Document 4 §6, unchanged)
- Spec import from external tools (Document 3/4, unchanged — noted again here as a plausible Document 21 item)

## 6. Open Questions Carried Into Later Documents

- Exact LLM prompting strategy for keeping semantic verification (H2) cost-bounded per Document 5 §9 while still catching genuine logic-level drift — resolved in Document 13 (AI Architecture).
- Whether Repo Structure and Roadmap generation (both MVP-Complete here) can be safely sequenced *after* a working PRD→Architecture→Schema→API→Tasks slice, or whether Tasks generation (MVP-Core) has a hard dependency on Roadmap existing first — resolved in Document 19 (Development Roadmap), since it's a sequencing question, not a scope question.
- Final call on Version Diff screen placement (dedicated screen vs. drawer off History, per Document 8 §10) — resolved in Document 12 (UI/UX Design).