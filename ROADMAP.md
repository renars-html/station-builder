# Station editor roadmap

Goal: a reliable desktop layout editor, with world-meter geometry usable by future simulation modules. Simulation itself is out of scope. Milestones are implemented in priority order; partial milestones must not be marked complete. Each implementation milestone requires `npm test`, `npm run typecheck`, `npm run build`, appropriate regression tests, a roadmap update, and a separate commit when possible.

## Initial audit

- Export exists, but no import, schema validation, version migration, file-size limits, or actionable file errors. Reload discards the project.
- Document and draft snapshots support history, but properties commit on each keystroke, redundant edits create history, and selection/drag previews can become stale.
- Grid snapping is hard-coded; no object anchors or curve snapping. Finished paths only expose node dragging; no extension or segment editing. Coincident endpoints have no topological connection model.
- Areas store unrelated straight vertices instead of shared line/quadratic/cubic boundaries. Degenerate drafts are accepted.
- Rendering places all areas behind all paths. Track materials render per object, causing beds to cover adjacent rails at overlaps. No elevation/layer property.
- Canvas and App mix input, model updates, and UI. Broad Zustand subscriptions redraw large portions of the app. Geometry sampling is fixed-resolution and repeated, with no spatial index/culling.
- Keyboard handling is split and Space interferes with select controls; preview state can outlive its source document. Browser regression coverage is absent. Previous managed preview attempts failed with a relay readiness timeout.
- Track attachments are modeled independently of rendering (good), but only one is intentionally exposed. No simulation, routing, grade constraints, or pedestrian graph exists.

## M0 — Audit and working guidance [complete]

Acceptance: record findings, priorities, verification commands and persistent repository guidance in ROADMAP.md and AGENTS.md.

## M1 — Safe project files and recovery [complete]

Plan: add a pure validating JSON boundary, safe Open/Save UI, undoable project replacement and recovery, error reporting, and explicit TypeScript checks.
Acceptance:
- Save/Open round-trip every supported geometry and attachment without losing IDs or coordinates.
- Reject unsupported versions, duplicate IDs, malformed/nonfinite/oversized geometry and invalid attachments before replacing the project; show actionable errors.
- Opening is one undoable transaction; drafts/selection are cleared and loaded geometry is fitted.
- Debounced local recovery survives reload; storage errors are visible and JSON save remains available. Drafts are explicitly excluded from recovery.
- Tests cover malformed data, limits, round-trips, failed load preserving the project, and load undo/redo.

## M2 — Snapping and editing finished paths [planned]

Plan: a pure zoom-aware snap resolver and geometry editing commands, used by both drafting and node editing.
Acceptance:
- With Snap on, nearby endpoints/area anchors take priority, then nearest boundaries, then grid; tolerance is screen-relative and a marker shows the chosen target. Own edited node is excluded.
- Finished paths can be extended from their end; segment midpoint insertion preserves curve shape; segment removal is undoable.
- Reject zero-length finished paths and control-only drafts. Middle-click never moves geometry. Keyboard input ignores editable fields.
- Tests cover snapping priority/tolerance, curve splitting, extension, and history branching.
- Geometric endpoint joins are supported here; persistent network connectivity belongs to M6.

## M3 — Shared curved area boundaries [planned]

Plan: unify area boundaries with ordered line/quadratic/cubic segments; migrate legacy vertex areas on load.
Acceptance:
- Areas use left-click standard / E control / right-click remove / Enter close, including curved closing segments.
- Area fill is selected by dropdown. Finished area anchors and controls can be edited; closure is preserved when moving the first anchor.
- Areas and paths share snapping. Reject collapsed/zero-area drafts with a useful message.
- JSON version migration and curve geometry/closure/history regression tests pass.
- Self-intersection repair, holes and boolean operations remain later work.

## M4 — Elevation and material rendering order [planned]

Plan: numeric integer Z levels on every object and a deterministic render plan separating materials within each level.
Acceptance:
- Any area/path can be placed above or below another using its Properties Z level; values survive JSON and undo/redo.
- For a given level, all trackbeds render below all sleepers, and all sleepers below all rails. Higher levels render entirely above lower levels.
- Canvas hit selection follows displayed ordering; object list reflects stacking. Attached edges inherit their track level.
- Tests assert render order and legacy default levels.

## M5 — Selection, transactions and production interaction QA [planned]

Acceptance: multi-selection/box selection, grouped translation and deletion, arrow nudging, lock/hide controls, property-edit coalescing, drag cancellation without history corruption, visible unsaved status and leave warnings, browser tests for drawing/dragging/keyboard/file flows. No browser QA claims without observing it pass.

## M6 — Network topology and performance foundation [planned]

Acceptance: explicit versioned endpoint junction references with validated connectivity; edits propagate shared junctions without linking different elevations automatically; geometry/length queries independent of Konva; documented graph boundaries for future train/pedestrian modules; benchmarks and bounded sampling, caching, culling/spatial indexing where measured useful. No running simulation.

## Verification notes

Baseline: 25 tests pass. Managed `sites-preview` relay repeatedly times out; attempt browser QA after changes, report its actual outcome, and continue pure geometry/state checks if infrastructure remains unavailable. Build currently emits a bundle-size warning; address using evidence in M6, not by suppressing it.

M1 evidence: 32 tests pass; explicit TypeScript check and production build pass. Open validates into a new document before one undoable replacement. Recovery writes only completed document geometry, reports storage/validation errors, and preserves unreadable recovery rather than overwriting it. Browser storage/file-picker interaction remains part of M5 browser QA.
