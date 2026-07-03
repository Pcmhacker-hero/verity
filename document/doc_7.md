# Document 7: User Journey

Mapped for the primary persona (Priya, Document 6). Two journeys: the first-time journey (idea → first verification) and the return loop (the habitual usage pattern that determines whether this becomes a tool she keeps using or abandons after one try).

---

## Journey 1: First-Time — Idea to First Verification

| Stage | Priya's Goal | Actions | System Response | Emotional State | Friction Risk |
|---|---|---|---|---|---|
| **1. Trigger** | Wants to build a new side project without repeating past mistakes | Hears about the tool, or hits it after a previous project's AI-generated code had a security embarrassment | — | Cautiously curious, slightly skeptical (per Document 6's noted objection to "yet another AI tool") | If positioning sounds like every other AI app builder, she bounces before signing up |
| **2. Sign-up** | Get in and start quickly | Creates account | Personal workspace auto-provisioned invisibly (Document 4, Epic A1) | Neutral — wants this step to be forgettable | Any friction here (long forms, forced team setup) contradicts the "fast" promise |
| **3. Idea input** | Describe her product idea without overthinking the prompt | Types a few sentences describing the product (Epic B1) | Accepts free text, gives lightweight guidance on useful detail to include | Slightly uncertain — "will this understand what I actually mean?" | Vague prompts producing vague specs is the single biggest early trust-breaker |
| **4. PRD review** | See her idea reflected back accurately | Reviews generated PRD (Epic B2/B3) | Structured PRD + narrative, editable inline | **First trust moment** — if the PRD is generic boilerplate, she disengages here; if it's sharp and specific, she continues with confidence | Genericness is the failure mode to design against hardest |
| **5. Architecture review** | Confirm the technical shape makes sense | Reviews generated architecture, sees it explicitly traces to PRD features (Epic C2) | Component diagram + rationale | Growing confidence — this is the point where "this actually thought about my product" lands, or doesn't | Architecture that looks templated/copy-pasted across projects breaks trust immediately |
| **6. Schema & API review** | Sanity-check the technical details she cares most about as a backend-leaning dev | Reviews schema (Epic D) and endpoint definitions with auth rules (Epic E) | Structured, visual + machine-checkable formats | Engaged, possibly editing directly — this is where her technical expertise wants to assert itself, and the tool should welcome that, not resist it | If edits aren't respected through regeneration (Epic C3's requirement), she loses trust in the whole pipeline |
| **7. Roadmap & tasks** | Get something she can actually hand to Claude Code | Reviews phased roadmap and task list (Epic F2/F3), exports tasks (F4) | Tasks reference specific PRD/architecture/schema/API elements | Practical, task-focused — "okay, let's see if this actually works" | If exported tasks don't paste cleanly into her existing coding tool, the whole planning phase becomes wasted effort |
| **8. Build (off-platform)** | Actually build the thing | Uses Claude Code/Cursor with the exported tasks | *(outside the platform — Document 1's explicit non-goal)* | Focused, in her normal flow | This is a deliberate handoff, not a gap — see Document 1 Principle "companion, not replacement" |
| **9. Return & connect repo** | Check whether what got built matches what she planned | Connects GitHub repo (Epic G1) | Read-only OAuth, repo ingested (G2) | A little anxious — this is the moment of truth | If OAuth/connection flow is clunky, this is a natural drop-off point since there's no immediate reward yet |
| **10. Trigger verification** | Get the actual answer | Runs verification manually (Epic G3) | Two-tier check runs (deterministic then semantic, Epic H1/H2) | Waiting, slightly tense | Needs visible progress state (Document 5, Usability) — a silent multi-minute wait here is dangerous for trust |
| **11. Review findings** | Learn something she didn't already know | Reviews structured findings dashboard (Epic H3/H5) | Severity-grouped, spec-grounded findings with plain-language explanations | **The aha moment** — if a finding surfaces something real (e.g., a missing auth check she genuinely didn't catch), this is the moment the product's whole value proposition lands | If findings are noisy, generic, or wrong, this is the moment she uninstalls — false positives are more damaging here than anywhere else in the journey |
| **12. Act on findings** | Fix what matters | Returns to Claude Code/Cursor to address findings, or marks acknowledged (H6) | — | Validated if the fix was real; irritated if it wasn't | — |

## Journey 2: The Return Loop (what determines retention)

This is the loop that matters more than Journey 1 for whether the product survives past a single use:

1. **Spec evolves.** Priya adds a feature; she edits or regenerates part of the spec (creating a new immutable SpecVersion, per Epic I1).
2. **She builds the new feature** in her existing coding tool.
3. **She re-runs verification** against the new SpecVersion — not from scratch, just a habitual check before she considers the feature done.
4. **Findings either confirm she's clean, or catch drift** — either outcome reinforces the habit: a clean run builds confidence in her own AI-assisted output, a caught issue reinforces why the tool earns its place in her workflow.
5. **Over multiple cycles, the SpecVersion history (Epic I2/I3) becomes a real asset** — a record of what the product was supposed to do at each stage, useful even beyond verification (for her own memory of past decisions).

**The retention thesis:** Journey 1 sells the product once. Journey 2 — a fast, low-friction "build, then check" habit — is what makes it a tool she reaches for weekly rather than a one-time novelty. Document 9 (Feature Breakdown) and Document 19 (Roadmap) should prioritize reducing friction in Journey 2's loop (steps 1–3 especially) over polishing Journey 1 further once the core loop works.

## Critical Moments Summary

| Moment | Why it matters | Document reference |
|---|---|---|
| PRD review (Stage 4) | First trust checkpoint — genericness kills adoption immediately | Document 13 (AI Architecture) must prioritize specificity over safe/generic output |
| Findings review (Stage 11) | The actual "aha" — the entire product thesis is validated or invalidated in this single moment | Document 13's verification engine design is the highest-stakes design work in this whole blueprint |
| Re-verify habit (Journey 2, step 3) | Determines retention, not just initial adoption | Document 9/19 should treat loop friction reduction as a priority, not a polish item |

## Drop-off Risks Worth Designing Against Explicitly

- **Generic output at any generation stage** — worse than slow output, because it signals the tool doesn't actually understand the specific product, undermining every downstream stage's credibility too.
- **False positives in verification findings** — more damaging than false negatives, because a wrong finding costs Priya's trust immediately, while a missed finding just means the tool didn't help *this time*.
- **Any point where the platform feels like it's trying to replace her coding tool rather than support it** — contradicts the core positioning from Document 1 and risks the exact reaction Document 3 flagged about competing with incumbents she already trusts.