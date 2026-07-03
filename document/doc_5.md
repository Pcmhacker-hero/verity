# Document 5: Non-Functional Requirements

## 0. Relationship to Other Documents

This document sets **targets and principles**. Detailed implementation lives elsewhere: Document 16 (Security Architecture) implements the security targets below, Document 17 (Deployment Architecture) implements availability/infra targets, Document 18 (Scalability Strategy) implements the scalability targets. Duplicating implementation detail here would create drift between documents — a mistake this whole planning process is explicitly designed to avoid (see Document 1, Principle 1).

**Confirmed scoping assumption carried from Document 4:** v1's deterministic verification (Epic H1) targets TypeScript/JavaScript backends specifically — the dominant stack across Bolt/Lovable/v0-generated projects per Document 3, and therefore where the target user's repositories actually live. This assumption shapes several targets below and should be revisited only if Document 4's scope changes.

## 1. Performance

| Target | Metric | Rationale |
|---|---|---|
| PRD generation | Complete in under 30 seconds (p95) | Single LLM call with structured output; anything longer breaks the "idea to plan in minutes" promise from Document 1 |
| Full pipeline generation (PRD → tasks) | Complete in under 5 minutes end-to-end (p95), including user review pauses excluded | Matches Document 1's Success Vision ("under ten minutes") with margin |
| Deterministic verification pass (Epic H1) | Under 60 seconds for a repo up to ~500 files | Static analysis should feel near-instant relative to the semantic pass |
| Semantic verification pass (Epic H2) | Under 3 minutes for a repo up to ~500 files | LLM-bound; batched/parallelized calls where possible, not one call per file |
| Dashboard/UI interactions | Under 200ms perceived response for non-generation actions (navigation, viewing specs) | Standard SPA responsiveness expectation |

## 2. Scalability

Given this is a portfolio project, targets are set to be **architecturally honest, not artificially inflated** — the goal is a design that wouldn't need to be re-architected if usage grew, not a claim of enterprise-scale traffic on day one.

- System should handle **100 concurrent verification runs** without degradation, via the background job architecture (Document 11).
- Database schema and service boundaries (Document 10/11) should not require redesign to support multi-tenancy at 10,000+ workspaces — this is why Document 1's Org/Membership model exists from day one, per earlier domain design work.
- LLM API calls are the most expensive and most rate-limited resource in the system; scalability strategy (Document 18) must specifically address request queuing/backoff, not just "add more servers."

## 3. Reliability & Availability

- **Target: 99.5% uptime** for the web application and API — appropriate for a portfolio-stage product, not claiming five-nines with no operational team to back it.
- All LLM API calls must have retry logic with exponential backoff and a defined failure mode (surfaced to the user as a clear error, never a silent hang).
- Verification runs must be resumable/re-runnable on failure — a crashed run should not corrupt spec state or require the user to reconfigure anything.
- Generation and verification are asynchronous by design (Document 11) specifically so a slow or failed LLM call never blocks the UI thread or looks like the application has frozen.

## 4. Security (targets only — see Document 16 for implementation)

- All data encrypted in transit (TLS) and at rest (database-level encryption via managed Postgres provider).
- Repository access is **read-only** at the GitHub OAuth scope level — the platform should be structurally incapable of writing to or executing code in a connected repository, not merely policy-restricted from doing so.
- No secrets (API keys, tokens) ever logged, persisted in plaintext, or exposed in client-side responses.
- Session/auth tokens follow Better Auth's default security posture (Document 16 to confirm no weakening of defaults).
- Rate limiting on all public-facing API endpoints to prevent abuse of LLM-backed routes specifically, since those are the most costly to exploit.

## 5. Maintainability

- Minimum automated test coverage: unit tests on all generation and verification service logic (LLM calls mocked), integration tests on all API endpoints, at least one end-to-end test per epic from Document 4.
- Shared type contracts (Zod schemas, per earlier domain design) between LLM structured output, database layer, and frontend — one definition, enforced everywhere, to prevent the type-drift risk that a solo-maintained codebase is especially vulnerable to.
- CI must block merges on lint, typecheck, and test failure — no manual override path for a solo builder to accidentally normalize skipping checks.
- Documentation: every generated artifact type (PRD, architecture, schema, API, tasks) has its structured schema documented in-repo, not only inferable from code.

## 6. Usability & Accessibility

- WCAG 2.1 AA as the accessibility target for all user-facing screens — a reasonable, achievable bar for a portfolio project, and a genuine signal of production-mindedness in review.
- Responsive design down to tablet width (1024px); mobile-first is not required given the product's inherently desktop-oriented workflow (reviewing architecture diagrams, code findings), but the app should not break on smaller viewports.
- Every long-running operation (generation, verification) must show progress state — never a bare spinner with no context, given these operations can take minutes.

## 7. Observability

- Error tracking (Sentry) on both frontend and backend from day one, not added retroactively.
- Structured logging on all LLM calls: latency, token usage, and success/failure — this data is required for Section 9's cost visibility, not just debugging.
- Basic usage metrics (generation runs, verification runs, findings surfaced) tracked from v1, even with no dashboard consuming them yet — cheap to log now, expensive to reconstruct retroactively.

## 8. Compatibility

- Modern evergreen browsers only (Chrome, Firefox, Safari, Edge, last 2 versions) — no legacy browser support, consistent with the target user (technical, current tooling).
- v1 verification engine: TypeScript/JavaScript backends only, as scoped above. Explicitly not a v1 requirement to support Python/Go/Java repositories — this is a stated limitation, not an oversight, and should be communicated clearly in-product rather than silently failing on unsupported repos.

## 9. Cost Constraints

This is a real non-functional requirement for a solo-funded portfolio build, not just an engineering nicety:

- Every generation and verification operation must have a bounded, predictable LLM token cost — no unbounded agentic loops that could run away on cost during development or demoing.
- Deterministic checks (Epic H1) must run before any LLM call in the verification pipeline specifically to minimize token spend — this cost-driven design decision was already established in Document 4's two-tier verification requirement, and it's worth restating here as a non-functional constraint, not just a functional nicety.
- Development/staging environments should default to a cheaper or mocked LLM configuration where feasible, reserving full-cost model calls for demonstration and production use.

## 10. Data Privacy / Compliance

- No enterprise compliance certification (SOC 2, HIPAA, etc.) targeted for v1, consistent with Document 1's explicit non-goal of enterprise customers.
- Users must be able to export or delete their data (specs, findings, account) on request — a baseline data-ownership commitment consistent with Document 1's "own your plan, own your code" principle, and good practice regardless of formal compliance requirements.
- Repository code is analyzed in-memory/ephemeral storage only where possible; persistent storage should favor derived artifacts (specs, findings) over retaining full repository copies longer than a verification run requires.