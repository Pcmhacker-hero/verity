# Document 8: Information Architecture

## 1. Purpose and Scope

This document defines how Verity's information is structured, organized, and navigated — the object hierarchy, the screen inventory, and the navigation model that Epics A–I (Document 4) get built into. It answers "where does everything live and how does a user get to it," not "what does it look like" (Document 12, UI/UX Design) or "how is it stored" (Document 10, Data Model). Where this document references entities, it anticipates but does not finalize the data model — Document 10 is the source of truth for schema; this document is the source of truth for user-facing structure.

## 2. IA Principles

1. **The Project is the hub.** Every artifact, every verification run, every finding belongs to exactly one Project. There is no cross-project view of specs or findings in v1 — this mirrors Document 4's explicit v1 scope (single-workspace, no team features) and keeps navigation shallow.
2. **The pipeline is linear but not locked.** PRD → Architecture → Schema → API → Repo/Roadmap → Tasks is both the generation order (Document 4, Epics B–F) and the default navigation order, but every stage remains independently viewable and editable at any time — reflecting Epic C3's requirement that edits are preserved, not a one-way wizard the user can't step back into.
3. **Verification is a first-class sibling to the spec, not buried under it.** Per Document 7's Critical Moments Summary, the Findings dashboard is the highest-stakes screen in the product. It gets its own top-level navigation position, not a tab nested three clicks under Settings.
4. **Version is always visible, never assumed.** Because every artifact is an immutable SpecVersion (Epic I1) and every verification run ties to an exact version (Epic H4), the IA must always show *which version* the user is looking at — ambiguity here would undermine the entire trust model Document 3 identifies as the differentiator.
5. **Shallow over deep.** Given the primary persona (Priya, Document 6) values speed and has no patience for enterprise-style nested navigation, no user-facing object should require more than 3 clicks from the Project Dashboard to reach.

## 3. Object Hierarchy

This is the conceptual containment structure that drives both navigation and (later) Document 10's schema:

```
Workspace (auto-provisioned per user, Epic A1)
└── Project (Epic A2)
    ├── SpecVersion (immutable snapshot, Epic I1) — one active "current," many historical
    │   ├── PRD (Epic B)
    │   ├── Architecture (Epic C)
    │   ├── Schema (Epic D)
    │   ├── API Design (Epic E)
    │   ├── Repo Structure (Epic F1)
    │   ├── Roadmap (Epic F2)
    │   └── Tasks (Epic F3)
    ├── Connected Repository (Epic G1) — zero or one per Project in v1
    └── Verification Run (Epic G3) — many per Project
        ├── tied to exactly one SpecVersion (Epic H4)
        └── Findings (Epic H3) — many per run, grouped by severity and spec area
```

**Note on cardinality:** a Project has exactly one *current* SpecVersion at any time but retains all prior versions (Epic I2). A Verification Run always references the SpecVersion current *at the time it was triggered* — this is what allows historical runs to remain valid records (Epic H4) even after the spec moves on.

## 4. Top-Level Navigation

Four persistent top-level destinations, visible from anywhere in a Project:

| Nav Item | Maps to | Default landing content |
|---|---|---|
| **Dashboard** | Epic A4 | Project overview: spec status, connected repo status, latest verification summary |
| **Spec** | Epics B–F | The pipeline — PRD/Architecture/Schema/API/Repo/Roadmap/Tasks as sub-sections of one continuous artifact set |
| **Verify** | Epics G, H | Repo connection status, run history, and the Findings dashboard |
| **History** | Epic I | SpecVersion timeline and diffs |

A fifth, non-Project-scoped item — **Projects** (Epic A3) — sits above this level as the workspace-level entry point (the "all my projects" list a user lands on after login).

Settings/account exist as a standard top-right menu, not part of the primary IA — consistent with Document 4's exclusion of team/billing features from v1 complexity.

## 5. Screen Inventory

### 5.1 Workspace Level

| Screen | Purpose | Epic ref |
|---|---|---|
| Login / Sign-up | Auth entry | A1 |
| Projects List | All Projects for the user's workspace; name, last-updated, spec status | A3 |
| New Project — Idea Input | Free-text idea prompt, entry point to generation | B1 |

### 5.2 Project Level

| Screen | Purpose | Epic ref |
|---|---|---|
| Project Dashboard | Hub screen — spec status, repo link status, latest verification summary, quick links into Spec/Verify/History | A4 |
| PRD View/Edit | Structured fields + narrative, inline edit, regenerate (whole or section) | B2, B3, B4 |
| Architecture View/Edit | Component diagram (renderable), rationale, PRD traceability links | C1, C2, C3 |
| Schema View/Edit | Visual ER diagram + structured entity/field table | D1, D2, D3 |
| API Design View/Edit | Endpoint list with method/path/request-response/auth fields | E1, E2, E3 |
| Repo Structure View | Folder/file tree with purpose notes | F1 |
| Roadmap View | Phased breakdown | F2 |
| Task List / Export | Task list with traceability tags, export action | F3, F4 |
| Repo Connection | GitHub OAuth connect flow, connection status | G1 |
| Verification Run — Trigger/Progress | Manual trigger, progress state during run | G3, Document 5 §6 |
| Findings Dashboard | Severity- and spec-area-grouped findings, filter/sort | H3, H5 |
| Finding Detail | Single finding: severity, spec element violated, file/line, explanation, acknowledge action | H3, H6 |
| Version History | Timeline of SpecVersions | I2 |
| Version Diff | Structured-field diff between two versions | I3 |

## 6. Navigation Patterns

**Pipeline navigation (Spec section):** presented as a persistent sub-navigation (tabs or side-rail) across PRD / Architecture / Schema / API / Repo / Roadmap / Tasks, so Priya can jump directly to Schema or API — the stages she's most likely to want to sanity-check herself (Document 7, Stage 6) — without walking the full linear sequence every time.

**Dashboard as return point:** per Document 7's Journey 2 (the return loop), the Project Dashboard is the screen a returning user lands on, surfacing "spec changed since last verification" or "verification clean as of latest spec" at a glance — this is the single highest-leverage piece of information architecture for retention, since it's what makes the re-verify habit low-friction.

**Findings grouped two ways:** by severity (default, for triage) and by spec area — auth, schema, API contract (Epic H5) — selectable via a toggle rather than two separate screens, keeping the object count low per Principle 5.

**Version context bar:** a persistent, always-visible indicator (not a separate screen) showing which SpecVersion is currently being viewed/edited and whether it matches the version the latest verification run checked against — this directly implements Principle 4 and is called out separately because it's a cross-cutting element, not a screen of its own.

## 7. Progressive Disclosure & Empty States

- **New Project, no spec yet:** Dashboard shows only the Idea Input prompt — Spec/Verify/History nav items are visible but disabled/greyed with a tooltip explaining what unlocks them, rather than hidden outright, so the full shape of the product is legible from the first screen.
- **Spec exists, no repo connected:** Verify section shows the connection prompt in place of run history — findings/run screens don't exist yet because they structurally can't (no Verification Run objects exist).
- **Repo connected, no run yet:** Verify section shows the trigger action prominently; no empty Findings dashboard is shown until at least one run completes, avoiding a confusing "zero findings" state that could be misread as "verified clean."
- **First verification run in progress:** Dashboard and Verify section both reflect an explicit in-progress state (Document 5 §6 requirement) rather than a bare loading spinner.

## 8. Responsive Behavior

Per Document 5 §6 (Compatibility), the IA is designed desktop-first down to 1024px:

- Sub-navigation (pipeline tabs, findings filters) collapses from a persistent side-rail to a top dropdown below ~1280px.
- Diagram-heavy screens (Architecture, Schema ER view) are the least tablet-friendly by nature (Document 5 acknowledges this) — these default to the structured/tabular view on narrower viewports, with the visual diagram available on toggle rather than forced.
- No mobile-specific navigation pattern is designed in v1, consistent with Document 5's explicit non-requirement.

## 9. Traceability in the IA

Document 4's Epic C2/F3 traceability requirement (every downstream artifact references what it derives from) surfaces in the IA as **inline cross-links**, not a separate "traceability view":

- An Architecture component links back to the PRD feature(s) it supports.
- A Schema entity links to the Architecture component that owns it.
- An API endpoint links to the Schema entities and Architecture component it touches.
- A Task links to all of the above.
- A Finding links to the exact spec element (schema field, endpoint auth rule, etc.) it evaluates.

This keeps traceability discoverable at the point of use rather than requiring a dedicated screen most users won't think to visit — consistent with Principle 5.

## 10. Open Questions Carried Into Later Documents

- Exact visual treatment of the pipeline sub-navigation (tabs vs. side-rail vs. stepper) — resolved in Document 12 (UI/UX Design).
- Whether Version Diff (I3) needs its own top-level screen or can live as a modal/drawer off History — leaning toward the latter for object-count discipline (Principle 5), final call in Document 12.
- How the "spec changed since last verification" dashboard signal is computed and displayed (badge vs. banner vs. inline diff count) — functionally dependent on Document 10's SpecVersion/VerificationRun relationship, visually resolved in Document 12.
- Confirm in Document 9 (Feature Breakdown) whether Finding acknowledgment (H6, Later priority) needs IA accommodation now or can be added to the Finding Detail screen without restructuring later — current assessment is the latter, since it's additive to an existing screen.