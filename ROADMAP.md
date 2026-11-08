# Station editor roadmap

Goal: a reliable desktop layout editor, with world-meter geometry usable by future simulation modules. Simulation itself is out of scope. Milestones are implemented in priority order; partial milestones must not be marked complete. Each implementation milestone requires `npm test`, `npm run typecheck`, `npm run build`, appropriate regression tests, a roadmap update, and a separate commit when possible.

## Current near-term priority order

1. **M2.1 — Path/area snapping refinement:** the current implementation pass below; geometric alignment before persistent junction topology.
2. **M7 — Textured materials:** next implementation milestone, replacing flat surface fills with textures.
3. **M8 — Prop system and initial catalog:** immediately after textured materials; a substantial useful prop library, not only a placement mockup.
4. Finish M5 browser interaction verification as soon as the preview infrastructure works; continue it alongside the next milestones where possible.
5. M6 persistent topology and larger-project performance foundation remains important follow-up work. No simulation.

These priorities reflect the latest user request and take precedence over the older numeric milestone order.

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

## M2 — Snapping and editing finished paths [complete]

Plan: a pure zoom-aware snap resolver and geometry editing commands, used by both drafting and node editing.
Acceptance:
- With Snap on, nearby endpoints/area anchors take priority, then nearest boundaries, then grid; tolerance is screen-relative and a marker shows the chosen target. Own edited node is excluded.
- Finished paths can be extended from their end; segment midpoint insertion preserves curve shape; segment removal is undoable.
- Reject zero-length finished paths and control-only drafts. Middle-click never moves geometry. Keyboard input ignores editable fields.
- Tests cover snapping priority/tolerance, curve splitting, extension, and history branching.
- Geometric endpoint joins are supported here; persistent network connectivity belongs to M6.

## M2.1 — Path/area snapping refinement [implemented — browser verification pending]

Plan: improve the existing geometric resolver instead of introducing persistent constraints yet. Share it between point drafting, node editing and rigid selection movement.
Acceptance and current implementation:
- Path-to-area, area-to-path, area-to-area and path-to-path anchors/boundaries are targets, including curved closing area segments. Hidden objects and moving source objects are excluded; locked stationary objects remain valid references.
- A source only snaps to objects on its own Z level. New drafts use ground level; path extension retains the source level.
- Bézier boundary projection evaluates the actual line/quadratic/cubic geometry, including looping cubics and degenerate segments. Curve controls are not join anchors. Immutable per-object target geometry is cached; control bounds reject distant candidates before projection.
- Track-attached platform edges expose their track-facing and platform-facing boundaries over the attachment range, using the same offset sampling as the visible bands. Standalone edges expose their far boundary as well as their canonical path.
- Moving an object/group applies one snapped translation, preserving shape, relative arrangement, attachments and Z levels; the resulting document edit remains one undoable transaction.
- Snap labels identify target geometry/name; hold Alt to bypass temporarily. Anchor priority, then boundary, then grid, and 10-screen-pixel object tolerance are retained.
- Pure tests cover bidirectional path/area use, curve projection, visibility/elevation, attachment clipping, controls exclusion, rigid group movement and undo/redo. Browser verification remains pending if managed preview is unavailable.
Remaining: sticky shared constraints/junctions and changes propagating between previously snapped objects belong to M6. Snapping establishes coincident geometry, not a persistent link. Large-project snap indexing/benchmarks remain M6 work.

## M3 — Shared curved area boundaries [complete]

Plan: unify area boundaries with ordered line/quadratic/cubic segments; migrate legacy vertex areas on load.
Acceptance:
- Areas use left-click standard / E control / right-click remove / Enter close, including curved closing segments.
- Area fill is selected by dropdown. Finished area anchors and controls can be edited; closure is preserved when moving the first anchor.
- Areas and paths share snapping. Reject collapsed/zero-area drafts with a useful message.
- JSON version migration and curve geometry/closure/history regression tests pass.
- Self-intersection repair, holes and boolean operations remain later work.

## M4 — Elevation and material rendering order [complete]

Plan: numeric integer Z levels on every object and a deterministic render plan separating materials within each level.
Acceptance:
- Any area/path can be placed above or below another using its Properties Z level; values survive JSON and undo/redo.
- For a given level, all trackbeds render below all sleepers, and all sleepers below all rails. Higher levels render entirely above lower levels.
- Canvas hit selection follows displayed ordering; object list reflects stacking. Attached edges inherit their track level.
- Tests assert render order and legacy default levels.

## M5 — Selection, transactions and production interaction QA [partial — interaction QA blocked]

Acceptance: multi-selection/box selection, grouped translation and deletion, arrow nudging, lock/hide controls, property-edit coalescing, drag cancellation without history corruption, visible unsaved status and leave warnings, browser tests for drawing/dragging/keyboard/file flows. No browser QA claims without observing it pass.

## M6 — Network topology and performance foundation [planned]

Acceptance: explicit versioned endpoint junction references with validated connectivity; edits propagate shared junctions without linking different elevations automatically; geometry/length queries independent of Konva; documented graph boundaries for future train/pedestrian modules; benchmarks and bounded sampling, caching, culling/spatial indexing where measured useful. No running simulation.

## M7 — Textured materials [planned — very near future, next after snapping]

Plan: introduce a small shared material registry with deterministic, locally generated/reusable textures before adding dependencies or an asset pipeline.
Acceptance:
- Replace flat grass, asphalt/platform, concrete and trackbed/ballast surfaces with clearly distinct textures, preserving the requested rail/sleeper/white-strip proportions and useful selection contrast.
- Texture tiling has an explicit world-meter size and remains stable when zooming, panning, moving geometry and reloading projects; curved areas and platform bands clip textures correctly without seams leaking outside geometry.
- Keep material IDs/settings in the document and texture caches in rendering only. Existing area kinds, old saved files and local recovery get compatible defaults through validated migration when needed.
- Provide a simple material/fill selector and a texture-off/low-detail option. Missing/failed materials have a readable solid-color fallback; avoid remote asset requirements.
- Cache/reuse texture tiles, verify overlap/Z-order behavior and record a performance comparison on a representative station. Add tests for material defaults/migration and world-scale tiling, plus browser screenshots for the visual result.

## M8 — Prop system and initial catalog [planned — very near future, immediately after M7]

Plan: add reusable catalog definitions and lightweight placed prop instances with stable IDs; prepare footprints for future simulation without implementing behavior.
Acceptance:
- Ship a useful catalog including **platform canopies, benches, passenger information displays (PIDs), ticket machines and ticket barriers**, plus practical items such as signage, lights, bins, shelters, stairs, lifts and bicycle racks where feasible in the initial catalog.
- Add a catalog browser with category filters, thumbnails, clear dimensions and a placement preview. Placing, selecting, moving, rotating, duplicating and deleting props must work with undo/redo.
- Prop instances have world-coordinate position, rotation and Z level, reference catalog types, and participate in lock/hide, grouped selection, layering, snapping and project JSON validation/migration.
- Canopies and elevated components respect rendering layers; footprints and optional obstruction/clearance metadata remain renderer-independent for later pedestrian simulation. No moving agents, routing or simulation yet.
- Catalog assets/materials render locally and reuse M7 materials where appropriate. Unknown/missing prop types show a clear fallback and preserve project data.
- Add placement/transform/history/file-round-trip tests and browser checks for catalog selection, placement preview and layered appearance. Validate that a station with many repeated props remains usable.

## Verification notes

Baseline: 25 tests pass. Managed `sites-preview` relay repeatedly times out; attempt browser QA after changes, report its actual outcome, and continue pure geometry/state checks if infrastructure remains unavailable. Build currently emits a bundle-size warning; address using evidence in M6, not by suppressing it.

M1 evidence: 32 tests pass; explicit TypeScript check and production build pass. Open validates into a new document before one undoable replacement. Recovery writes only completed document geometry, reports storage/validation errors, and preserves unreadable recovery rather than overwriting it. Browser storage/file-picker interaction remains part of M5 browser QA.

M2 evidence: 40 tests pass, TypeScript and production build pass. Snap prioritizes anchors/boundaries within 10 screen pixels before the grid, excludes the moved node and its own boundary, and shows a marker. Extend preserves path identity/type/attachments and undoable draft state. Midpoint splitting uses de Casteljau and retains curve shape. Endpoint connections are geometric coincidence, not persistent graph junctions (M6).

M3 evidence: 46 tests pass; TypeScript and production build pass. Areas now share start/segments with paths; schema v2 writes curved areas and migrates v1 vertex polygons. Closing curve controls and first-anchor edits preserve closure. Exact polynomial area integration replaced sampled area estimates after a curve-splitting regression exposed sampling drift. Fill dropdown, control handles, midpoint insertion, shared snapping and draft history are implemented. Self-intersections with nonzero signed area are not repaired/rejected; holes and booleans remain out of scope.

M4 evidence: 50 tests pass; TypeScript and production build pass. Every object supports an integer Z level (-1000..1000), defaulting to zero for old files. Render and hit plans share level/material ordering. Beds/sleepers/rails are global passes per level; attached edges inherit the track level. Transparent interaction shapes keep whole-object dragging synchronized across material passes. Numeric levels represent stacking, not physical bridge clearance or grades. Browser interaction QA remains M5 and has not been claimed.

M5 implementation evidence: Shift-click, box selection, Select All, group translation/deletion, 1 m/10 m keyboard nudging, lock/hide flags, no-op history suppression, blur/Enter property transactions with Escape cancellation, file-dirty status and leave warnings are implemented. Drag transactions check document identity and discard stale previews after undo/load; Escape/blur cancel active drags. Model tests cover grouping, locks, visibility, no-op branching and selection containment. Pending: automated browser verification of property focus, constrained handles, middle-button panning, box/group movement, cancellation and file/recovery dialogs. Managed preview retry returned `relay could not open browser port 4173: timed out waiting for relay readiness`; status reports stopped. Do not mark M5 complete based on unit tests alone.

M6 remains planned: no persistent shared junction references, physical elevation constraints, routing or simulation have been introduced. Large-project benchmarking, adaptive bounded sampling, caching/culling/spatial index and broad Zustand subscription cleanup remain explicit follow-up work.

Final M5 core verification: 57 regression tests, explicit TypeScript check, production build and whitespace checks pass. UI-only flows remain unverified due to the managed preview relay failure; large-project performance and topology are not claimed complete.

M2.1 verification: 69 regression tests pass, strict TypeScript and production build pass. Managed preview was attempted again and failed with the browser-port relay readiness timeout; visual/interaction verification is still pending. Textures (M7) and props (M8) were promoted to the next two near-term priorities, with acceptance criteria; neither is implemented in this snapping change.
