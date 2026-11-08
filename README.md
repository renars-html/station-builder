# Yard — Station designer

A desktop 2D railway station layout editor built with React, strict TypeScript, Vite, Konva / react-konva, Zustand, and Tailwind CSS. No simulation or server is included.

## Run

Requires Node.js 20.19+ (Node 22 recommended).

```sh
npm install
npm run dev
npm run typecheck
npm run build
npm test
```

Vite prints the local development URL. `dist/` contains the production build. Nothing is deployed automatically.

## Use

The startup template is one 50 m straight track with a full-length attached platform edge. Select and delete objects to replace it with your own design.

- **Select (V):** click an object or its entry in Objects. Drag it to move. Drag outlined nodes to change endpoints, Bézier controls, or polygon vertices. The inspector edits its name and surface type.
- **Pan (H):** drag the view. Hold Space and drag or use the middle mouse button with any tool.
- **Path (P):** left-click adds a standard point. Press **E** at the cursor to add a control point after the first standard point. Zero controls between standard points makes a line; one makes a quadratic Bézier; two makes a cubic Bézier. A third control is ignored until another standard point is placed. **Right-click** removes the last placed point. **Enter** finishes a path with at least two standard points; if controls are pending, place the next standard point or remove the controls first. New paths are placeholder lines; select one and use **Properties → Path type** to assign Track or Platform edge.
- Undo/redo includes every point addition, right-click removal, cancellation, and finishing. Undoing a finished path reopens its draft; redoing finishes it again. Making a new edit after undo clears redo.

- **Area (A):** choose Platform, Grass, Road, or Other; click at least three vertices. Enter or click the first vertex to close the polygon.
- **Escape:** cancel drawing or deselect. Changing tools cancels the unfinished drawing.
- **Delete / Backspace:** delete selection.
- **Ctrl/Command+Z:** undo; **Ctrl/Command+Shift+Z** or **Ctrl/Command+Y:** redo.
- **G:** toggle grid. Snap prioritizes nearby object anchors and boundaries within 10 screen pixels, then falls back to the 10 m grid. The snap marker distinguishes object targets from grid targets.
- Mouse wheel zooms around the cursor. Bottom-right controls zoom or fit all objects.
- **Export layout:** download the station as renderer-independent JSON.

Each tool also has a brief in-app guide. Coordinates and geometry use meters; screen transforms never modify stored coordinates.

## Architecture

- `src/model/station.ts`: serializable, renderer-independent station types and pure geometry helpers. Paths have an explicit start, ordered line/quadratic/cubic segments, and a separate kind (placeholder, track, or edge). The `pathKinds` registry supplies the inspector dropdown and can be extended with future kinds. Polygon surfaces are independent objects; edges are separate path objects. IDs use `crypto.randomUUID()`.
- `src/model/pathAppearance.ts`: metric rail offsets and arc-length sleeper placement for straight and curved paths. Tracks use 1.435 m rail spacing, a 3.4 m brown bed, and 2.6 m concrete sleepers (0.42 m wide on 0.96 m centers, leaving 0.54 m gaps). Platform edges use white/asphalt/white/asphalt bands of 0.2/1.0/0.9/0.9 m, directed toward the nearest platform surface. Platform fills match the asphalt. Rails are 0.14 m thick. At 100% zoom each meter spans 12 screen pixels; grid lines are 10 m apart. Area labels are hidden. Only left-button dragging in Select mode moves objects or nodes; middle-button dragging always pans. Zoom supports up to 2400% for inspecting these details.
- `src/model/pathDraft.ts`: typed standard/control draft points and pure line/quadratic/cubic construction.
- `src/store/editor.ts`: Zustand document, selection, tools, and bounded (100-step) snapshot undo/redo. Document edits and drawing drafts share history snapshots; viewport and selection changes do not.
- `src/components/Canvas.tsx`: Konva rendering, screen-to-world conversion, draft tools, node handles, panning, zooming, and grid. Drag previews stay outside the document until committed.
- `src/App.tsx`: desktop workspace, inspector, object list, shortcuts, export, and tool guides.
- `src/styles.css`: Tailwind integration and workspace styles.
- `src/model/station.test.ts`: geometry and document history regression checks.

Future simulation modules can consume `Station` directly without importing React or Konva. The current document deliberately describes geometry rather than connectivity, routing, or simulation agents.

## Current limits

Use **Save JSON** and **Open JSON** for portable projects. Opening validates before replacing the document and is undoable. Completed geometry is also saved to browser-local recovery after 600 ms; draft points are not recovered. Storage errors are shown, and file saving remains available. Unsupported or malformed JSON is rejected with an explanation (8 MB limit, 10,000 objects and 100,000 geometry points). Selection is single-object. The editor does not enforce valid nonintersecting polygons or railway engineering constraints. There is no simulation, networking, or public deployment.

## Verification

`npm run build` and `npm test` pass (geometry and drawing-history regression tests). Interactive browser QA could not be completed in the managed environment: `sites-preview` reported a browser relay readiness timeout. Manual checking of drawing, node dragging, and view controls in a local desktop browser is recommended before relying on the editor for production work.

## Track-attached platform edge

Select a Track path and choose **Platform edge → Add platform edge**. The attachment initially spans the entire track with zero gap from the trackbed. Use **Flip side** to switch Left/Right relative to the direction from the path start to its end, and set a nonnegative distance from the outside of the trackbed in meters. The platform bands extend outward from the track.

Choose **Edit start / end** to drag the green start and orange end handles. Handles project onto the track centerline, including curves, and cannot cross. Choose **Done editing** to return to normal geometry editing. Middle-button dragging continues to pan. Each completed handle drag, property edit, addition, or removal supports undo/redo. Attachments move and reshape with the track.

`TrackPlatformEdge` stores an ID, side, distance, and normalized arc-length start/end positions (0–1). These fractions preserve relative placement when the track length changes. `PathObject.platformEdges` is a collection to allow future expansion; this version exposes exactly one attachment per track. No additional platform polygon or independently movable path is created. `src/model/trackPlatform.ts` supplies renderer-independent projection, clipping, and attachment band geometry; curve positions use the same sampled path as the renderer.

The Properties panel displays the selected path’s length in meters directly above Station overview, for placeholder, track, and standalone platform-edge paths. Tracks also display attached platform-edge lengths along their offset outer boundary. Curved lengths use sampled arc lengths. Measurements update after geometry, side, distance, or range changes.

See ROADMAP.md for prioritized acceptance criteria and progress. AGENTS.md records persistent implementation guidance.

Selected paths now offer **Extend from end**, **Insert midpoint**, and **Remove segment**. Extension preserves the object ID, path kind, and attachments; finishing or cancelling remains undoable. Midpoint insertion exactly splits straight/quadratic/cubic segments. Snapped endpoints coincide geometrically; they are not yet shared network junctions.
