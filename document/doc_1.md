# Document 1: Product Vision

**Working name:** Verity *(placeholder — "specify intent, verify reality"; open to ren  aming)*

---

## 1. Vision Statement

Turning an idea into shipped software today means stitching together a dozen disconnected tools and hoping nothing gets lost in translation: a PRD written in one place, architecture sketched in another, an AI coding tool building from whatever fragment of context fits in its prompt, and no one — human or machine — checking the final result against what was actually intended. Verity is an AI-native software engineering platform that takes an idea through the full pre-build lifecycle — PRD, architecture, database schema, API design, repository structure, roadmap, and developer tasks — as one connected, structured pipeline, and then **verifies that whatever gets built, by any tool, still honors every decision made along the way.**

## 2. Problem Statement

Two separate but related gaps exist in how solo developers and small teams build with AI today:

**The planning gap.** AI coding tools (Bolt, Lovable, v0, Cursor, Claude Code) are exceptional at generating code from a prompt, but weak at generating the *thinking* that should precede it — a real PRD, a deliberate architecture, a schema that won't need to be redesigned at 10x the data. Developers either skip this thinking under time pressure, or do it themselves across scattered docs, notes, and mental models that the coding tool never sees.

**The trust gap.** Even when planning artifacts exist, nothing checks the implementation against them. A solo developer describes an admin-only endpoint in their PRD; three AI-assisted iterations later, the auth check is gone, or never existed on every route. No tool in the current landscape verifies output against original intent — only against generic code-quality rules, or after-the-fact human review the solo developer usually doesn't have.

Verity addresses both: it generates the connected planning artifacts an AI-assisted build should start from, and it closes the loop by verifying the result against them.

## 3. Product Vision (North Star)

In its mature form, Verity is where a developer takes an idea from "rough concept" to "structured, buildable plan" in minutes — PRD, architecture, schema, API contracts, repo scaffold, and a task breakdown, all derived from and consistent with each other, not generated in isolation. From there, the developer builds — with whatever AI coding tool they already use — and brings the result back to Verity, which checks it against the plan and surfaces exactly where reality drifted from intent.

The long-term differentiator is not "we can also generate a PRD" — every AI tool is creeping toward that. It's that Verity is the only platform where what gets generated is treated as a **checkable contract**, not a document that goes stale the moment building starts.

## 4. Target Users

**Primary:** Solo developers and indie hackers building real products with AI coding tools, who currently either skip proper planning under time pressure or do it manually across disconnected tools, and who have no second engineer to catch drift between plan and implementation.

**Secondary (future):** Small dev teams (2–10 engineers) at early-stage startups, where planning artifacts need to be shared across people and verification substitutes for thin code-review capacity.

**Explicitly not targeting (v1):** Enterprise engineering orgs with existing mature planning/compliance tooling — plausible future market, not the v1 wedge.

## 5. Core Value Proposition

| What competitors give you | What Verity gives you |
|---|---|
| A PRD generator, or an architecture generator, or a schema generator — usually standalone, disconnected tools | One connected pipeline where the architecture is derived from the PRD, the schema from the architecture, the API from the schema — consistent by construction, not by manual reconciliation |
| Planning artifacts that go stale the moment coding starts | Planning artifacts treated as a living, versioned contract the implementation gets checked against |
| Code that matches general best practices (linters, generic AI reviewers) | Code that matches **the specific plan you approved** — grounded verification, not generic pattern matching |
| "Here's a bug" | "Here's where the implementation silently dropped a requirement from your architecture/API design" |

## 6. What This Is Not

- Not a UI/design generator (Flowstep's actual domain) — no canvas, no Figma sync, no visual design suggestions.
- Not a replacement for Cursor/Copilot/Claude Code — Verity plans and verifies; it does not write the implementation itself in v1.
- Not a generic linter, SAST tool, or standalone "AI PRD generator" — every artifact is part of one connected pipeline and is what verification checks against, not a disconnected output.
- Not, in v1, an enterprise compliance/audit platform — plausible later expansion, not the wedge.

## 7. Product Principles

1. **Every artifact derives from the one before it.** The architecture must be traceable to the PRD, the schema to the architecture, the API to the schema — not independently generated and hoped into consistency.
2. **Planning artifacts are contracts, not documents.** If it isn't structured and checkable, verification can't use it later.
3. **Verification is the differentiator, not a feature among equals.** Every other piece of the pipeline exists to give verification something precise to check against.
4. **Verification should be cheap before it's clever.** Deterministic checks run first and free; LLM judgment is reserved for what pattern-matching genuinely can't catch.
5. **Never execute untrusted code.** Verity reads and analyzes; it does not run the user's application.
6. **Own your plan, own your code.** No lock-in — every artifact and finding is exportable; the tool never gatekeeps the user's own work.
7. **Built for a workflow that already exists.** Verity plugs into how developers already build (git, CI, PRs, their existing AI coding tool) rather than demanding they replace their toolchain.

## 8. Success Vision (Aspirational, for planning purposes)

- A user can go from rough idea to a full, internally consistent planning package (PRD → architecture → schema → API → repo scaffold → tasks) in under ten minutes.
- Handing that package to an AI coding tool produces implementations that need meaningfully less rework than starting from a prompt alone.
- A verification run on the resulting repository surfaces findings a careful human reviewer would also flag, specific enough to act on, without false-positive noise that trains users to ignore it.
- The product feels like a thoughtful technical co-founder who did the planning *and* checked the homework — not a document generator and a linter bolted together.

## 9. Guiding Constraints for This Project

- Solo-built, portfolio-quality: architecture decisions should be defensible in a technical interview, not just functional.
- Designed to scale conceptually (multi-tenant data model, clean service boundaries, a pipeline that can add stages later) even where v1 usage will be low.
- Feature-by-feature build only after this full planning blueprint (Documents 1–21) is complete and approved.
- Broader scope than a point tool means phased delivery matters even more — the Development Roadmap (Document 19) will need to sequence which pipeline stages ship first without the whole platform being an all-or-nothing bet.