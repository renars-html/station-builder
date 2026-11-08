# Working on Yard

This is a desktop-only React + strict TypeScript + Vite editor using react-konva, Zustand and Tailwind. Follow ROADMAP.md in priority order. Do not stop at planning when implementation is authorized. Complete, verify, document and commit milestones separately when possible; leave remaining acceptance criteria explicit. Do not deploy publicly or implement simulation.

## Model and behavior

- Geometry is serializable world coordinates in meters, independent of React/Konva. Keep geometry, validation, migration and editing algorithms in `src/model/` and transaction/history actions in `src/store/`.
- Preserve IDs, attachment ranges, and world geometry across viewport changes and JSON round trips. Derived render data never belongs in saved files. Version schema changes and migrate old supported files.
- Keep tracks/platform edges as typed paths, surfaces separate. Single attached platform edge UI only until explicitly requested otherwise; retain an extensible attachment collection.
- Left-click draws standard points. E at the pointer places up to two controls between standards. Right-click removes the last draft point. Enter finishes. One control is quadratic; two are cubic. Preserve this input flow for curved areas as well.
- Only left-button dragging in Select mode moves geometry. Middle button always pans, including over objects and node handles. Space pans; do not capture typing/shortcuts from input/select/textarea/contenteditable fields.
- Default zoom 100% = 12 pixels/meter, grid 10 meters. Keep hit targets and handles screen-sized.
- Draft/history operations are undoable. One completed drag is one document transaction. Invalid/failed operations must not mutate data, history, or selection. Undo must not commit a stale drag preview.
- Keep the UI practical and instructional; no promotional/decorative copy and no area text labels. Support all path and area kinds in layers, selection, file IO and geometry editing.

## Verification and delivery

- Run `npm test`, `npm run typecheck`, `npm run build`; fix failures. Add meaningful geometry/state/validation regression tests, not implementation-mirroring tests for cosmetic changes.
- Attempt browser verification using managed preview when available. Inspect failures; do not claim visual QA passed if the relay is unavailable. Do not replace managed preview infrastructure or change app code to disguise an environment failure.
- Update README.md usage and architecture, and ROADMAP.md status/evidence/remaining work for each milestone. Commit completed milestones, then push to the existing connected branch when authorized by the session. Do not rewrite remote history.
- Avoid new dependencies or major rewrites without a concrete benefit. Prefer small reusable modules over adding unrelated responsibilities to Canvas.tsx or App.tsx. Error messages should be actionable; reject untrusted JSON before use.

## Current milestone state

M0–M4 are implemented. M5 interaction features are implemented but browser QA is pending because managed preview relay readiness fails. Do not call M5 complete until those flows are observed/tested in a browser. M6 topology/performance remains planned. Current schema is v2; migrate v1 polygon vertices into closed segment boundaries. Optional Z/locked/hidden fields default to ground/unlocked/visible. Keep render and hit passes in matching order. Lock prevents geometric changes/deletion, not inspecting or changing metadata. Selection is independent of history; group edits commit once. A no-op must preserve redo. Update these notes when milestone status changes.

## Latest near-term priorities

The user reprioritized upcoming work: path/area snapping refinements (M2.1) are implemented with browser QA still pending; next implement textured materials (M7) and the prop system/catalog (M8) in the very near future. Keep M5 browser QA open while the relay is unavailable; M6 persistent topology/performance follows these requested features. Textures and props are roadmap commitments, not already implemented features. The requested prop catalog includes platform canopies, benches, PIDs, ticket machines and ticket barriers.

Snapping is geometric, not a persistent constraint. Use the shared resolver for draft points, edited nodes and rigid selection translations; preserve shape/relative offsets, exclude hidden/moving targets, and respect source Z levels. Alt bypasses snapping. Bézier projections use actual curves; offset platform boundaries use the same samples as rendering. Target caches assume immutable document objects; never mutate objects in place.
