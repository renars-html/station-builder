# Yard — Station designer

Desktop 2D railway layout editor built with React, strict TypeScript, Vite, react-konva, Zustand and Tailwind. No simulation, server, or public deployment.

## Run and verify

Requires Node.js 20.19+ (Node 22 recommended).

```sh
npm install
npm run dev
npm run typecheck
npm test
npm run build
```

Vite prints the local URL. `dist/` contains the production build. The template is a single 50 m straight track with a full-length attached platform edge.

## Drawing and editing

- **P — Path:** left-click standard points; **E** at the cursor places up to two control points between standards. Zero controls makes a line, one a quadratic Bézier, two a cubic. Right-click removes the last point; Enter finishes after a standard point. Assign Placeholder, Track, or Platform edge in Properties.
- **A — Area:** choose a fill from the dropdown. Use the same standard/control points as paths. At least three distinct standard points and a nonzero enclosed surface are required. Enter or click the first point closes the boundary, using pending controls for a curved closing edge.
- **V — Select:** click objects, Shift-click to add/remove from selection, or drag a box on empty canvas to select objects whose anchors and controls are contained. Shift-box adds to selection. Ctrl/Command+A selects visible objects. Drag a selected object to move the unlocked selected group; Delete/Backspace deletes unlocked selected objects. Arrow keys nudge by 1 m, Shift+arrows by 10 m. Locked objects remain selectable in the object list but cannot be moved, reshaped, extended or deleted. Hidden objects are omitted from canvas/snap/box targets; select them in Objects to unhide them.
- Drag outlined nodes to edit a finished path or area. Closed area first/final anchors stay joined. **Insert midpoint** splits the chosen line or curve exactly without changing shape. Paths also offer **Remove segment** and **Extend from end**. Extension preserves ID, path type, Z level and attachments.
- **H — Pan**, hold Space and drag, or middle-button drag. Middle button never moves objects or nodes. Wheel zooms around the cursor; 100% = 12 pixels/m. Grid lines are 10 m apart. Bottom-right controls zoom or fit the project.
- **Snap:** prioritize object anchors and boundaries within 10 screen pixels, then the 10 m grid. The marker distinguishes object targets from grid. Coincident endpoints are geometric joins; they are not yet persistent graph junctions.
- **G** toggles grid. **Escape** cancels drawing/dragging or deselects. **Ctrl/Command+Z** undoes; **Ctrl/Command+Shift+Z** or **Ctrl/Command+Y** redoes. Draft additions/removals, finishing, extension, grouped movement/deletion and property changes are undoable. Undoing finishing reopens the draft. New edits clear redo; unchanged edits do not.
- Text/numeric property fields commit on blur/Enter, making one history step. Escape restores the field. Form inputs retain native typing shortcuts.

## Platform edges and levels

Select a Track and choose **Platform edge → Add platform edge**. The UI intentionally exposes one attachment; the model retains a collection for future expansion. The default edge covers the full track with zero gap from the outside of its trackbed. **Flip side** changes left/right relative to the start-to-end direction. Set distance in meters. **Edit start/end** exposes green start/orange end handles constrained to the track centerline; handles cannot cross. **Done editing** returns to geometry editing. Edges move/reshape with their parent track.

Lengths appear above Station overview for all path types and attached edges. Attached-edge lengths measure the offset outer boundary, accounting for side, distance and range on curves. Curve lengths/projections use sampled arc lengths; enclosed area uses exact Bézier polynomial integration.

**Z level** is an integer drawing elevation for all objects. Higher levels render wholly above lower ones; zero is ground. Within a level all trackbeds render before all sleepers, then all rails. Attached edges inherit their parent level. Render and hit-test passes share ordering. These levels do not establish engineering clearances, gradients or simulation constraints.

Track appearance uses 1.435 m gauge, 0.14 m rails, a 3.4 m brown bed and 2.6 m concrete sleepers, 0.42 m thick with 0.54 m gaps. Platform bands are white/asphalt/white/asphalt with widths 0.2/1/0.9/0.9 m. Platform fills match the asphalt. Area text labels are intentionally absent.

## Project files and recovery

**Save JSON** downloads a portable project; **Open JSON** validates before replacing the document, fits the new project, and creates one undoable history step. IDs and world coordinates are preserved. Unsupported versions, duplicate IDs, malformed/nonfinite coordinates, invalid ranges, unclosed/collapsed areas and invalid flags/levels are rejected with actionable messages. Limits: 8 MB, 10,000 objects, 100,000 geometry points.

New files use schema v2, with shared closed line/quadratic/cubic area boundaries. Version-1 polygon files migrate on load. Completed geometry also writes to browser-local recovery after 600 ms; drafts and viewport are excluded. Storage failures are reported; corrupt recovery is preserved until a valid project is explicitly opened. Use JSON files for portable backups. The header marks changes since the last file open/download, and leaving with unexported changes or draft points requests the browser's standard warning.

## Modules

- `src/model/station.ts`: world-coordinate document types, geometry transforms, stable IDs and template. No React/Konva dependencies.
- `projectFile.ts`: validation/version migration and serialization boundary.
- `pathDraft.ts`, `pathEditing.ts`, `areaGeometry.ts`: pure construction, curve splitting, area closure/measurement.
- `pathAppearance.ts`, `trackPlatform.ts`, `pathMeasurements.ts`: sampling, offsets, sleepers, attachment clipping/projection and lengths.
- `snapping.ts`, `selection.ts`, `renderPlan.ts`: snapping, group transformations/box selection and deterministic drawing levels/material passes.
- `src/store/editor.ts`: document/draft snapshots, 100-step history, loading, selection and editing actions. Viewport/selection do not create document history.
- `src/components/`: Konva rendering and hit shapes, constrained range handles, reusable inspector fields, file controls, and path-editing properties. Drag previews stay transient until commit; stale document drags are discarded.
- `src/App.tsx`: desktop workspace, inspector, shortcuts, object list and tool guides.

See [ROADMAP.md](ROADMAP.md) for priorities, acceptance criteria, evidence and remaining work. [AGENTS.md](AGENTS.md) gives persistent contributor guidance.

## Verification and remaining limitations

Automated geometry/state/validation tests, explicit TypeScript checks, and production builds are run per milestone. Managed browser preview currently fails with a relay readiness timeout; visual/file-picker/drag/keyboard interaction QA is unverified, and M5 remains incomplete until browser tests can run. The build reports a bundle-size warning.

There is no persistent junction graph, routing, simulation, polygon holes/boolean operations, or railway engineering validation. Nonzero-area self-intersecting shapes are not repaired. Large-project spatial indexing/culling, bounded adaptive sampling and performance benchmarks remain M6 work. Local recovery is browser-specific, not a substitute for saved JSON files.
