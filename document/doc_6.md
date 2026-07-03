# Document 6: User Personas

Four profiles: the primary persona the MVP is built for, a secondary persona representing near-term expansion, an edge case worth naming explicitly rather than ignoring, and an anti-persona — who this product is deliberately not for in v1. Naming who you're *not* building for is as useful as naming who you are; it keeps scope creep visible when it happens later in the process.

---

## Primary Persona: Priya, the Indie SaaS Builder

**Snapshot:** 27, backend-leaning full-stack developer, ex-startup employee, now building her own SaaS product part-time while freelancing. Comfortable with code, not interested in reviewing every line an AI tool generates.

**Goals:**
- Ship a real, monetizable product without hiring or waiting on anyone else.
- Move fast without accumulating the kind of technical debt that makes a solo codebase unmaintainable within months.
- Feel confident enough in what's shipped to put it in front of paying users.

**Current toolchain:** Claude Code for implementation, GitHub for version control, Vercel/Railway for deployment, no dedicated planning tool — PRDs live in a personal Notion doc she often doesn't update after the first week.

**Pain points (grounded in Document 2's research):**
- She's part of the population <cite index="27-3">where the cost of building a functional SaaS product has dropped from roughly $200,000 to about $5,000, with build timelines compressing from six months to six weeks</cite> — she's shipping faster than she can review.
- She's read enough about the <cite index="27-1">45% OWASP Top-10 failure rate in AI-generated code</cite> to be nervous, but has no second engineer to catch what she misses, and doesn't have budget for a dedicated security consultant at her stage.
- Her PRD and her actual codebase have drifted apart by week three of any project — not from carelessness, but because nothing keeps them in sync as she iterates with her AI coding tool.

**What brings her to Verity:** She wants the planning discipline she knows she *should* have, generated fast enough that it doesn't slow her down, plus a way to know — not guess — whether what Claude Code actually built still matches what she meant.

**Objections/hesitations:** Skeptical of "yet another AI tool" claiming to fix AI's problems; will abandon quickly if the generated PRD/architecture feels generic or the verification findings feel like noise rather than signal.

**Success looks like:** She generates a spec in minutes, builds with her existing tools, runs verification before a release, and it catches something real — the kind of thing that would've been an embarrassing bug report from a user two weeks later.

---

## Secondary Persona (near-term expansion): Marcus, the Early-Stage Technical Co-founder

**Snapshot:** 34, technical co-founder at a 4-person, recently-funded startup. Writes less code personally than he used to; spends more time reviewing what his two junior engineers ship, both of whom lean heavily on AI coding tools.

**Goals:**
- Maintain some architectural coherence across a codebase three people are all AI-accelerating independently.
- Reduce how much of his own time goes to being the de facto senior reviewer for everyone else's AI-assisted PRs.

**Pain points:** <cite index="52-2">Generic AI code review tools catch diff-level issues but explicitly don't reason about cross-file architectural drift</cite> — exactly the failure mode that matters most once more than one person is shipping into the same codebase.

**Relevance to this planning process:** Not the v1 build target (per Document 1's phasing), but the reason the Org/Membership data model exists from day one — Marcus's use case is additive once team features ship in a later phase, not a redesign.

---

## Edge Case (acknowledged, not optimized for in v1): Dana, the Non-Technical Founder

**Snapshot:** 41, former product manager, building a product solo using Lovable, with no formal engineering background.

**Why she's worth naming:** <cite index="27-2">63% of vibe coding users identify as non-developers — product managers, marketing directors, startup founders, and designers</cite>, and this population is large and growing <cite index="27-2">(Forrester estimates 16.2 million active citizen developers worldwide, with Gartner predicting they will outnumber professional engineers 4:1 by 2028)</cite>. Ignoring this segment in market sizing would be dishonest.

**Why v1 isn't built for her anyway:** Document 1 explicitly scopes the primary user as developers who already use AI coding tools as a companion, not a replacement. Dana doesn't read architecture diagrams or evaluate API contracts — a structured PRD/schema/API pipeline assumes a level of technical fluency she doesn't have and isn't trying to gain. Serving her well would require an entirely different UX paradigm (closer to Lovable's guided, non-technical-friendly flow) that would dilute the technical-user experience Priya needs.

**Where she fits later:** A plausible Document 21 (Future Roadmap) direction, not a v1 concern. Worth revisiting only after the core technical-user loop is proven.

---

## Anti-Persona: Elena, the Enterprise Engineering Director

**Snapshot:** 45, Director of Engineering at a 400-person company, evaluating tools for a 30-engineer org with existing compliance obligations.

**Why she's explicitly out of scope:** She needs SSO, audit logs, SOC 2 attestation, granular RBAC, on-prem/VPC deployment options, and procurement-friendly vendor security review — none of which v1 has or should have, per Document 1's non-goals and Document 5's explicit exclusion of enterprise compliance targets. If Elena's requirements start shaping v1 decisions, that's a sign of scope drift away from Priya, not organic growth toward her.

**Value of naming her anyway:** Every "should we add X" question during the build (Document 19/20) can be tested against a simple question: does this serve Priya, or does it only start to matter once Elena is the target? If it's the latter, it's correctly out of scope for now.