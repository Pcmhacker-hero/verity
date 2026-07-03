# Document 12: UI/UX Design

*Revision note: this version adds the production-readiness sections (Design Tokens, Design System/Component Library, Loading & Skeleton States, Error State Design, Notification System, Keyboard Shortcuts, Animation & Motion Guidelines, and an expanded Responsive Design section) needed to take this document from screen-level design to a build-ready specification. No prior content has been removed or reinterpreted; section numbers below have shifted to fit the new material in its natural place.*

## 1. Purpose and Scope

Document 8 defined *where things live* (information architecture); Document 9 defined *what gets built and when* (feature priority). This document defines *what it looks like and how it behaves* — the visual system, interaction patterns, and screen-level design for the MVP-Core and MVP-Complete features identified in Document 9. It resolves the three open questions Document 8 explicitly deferred here, and it does so by testing every decision against Document 7's Critical Moments (PRD review, Findings review, the re-verify habit) rather than against generic design best practice — a screen can be clean and still fail this product if it doesn't earn trust at those specific moments.

This document does not introduce new screens or navigation structure beyond what Document 8 established, and does not revisit entities beyond what Document 10 defined. Where a design decision would imply a new object or a new nav item, that's a signal to flag it back against Document 8/9 rather than resolve it silently here.

## 2. Design Principles

1. **Specificity is the product, so the UI must never look templated.** Document 7 names generic-looking output as the single biggest early trust-breaker (Stage 4) and the biggest reason a returning user disengages. Every generated-content screen (PRD, Architecture, Schema, API) must visually foreground content that's obviously derived from *this* project — traceability links, specific component names, specific field names — not a static form shell that happens to have text filled in.
2. **Findings are the hero screen, not a report.** Per Document 7 Stage 11 and Document 8 Principle 3, the Findings Dashboard gets the most deliberate visual design attention in the product. It should read more like a focused triage tool (severity-forward, scannable, low cognitive load per finding) than a scrolling audit log.
3. **Version awareness is ambient, not a chore.** Document 8 Principle 4 requires the current SpecVersion to always be visible. This document treats that as a persistent, quiet UI element (a context bar) rather than a modal or confirmation step — ambient awareness, not friction.
4. **Edits feel safe.** Document 4's Epic C3 (edits preserved through regeneration, conflicts surfaced not silently overwritten) has to be visually legible: a user editing a field needs to see, in the UI itself, that their edit is protected — otherwise the underlying guarantee is invisible and doesn't build trust even though it exists.
5. **Progress states carry information, not just motion.** Document 5 §6 and Document 8 §7 both require long operations to show real progress, not a bare spinner. Every progress state in this document names what's currently happening ("Running deterministic checks…" → "Running semantic analysis…"), because on the Verification flow specifically (Document 7 Stage 10), an unlabeled wait is where anxiety compounds.
6. **Density matches the persona, not a general audience.** Priya (Document 6) is a backend-leaning technical user who wants to move fast and self-serve on the technical stages (Schema, API — Document 7 Stage 6). The UI should default to information-dense, scannable layouts on those screens rather than heavily whitespaced consumer-app styling; only the Idea Input and onboarding-adjacent screens benefit from a lighter, lower-density treatment.

## 3. Visual System

### 3.1 Foundational choices

| Element | Decision | Rationale |
|---|---|---|
| Layout base | 8px spacing grid, 12-column responsive grid down to 1024px (Document 5 §6, Document 8 §8) | Standard, defensible, nothing exotic needed for a technical B2D tool |
| Typography | One monospace family for all code/spec-identifier content (endpoint paths, field names, file paths), one sans-serif for UI chrome and prose | Technical content (API paths, schema types) reads as *data*, not prose — reinforces Design Principle 1's "specific, not generic" feel and makes machine-checkable content visually distinct from narrative content |
| Color — severity | Fixed, non-configurable mapping: Critical = red, High = orange, Medium = yellow, Low = blue-gray, Info = neutral gray | Findings severity (Document 9 §3) is the single highest-stakes visual signal in the product; it must never be ambiguous or theme-dependent |
| Color — status | Green (clean/complete), amber (in progress/attention), gray (not yet run/inactive) | Reused consistently across Dashboard, Verify, and the version context bar so status recognition transfers across screens |
| Dark mode | Supported, not the default | Technical audience expectation; not core to trust-building so treated as a standard preference, not a design differentiator |
| Iconography | Minimal, functional only (severity, status, artifact type) — no illustrative/decorative icons on generated-content screens | Decorative UI on a PRD/Architecture screen undercuts Design Principle 1; the content should feel like *substance*, not a styled document template |

### 3.2 The Version Context Bar (cross-cutting element, per Document 8 §6)

A persistent, single-line bar pinned below the top navigation on every Project-scoped screen:

```
[SpecVersion v4 · edited 2 hours ago]   [●] Verified against v4 — clean   [View History]
```

- Left segment: current SpecVersion number and recency (Document 10 §5.1's `version_number`/`created_at`).
- Middle segment: verification relationship status, using the three-state status color system (3.1) — this is the resolution of Document 8's open question on how "spec changed since last verification" is displayed:
  - **Green dot + "Verified against v{n} — clean":** latest VerificationRun's `spec_version_id` equals the Project's `current_spec_version_id`, and it produced no open Critical/High findings.
  - **Amber dot + "Spec changed since last verification (v{n} → v{n+1})":** `current_spec_version_id` has advanced past the last run's `spec_version_id` — this is the specific signal Document 8 §6 identifies as the single highest-leverage piece of information architecture for retention.
  - **Gray dot + "Not yet verified":** no VerificationRun exists for this Project at all.
- Right segment: a single link into History (Document 8's Version History screen), not a dropdown — keeping the bar itself a status indicator, not a navigation menu.

This resolves Document 8 §10's open question (badge vs. banner vs. inline diff count) in favor of a persistent inline bar: a badge is too easy to miss given how load-bearing this signal is (Document 7 Journey 2, step 4), and a banner implies dismissibility, which is wrong for a status that should always be visible.

## 4. Design Tokens

A token layer sits beneath everything in §3 and §5 so that every color, spacing, and type decision is defined once and consumed everywhere — the same anti-drift discipline Document 1 Principle 1 applies to spec artifacts, applied here to the design system itself. This section defines the *philosophy* of that token layer; exact variable names, units, and framework bindings are a build-phase decision (§15).

- **Color tokens are two-layered: primitive and semantic.** Primitive tokens are raw palette values (a red, an orange, a gray scale); semantic tokens are named for their *meaning* (`severity-critical`, `status-clean`, `status-in-progress`) and point at a primitive. Screens and components reference semantic tokens only, never primitives directly — this is what makes the fixed severity/status mappings in §3.1 enforceable in practice rather than just as a stated rule, and it's what lets dark mode (§3.1) swap the underlying primitive without ever touching a screen's logic.
- **Spacing follows a single base-unit scale**, built up from the 8px grid already established in §3.1 (e.g., a small fixed set of steps — tight, default, comfortable, section-level) rather than arbitrary per-screen values. Density-sensitive screens (Schema, API — Design Principle 6) use the tighter steps by default; Idea Input and other lighter-touch screens use the more generous ones. The same scale, used differently, rather than two different scales.
- **Typography is a small, fixed type ramp**, not a continuous range of sizes — a handful of steps (label, body, subheading, heading) crossed with the two font families already defined in §3.1 (monospace for spec/code identifiers, sans-serif for chrome and prose). No screen introduces a one-off size outside this ramp.
- **Border radius is small and consistent**, applied uniformly to cards, badges, inputs, and modals/drawers. A tighter, more geometric radius (rather than heavily rounded, consumer-app style corners) reinforces the "serious technical tool" feel Design Principle 6 asks for, and a single radius token (rather than several competing values) keeps every surface feeling like part of the same system.
- **Elevation is expressed through a small number of shadow levels**, not through borders or color changes — a low level for cards resting on the page (PRD fields, Finding cards), a mid level for the Findings Dashboard's cards specifically (Design Principle 2's "hero screen" treatment), and a top level reserved for Modals and Drawers, so stacking order is always visually legible without relying on a dimmed backdrop alone.
- **Sizing tokens govern interactive-element dimensions** (button height, input height, icon size) as a small fixed set tied to the same density logic as spacing — dense screens use the compact sizing step, lighter-touch screens use the default step. This keeps click targets consistent and predictable across a product with genuinely different information densities per screen (§3.1's Iconography row, Design Principle 6).
- **Tokens, not screens, own theme switching.** Dark mode (§3.1) is implemented as an alternate mapping from semantic token to primitive value — no screen-level or component-level dark-mode logic is ever needed, which keeps the "supported, not the default" posture cheap to maintain rather than a parallel design surface to keep in sync.

## 5. Design System / Component Library

The screens in §6 are built from a small, deliberately limited set of reusable components. Limiting the set (rather than letting each screen invent its own variant of "a card" or "a list") is what keeps the whole product feeling like one coherent tool rather than several screens designed independently — the same consistency argument Document 1 Principle 1 makes for spec artifacts, applied to UI. Each component's *purpose and reuse strategy* is defined below; visual implementation (exact component library, styling framework) is out of scope per §15.

| Component | Purpose | Reused on |
|---|---|---|
| **Button** (primary / secondary / tertiary) | One consistent hierarchy of emphasis across the whole product. Primary is reserved for the single most important action per screen (Export on Task List, Trigger on Verification, Save on an edited field); secondary and tertiary cover supporting actions (Regenerate, Cancel) — this is the literal mechanism behind §6.2's "Regenerate as a clearly secondary action" decision, generalized into a rule rather than a one-off choice | Every screen with an action |
| **Input / Select** | Standard single-value form controls | PRD structured-field editing, Schema field type selection, API method/role selection |
| **TextArea** | Multi-line free text, deliberately roomier by default than other inputs | Idea Input (§6.1), PRD narrative editing |
| **Card** | The base surface for a discrete, self-contained piece of content | PRD structured fields, Finding cards (§6.10), Dashboard summary tiles |
| **Badge** | A small, fixed-vocabulary label — never used for arbitrary text | Severity labels, HTTP method labels, status labels (§3.1) — each badge *type* has its own fixed color set, and types are never mixed on the same visual element, per §3.1's explicit warning against confusing method badges with severity badges |
| **Chip** | The traceability link element already introduced in §7 (Interaction Patterns) | PRD features, Architecture components, Schema entities, API endpoints, Tasks, Finding Detail |
| **Modal** | Reserved for rare, blocking confirmations only — destructive or hard-to-reverse actions (e.g., deleting a Project) | Deliberately *not* used for the version context bar (§3.2), regeneration, or any everyday action — overusing modals for routine actions would contradict Design Principle 4's "edits feel safe" |
| **Drawer** | A lighter-weight, non-blocking side panel for supplementary content the user dips into and out of | Version Diff (§6.12), Architecture component detail panel (§6.3) |
| **Tooltip** | Short, contextual clarification on hover/focus | Traceability chip labels, guidance text on Idea Input, keyboard shortcut hints (§10) |
| **Tabs / Side-rail** | The pipeline sub-navigation pattern (PRD/Architecture/Schema/API/Repo/Roadmap/Tasks) | Spec section navigation (Document 8 §6); collapses to a dropdown below ~1280px per §14 |
| **Data Table** | Dense, sortable/filterable tabular content | Schema structured view (§6.4), API endpoint list (§6.5) |
| **Command Palette** | A single searchable entry point to jump to any Project, spec section, or action without mouse navigation — the target of the primary keyboard shortcut (§10) | Global, available from any screen |
| **Breadcrumb** | Lightweight positional context (Workspace-level features are minimal per Document 8 §4, so this stays shallow: Projects → Project name → current section) | Top of every Project-scoped screen, alongside the version context bar |
| **Progress Bar / Step Indicator** | The labeled, named-step progress pattern already specified in §6.7 and §6.9 | Generation flows, Verification runs |
| **Skeleton Loader** | Placeholder content shaped like the eventual real content (§7) | Every screen that fetches data on load |
| **Toast** | Transient confirmation/status messaging (§9) | Global, triggered by user actions and background job completions |

**Reuse strategy:** every screen in §6 is specified above the component level (layout and hierarchy of *information*), and is expected to be assembled from this table rather than a new one-off treatment. Where a screen in §6 appears to need something not on this list, that's a signal to extend this table deliberately rather than let a bespoke pattern quietly proliferate — the same discipline Document 8 Principle 5 applies to object count, applied here to component count.

## 6. Screen Designs

### 6.1 Idea Input (Epic B1)

- Single large text area, generously sized (contradicts Design Principle 6's density-by-default only here, deliberately — this is the one screen where a light touch matters more than density, since it's the first content the user produces).
- Lightweight, non-blocking guidance beneath the text area: 3–4 short example prompts ("what problem it solves," "who it's for," "one or two must-have features") rather than a rigid template — per Document 9's note that this guidance text has outsized effect on Document 7's "vague prompt" failure mode, it should nudge toward specificity without making the field feel like a form.
- Minimum-length soft-validation (a gentle inline note, not a blocking error) if the input is too short to plausibly produce a specific PRD — this exists specifically to reduce the odds of a generic first PRD, the single biggest early trust risk (Document 7 Stage 4).
- Submit triggers the async generation flow (Document 11 §5); the button transitions immediately into the progress state described in §6.7 below, not a page navigation with a separate loading screen.

### 6.2 PRD View/Edit (Epics B2–B4)

- Two-pane layout: structured fields (problem statement, target users, prioritized features, non-goals, success criteria) on the left as editable cards; narrative prose on the right as a single scrollable block.
- Each structured field has an inline edit affordance (click-to-edit, not a separate edit mode for the whole document) — small interaction detail, but it keeps editing low-friction, which matters directly for Document 7 Stage 4's trust moment.
- "Regenerate" is a clearly secondary action (text link, not a prominent button) next to "Save" — this is deliberate: making regeneration visually louder than editing would undercut Design Principle 4 and signal that the tool expects its own output to need wholesale replacement rather than refinement.
- Every prioritized feature displays a stable identifier (matching `PRDArtifact.features[].id`, Document 10 §5.2) visible on hover — this is what Architecture's traceability links (6.3) point back to, and surfacing it here (not just downstream) makes the traceability chain legible from both ends.

### 6.3 Architecture View/Edit (Epics C1–C3)

- Primary view: a rendered component diagram (nodes = components, edges = data flow, per `ArchitectureArtifact.data_flow`, Document 10 §5.3) using a simple auto-layout graph — no manual node-dragging in v1, since Document 4 doesn't require diagram authoring, only diagram *review*.
- Each component node, on click, opens a side panel showing: tech choice, rationale, and — rendered prominently, not as fine print — the specific PRD feature(s) it traces back to (`prd_feature_refs`, Document 10 §5.3), using the same feature identifiers introduced in 6.2. This is Document 4 Epic C2's traceability requirement made visually literal, per Document 9's note that this is "Document 3's differentiation made concrete."
- Manual override (Epic C3, MVP-Complete): an edited component is visually marked with a small "edited" indicator that persists even after downstream regeneration, so the user can see at a glance which parts of the architecture reflect their own decisions versus the model's. If a regeneration would conflict with a preserved edit, the conflict is surfaced as an inline banner on the affected component specifically — never a global blocking modal — consistent with Document 4's "surfaced, not silently overwritten."

### 6.4 Schema View/Edit (Epics D1–D3)

- Default view is the structured table (entities as sections, fields as rows: name, type, required, unique, foreign key) — per Design Principle 6, this is a technical-review screen and should default to density, not the diagram.
- ER diagram (Epic D3, MVP-Complete) is available via a toggle, not a separate screen (per Document 8 §6's "toggle rather than forced" pattern already set for Findings grouping, reused here for consistency).
- Each SchemaEntity displays its `architecture_component_ref` (Document 10 §5.4) as a small traceability chip — continuing the same traceability visual language established in 6.2/6.3, rather than inventing a new pattern per screen.
- This is the screen Priya is most likely to want to sanity-check directly (Document 7 Stage 6) — inline editing here should feel closer to editing a spreadsheet (tab between fields, type dropdowns) than filling out a form, matching the mental model of the user actually doing this work.

### 6.5 API Design View/Edit (Epics E1–E3)

- Table/list view, one row per endpoint: method (color-coded badge, not severity colors — a distinct, smaller badge system reserved for HTTP verbs only, so it's never confused with Findings severity), path, and — given equal visual weight to the path itself, not a secondary column — the `auth_required` and `required_role` fields (Document 10 §5.5).
- This is a deliberate weighting decision: Document 4 Epic E2 calls auth fields "the single most important field for the verification engine's flagship use case," so the UI must make an unauthenticated endpoint visually obvious at a glance (e.g., a clear "No auth" indicator in the same visual weight class as a Critical-severity finding elsewhere in the product) rather than a quiet checkbox a user could miss while reviewing.
- Expanding a row shows request/response shape and `schema_entity_refs` traceability chips, consistent with 6.3/6.4's pattern.

### 6.6 Repo Structure / Roadmap / Task List (Epics F1–F4)

- Repo Structure: a simple collapsible file-tree view with purpose notes shown on hover/expand — intentionally the lowest-effort visual treatment in the pipeline, matching its MVP-Complete (not MVP-Core) priority from Document 9.
- Roadmap: phases displayed as a horizontal sequence of cards (not a Gantt chart — no dates are modeled in Document 10, so a timeline visual would imply false precision).
- Task List: a flat, filterable list grouped by roadmap phase, each task showing its four traceability refs (`prd_feature_ref`, `architecture_component_ref`, `schema_entity_refs`, `api_endpoint_refs` — Document 10 §5.6) as the same chip pattern used throughout. The **Export** action is the single most prominent button on this screen (not "Save" or "Regenerate") — per Document 9 §4's flagged dependency, this is the artifact that determines whether Journey 1 completes at all, and the design should treat export as the screen's primary purpose, not an equal option among several.
- Export produces structured markdown formatted specifically to paste cleanly as instructions into an external AI coding tool (Document 4 F4) — a "Copy" action alongside file download, since Priya's actual workflow (Document 7 Stage 7) is pasting directly into Claude Code/Cursor, not necessarily downloading a file first.

### 6.7 Generation Progress State (applies to Idea Input through Task List, Document 5 §6)

- A single reusable progress pattern across all generation stages: a labeled step indicator ("Generating PRD…", "Deriving architecture…", etc.) rather than a generic spinner, satisfying Document 8 §7's requirement that no stage show "a silent multi-minute wait."
- Because Document 5 §1 targets full-pipeline generation under 5 minutes and single-stage generation under 30 seconds, the pattern differs slightly by duration: single-stage generation (PRD) shows an indeterminate but labeled progress state; full-pipeline generation (if a user chooses to run the whole thing unattended) shows a step-by-step checklist that fills in as each stage completes, so a 5-minute wait has continuous, legible feedback rather than one static label the whole time.

### 6.8 Repo Connection (Epic G1)

- Standard OAuth connect button; post-connection, the screen shows the connected repo name and a clear, permanent "Read-only access" indicator — this is a trust-building UI moment, not just a status label, given Document 5 §4's structural read-only guarantee is a real differentiator worth surfacing, not burying in settings.
- No file browser or repo content preview in v1 — Document 4 doesn't require it, and adding one would suggest a browsing/exploration use case this product doesn't serve.

### 6.9 Verification Run — Trigger/Progress (Epic G3)

- Trigger action is prominent on both the Project Dashboard and the Verify section, consistent with Document 8 §6's framing of this as the return-loop's central action.
- Progress state follows the two-tier structure directly, per Design Principle 5 and `VerificationRun.status` (Document 10 §6.2): "Running deterministic checks…" transitions visibly to "Running semantic analysis…" rather than a single generic "Verifying…" label — the two-tier architecture (Document 11 §6) is real and cheap to make visible, and doing so subtly reinforces the "deterministic first, cheap before clever" story from Document 1 Principle 4 at the exact moment the user is watching.

### 6.10 Findings Dashboard (Epics H1–H5) — the highest-design-priority screen

Per Design Principle 2, this screen gets the most detailed treatment:

- **Default grouping: severity**, per Document 8 §6, with a toggle (not a separate screen) to regroup by spec area (auth / schema / api_contract / architecture / other, Document 10 §6.3's `spec_area` enum).
- Each finding renders as a compact card, not a table row — enough visual weight per finding to convey severity at a glance (fixed severity color, Document 3.1) plus a one-line plain-language explanation (Epic H3) without requiring a click to understand *what kind* of problem it is.
- Clicking a card opens Finding Detail (6.11) rather than expanding inline — keeping the dashboard itself scannable even with many findings, consistent with Design Principle 2's "triage tool, not audit log" framing.
- **Zero-findings state is explicit and positive**, not just an empty list: "No issues found against SpecVersion v4" with the version number stated directly — this reinforces Design Principle 3 (version awareness) at exactly the moment a clean result could otherwise feel ambiguous ("did it actually check, or is this screen just empty").
- **Empty-dashboard-before-first-run state** (no VerificationRun exists yet) is visually distinct from zero-findings — per Document 8 §7, these must never be conflatable, since one means "verified clean" and the other means "not checked at all."
- `detection_tier` (deterministic vs. semantic, Document 10 §6.3) is available as a filter but not shown as primary information on the card — per Document 9 §3, severity is about impact regardless of which tier caught it, so leading with severity and treating tier as secondary metadata keeps the hierarchy of information correct.

### 6.11 Finding Detail (Epic H3, H6)

- Severity and spec area at the top (same visual language as the dashboard card, for continuity).
- `spec_element_ref` rendered as an actual traceability link back to the specific spec artifact (e.g., the exact APIEndpoint) — not a text description of it — reusing the chip/link pattern from 6.3–6.6 so Findings feel connected to the rest of the product rather than a bolted-on report.
- `file_path`/`line_number` shown as a code reference (monospace, per §3.1) when present; explicitly hidden (not shown as "N/A") when null, per Document 10 §6.3's note that architecture-level findings may have no single file locus — showing "N/A" would read as a bug rather than an expected case.
- Acknowledge/won't-fix action (Epic H6, Later) is designed now as an additive control on this existing screen — a single secondary button — confirming Document 8 §10's assessment that it requires no IA restructuring, only this screen-level addition when it ships.

### 6.12 Version History and Version Diff (Epics I2–I3)

- Version History: a simple reverse-chronological list (version number, timestamp, `source` — generation/edit/regeneration, `change_summary` if present, per Document 10 §5.1).
- **Version Diff resolves as a drawer opened from the History list, not a dedicated screen** — this finalizes Document 8 §10's open question in favor of the lighter-weight option, since a full screen would overstate the frequency this feature is actually used (Document 9 marks structured diffing MVP-Complete, not MVP-Core) relative to the object-count discipline Document 8 Principle 5 asks for.
- Diff content in v1 covers structured fields only (schema, API — per Document 4 I3's explicit scope), rendered as a straightforward field-level before/after list; prose diffing (Later, per Document 4/9) is out of scope for this drawer's design entirely, not stubbed in.

## 7. Loading & Skeleton States

Per Design Principle 5, no long operation should read as a silent, blank wait — this section extends that principle to the more mundane case of ordinary page/data loading, where the same rule applies for a different reason: a blank page reads as broken, not "in progress," and undermines trust before the user has even seen content to evaluate.

- **General rule: skeletons mirror the shape of the real content**, not a generic spinner — a skeleton for the Findings Dashboard looks like faint, colorless finding cards; a skeleton for the Schema table looks like faint table rows. This is deliberate: it lets the user's eye start orienting to the eventual layout before data arrives, rather than re-orienting once it does.
- **Projects List:** skeleton list rows (name/last-updated/status-badge shape) in place of real rows while the list loads.
- **Project Dashboard:** skeleton tiles for the spec-status card, repo-status card, and latest-verification-summary card (§6, Document 8 §5.2) — each tile skeleton matches its real tile's proportions so the dashboard's layout doesn't shift once data resolves.
- **PRD / Architecture / Schema / API / Task screens:** skeleton content blocks matching the two-pane, table, or list layout defined per screen in §6. **Diagram placeholders** (Architecture component diagram, Schema ER view) specifically use a low-opacity blank canvas with a few pulsing node-shaped placeholders, rather than a spinner overlaying an empty area — this avoids the diagram's real content "popping in" against a completely blank frame.
- **Findings Dashboard:** skeleton cards (severity-colored placeholders shown in a neutral, desaturated tone) while a completed run's findings are being fetched. This is distinct from the *active verification progress* state (§6.9) — that state is for a run currently executing; this state is for loading the results of a run that already finished, e.g., when a user navigates back into the dashboard.
- **Skeleton duration cap:** if a skeleton would need to be shown for longer than roughly two seconds, the screen transitions to a labeled loading state (reusing the pattern from §6.7/§6.9) instead of continuing to show a skeleton indefinitely — a skeleton implies "this is almost ready," and holding that implication too long undermines the same honesty-in-progress-states intent Design Principle 5 sets for active operations.
- **Never a blank page:** every screen in §6 that fetches data on entry has a defined skeleton or loading state per this section — this is treated as a required property of a screen's design, not an optional polish pass added after the fact.

## 8. Error State Design

Every error state in the product follows the same three-part structure: **what happened**, **what the system did or did not do as a result**, and **a concrete next action** — never a bare error code or a dead end. This section defines behavior by category; exact copy is a build-phase task (§15).

- **Generation failures** (after Document 11 §5 step 4's single corrective retry has already been exhausted): the artifact area shows an inline error card in place of the artifact — not a blocking modal — with "Try again" as the primary action. No partial or corrupted SpecVersion is created on failure, consistent with Document 10's immutability model; a failure simply means no new version exists yet. A "Report issue" secondary action appears only after a repeated failure, not on the first attempt, to avoid making a normal transient failure feel alarming.
- **Verification failures** (`VerificationRun.status = failed`, Document 10 §6.2 / Document 11 §6 step 6): the message distinguishes *which* tier failed, because the implication is different — a Tier 1 (deterministic) failure means nothing was checked yet, while a Tier 2 (semantic) failure means Tier 1's findings are still valid and displayed, per Document 5 §3's resumability requirement, with explicit copy to that effect (e.g., "Semantic analysis failed — deterministic results below are complete and valid") rather than discarding everything the run did produce.
- **GitHub connection failures** (OAuth denied, token expired, scope revoked): surfaced directly on the Repo Connection screen (§6.8) with an explicit "Reconnect" call to action — never a generic "something went wrong," since the fix here is specific and known.
- **Authentication issues** (session expired mid-task): the user is redirected to login with their destination preserved, accompanied by a toast (§9) explaining what happened — a silent bounce to the login screen with no explanation is treated as a defect, not an acceptable edge case.
- **API timeouts / network errors:** treated distinctly from generation/verification failures. Retrying re-attempts the same logical request without creating a duplicate job or a duplicate SpecVersion — an idempotency guarantee that follows directly from Document 10's immutability principle and Document 11's job-status model, not just a UI nicety.
- **Unexpected/unhandled errors:** caught by a per-screen error boundary (never a full-application crash page) and rendered using the same red/Critical visual language already reserved for severity (§3.1) — deliberately reused rather than inventing a separate error color, since "the application itself failed" is, in effect, the highest-severity state a user can encounter.

## 9. Notification System

Toasts communicate the outcome of an action or background job the user may not be actively watching — they are additive to, not a replacement for, the in-context confirmations already specified per screen (e.g., an inline "Saved" state on a click-to-edit field, §6.2). A toast and an in-context confirmation are never shown for the same action simultaneously, per Design Principle 2's scannable-not-noisy ethos applied to notifications specifically.

- **Type system reuses the existing status colors (§3.1)** rather than introducing a new palette: success (green), info (neutral gray), warning (amber), error (red).
- **Success/info toasts auto-dismiss**; **error toasts persist until manually dismissed**, since an error the user didn't act on should not silently disappear.
- Representative examples, covering the categories most relevant to Document 4's epics:

| Toast | Type | Trigger |
|---|---|---|
| "Project created" | Success | Epic A2 |
| "PRD generated" | Success | Epic B2 completion |
| "Spec saved" | Success | Any click-to-edit save across PRD/Architecture/Schema/API |
| "Verification started" | Info | Epic G3 trigger |
| "Verification completed — 3 findings" | Success/Info | VerificationRun reaches `complete` (Document 10 §6.2); deep-links directly into the Findings Dashboard (§6.10) to reduce friction in the Document 7 Journey 2 return loop |
| "GitHub connected" | Success | Epic G1 completion |
| "Generation failed — try again" | Error | Any generation failure (§8) |
| "Verification failed" | Error | `VerificationRun.status = failed` (§8) |

- Background-job toasts (Verification Completed in particular) fire even if the user has navigated away from the triggering screen — this is the specific case a toast exists for, versus an in-context confirmation the user would need to still be looking at.

## 10. Keyboard Shortcuts

Given the primary persona (Priya, Document 6) is a technical user who values speed (Document 7's "fast" framing throughout Journey 1), a small set of realistic, high-value shortcuts is defined rather than an exhaustive shortcut system that would be more overhead to learn than it saves:

| Shortcut | Action | Notes |
|---|---|---|
| `Cmd/Ctrl + K` | Open Command Palette | Global; jump to any Project or spec section without mouse navigation (§5) |
| `Cmd/Ctrl + S` | Save the current editable field/artifact | Active only where a click-to-edit field (§7 Interaction Patterns) has unsaved changes |
| `Cmd/Ctrl + Enter` | Generate / Regenerate | On Idea Input, submits the prompt; on an artifact screen, triggers Regenerate |
| `V` | Jump to the Verify section | Single-key global shortcut; disabled while focus is inside a text input or textarea, per standard convention, so it never interferes with typing |
| `P` | Jump to the Projects List | Single-key global shortcut; same input-focus exception as `V` |
| `Esc` | Close the open Drawer or Modal | Applies to Version Diff (§6.12), Architecture component panel (§6.3), and any confirmation Modal (§5) |

This list is intentionally short. New shortcuts should be added only when a specific, frequent action earns one — consistent with the same restraint Document 8 Principle 5 applies to navigation depth and this document applies to component count (§5).

## 11. Interaction Patterns Used Across Multiple Screens

Consolidating patterns introduced above so they're specified once rather than re-derived per screen (preventing the exact kind of drift Document 1 Principle 1 warns against, applied here to the design system itself):

| Pattern | Used on | Behavior |
|---|---|---|
| Traceability chip | PRD, Architecture, Schema, API, Tasks, Finding Detail | Small, clickable, labeled with the referenced artifact's name; navigates to that artifact's location, scrolled/highlighted to the specific element |
| Click-to-edit field | PRD, Architecture, Schema, API | Inline edit on click; explicit Save/Cancel, no autosave-without-confirmation given Document 4's versioning implications of every edit |
| Toggle (not separate screens) | Schema (table/diagram), Findings (severity/spec-area grouping) | Single control, state persists per-session, avoids the object-count growth Document 8 Principle 5 warns against |
| Labeled progress step | All generation flows, verification run | Named current operation, never a bare spinner (Document 5 §6, Document 8 §7) |
| Severity color (fixed) | Findings Dashboard, Finding Detail, API auth indicator, unhandled-error state (§8) | Never reused for anything else — a deliberate reservation so severity color always means the same thing everywhere it appears |
| Skeleton loader | Every data-fetching screen (§7) | Shape-matched placeholder, capped at ~2 seconds before falling back to a labeled loading state |
| Toast | Global (§9) | Additive to, never duplicated with, in-context confirmations |

## 12. Animation & Motion Guidelines

Motion in Verity is functional, not decorative — every animation exists to make a state change legible, not to make the product feel lively. This follows directly from Design Principle 6's "serious technical tool" posture: a product a developer trusts to verify their code should not feel playful.

- **Duration:** interface transitions (hover states, toggles, drawer/modal open-close) run 150–250ms — fast enough to feel immediate, slow enough to be perceptible as a state change rather than an instant jump cut.
- **Hover behavior:** subtle color and/or elevation change only (§4's shadow tokens), no scale/"bounce" transforms — consistent with the restrained, technical visual language set in §3.1.
- **Loading animation:** skeletons (§7) use a slow, constant opacity pulse rather than a shimmer/sweep effect; progress bars/step indicators (§6.7, §6.9) fill deterministically as real steps complete rather than looping indefinitely — motion should always correspond to real state, never simulate progress that isn't happening.
- **Page/section transitions:** simple fades or short slide-ins consistent with the tabs/side-rail pattern (§5) — no full route-level transition animation, since that would slow down exactly the kind of fast, repeated navigation Priya's workflow depends on (Document 7 Journey 2).
- **First-load-only animation:** the Architecture and Schema diagrams (§6.3, §6.4) may animate nodes into position once, on first render — never on every subsequent view of the same diagram, where it would start to feel gimmicky on a screen used repeatedly rather than a one-time "reveal."
- **Reduced motion:** the system respects the OS-level "reduce motion" preference — with it enabled, skeleton pulses, diagram first-load animation, and page transitions are replaced with instant state changes; progress bars and step indicators still update (since they convey real information, not decoration) but without an animated fill.

## 13. Accessibility Implementation Notes (implementing Document 5 §6's WCAG 2.1 AA target)

- Severity is never conveyed by color alone — each severity level pairs its fixed color with a distinct icon and text label (Document 5 §6's AA target requires this; it also happens to make findings scannable faster for sighted users too).
- All traceability chips and inline-edit affordances are keyboard-navigable and screen-reader-labeled with both the artifact type and name (e.g., "Architecture component: Auth Service," not just "Auth Service"), since chips carry real navigational and semantic meaning, not decoration.
- Diagram views (Architecture, Schema ER) always have a structured/tabular equivalent available via toggle (§6.3, §6.4) — this satisfies AA's non-text-content requirements structurally, not as a bolted-on alt-text afterthought, and reuses the same toggle pattern already required by Document 5 §6 and Document 8 §8 for responsive behavior.
- Keyboard shortcuts (§10) never remove the equivalent mouse/screen-reader-accessible path — every shortcut is an accelerator for an action that remains fully reachable through ordinary navigation.
- Reduced-motion support (§12) is treated as an accessibility requirement, not a stylistic option, consistent with WCAG's motion-sensitivity guidance.

## 14. Responsive Design

Per Document 5 §6, Verity is **desktop-first**: the core work of reviewing architecture diagrams, editing schema fields, and triaging findings is inherently a desktop/laptop activity, and the design does not compromise that experience to accommodate smaller viewports. This section expands Document 8 §8's rules into explicit behavior per device tier.

| Tier | Width | Experience |
|---|---|---|
| **Desktop** | ≥ 1280px | Full experience as specified in §6 — persistent side-rail sub-navigation, two-pane layouts, diagrams shown by default. |
| **Laptop / small desktop** | 1024–1279px | Per Document 8 §8: pipeline sub-navigation collapses from a persistent side-rail to a top dropdown. The version context bar (§3.2) remains pinned and full-width — the one element that never collapses or truncates at any width, since ambiguity about spec/verification state is the one failure mode Document 8 Principle 4 treats as unacceptable at any screen size. |
| **Tablet** | 768–1023px | Diagram-heavy screens (Architecture, Schema ER) default automatically to their structured/tabular equivalent (§6.3, §6.4), consistent with Document 8 §8's acknowledgment that these are the least tablet-friendly screens by nature. Multi-column layouts (PRD's two-pane view, §6.2) stack vertically. Click-to-edit fields, Command Palette, and Findings triage remain fully usable — this tier supports real work, just at reduced horizontal density. |
| **Mobile** | < 768px | Per Document 5 §6, the application "should not break" below tablet width — this document clarifies what that means in practice: **mobile is a viewing surface, not an editing one.** Dashboard, Findings Dashboard, Finding Detail, and read views of PRD/Architecture/Schema/API/Tasks and Version History all render legibly and are fully navigable. Editing (click-to-edit fields), initiating a Repo Connection OAuth flow, and triggering a Verification run are treated as desktop/tablet-primary actions: reachable and functional, but the mobile layout gently steers toward the larger-screen experience for these specific actions (e.g., "Best viewed on a larger screen for editing") rather than hiding them outright. This keeps mobile genuinely useful — checking on a verification run's results from a phone, for instance — without pretending the product is mobile-first, which Document 5 explicitly does not require. |

## 15. What This Document Deliberately Does Not Specify

- Exact component library / CSS framework choice, and the concrete implementation of the token layer defined in §4 (variable names, units, framework bindings) — an engineering decision for the build phase, not a UX-design decision; this document specifies behavior, hierarchy, and philosophy, not a Figma file or component code.
- Copy/microcopy for guidance text, error states (§8), toast messages (§9), and empty states beyond the examples given — full content design is a build-phase task once screens are implemented against this structure.
- Onboarding/empty-workspace flow beyond what Document 8 §7 already scoped (progressive disclosure of disabled nav items) — no additional tutorial/walkthrough UI is introduced here, consistent with keeping sign-up to sign-up-and-go per Document 7 Stage 2.
- Exact easing curves, shadow values, and animation library choice implementing §12's principles — the principles (duration ranges, when motion is and isn't used) are specified; the implementation is a build-phase task.
- Command Palette's underlying search implementation (client-side index vs. server-backed search) — a Document 11/13 scoping question, not a UX-design one; this document specifies only that the palette exists and what it should let a user reach.

## 16. Open Questions Carried Into Later Documents

- Exact prompt-level strategy for keeping generated content specific rather than generic (Design Principle 1's UI framing depends on the underlying generation actually being specific) — this is fundamentally Document 13's (AI Architecture) responsibility; this document can present specificity well but cannot manufacture it.
- Whether the Findings Dashboard needs pagination/virtualization for very large finding counts on big repositories — deferred as a performance question to Document 18 (Scalability Strategy), since Document 5 §1's 500-file repo target suggests this may matter sooner than other UI performance concerns.
- Whether the traceability chip's click-through navigation requires client-side route state that complicates the polling-based progress model (Document 11 §4) — flagged for Document 11 revisit or frontend implementation planning if it proves non-trivial; treated here as a standard in-app navigation, not expected to conflict.
- Whether the Command Palette (§5, §10) needs a server-backed search index once a Workspace has many Projects, or whether client-side search over already-loaded data remains sufficient — a scoping question for Document 11 or Document 18, not resolved here.
- Whether skeleton-to-loading-state fallback timing (§7's ~2-second cap) and reduced-motion behavior (§12) need to be user-configurable beyond respecting the OS-level preference — flagged for a build-phase accessibility review rather than resolved as a design decision now.