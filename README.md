# Yard — Station designer

A desktop 2D railway station layout editor built with React, strict TypeScript, Vite, Konva / react-konva, Zustand, and Tailwind CSS. No simulation or server is included.

## Run

Requires Node.js 20.19+ (Node 22 recommended).

```sh
npm install
npm run dev
npm run build
npm test
```

Vite prints the local development URL. `dist/` contains the production build. Nothing is deployed automatically.

## Use

A sample station is loaded on startup. Select and delete objects to replace it with your own design.

- **Select (V):** click an object or its entry in Objects. Drag it to move. Drag outlined nodes to change endpoints, Bézier controls, or polygon vertices. The inspector edits its name and surface type.
- **Pan (H):** drag the view. Hold Space and drag or use the middle mouse button with any tool.
- **Path (P):** left-click adds a standard point. Press **E** at the cursor to add a control point after the first standard point. Zero controls between standard points makes a line; one makes a quadratic Bézier; two makes a cubic Bézier. A third control is ignored until another standard point is placed. **Right-click** removes the last placed point. **Enter** finishes a path with at least two standard points; if controls are pending, place the next standard point or remove the controls first. New paths are placeholder lines; select one and use **Properties → Path type** to assign Track or Platform edge.
- Undo/redo includes every point addition, right-click removal, cancellation, and finishing. Undoing a finished path reopens its draft; redoing finishes it again. Making a new edit after undo clears redo.

- **Area (A):** choose Platform, Grass, Road, or Other; click at least three vertices. Enter or click the first vertex to close the polygon.
- **Escape:** cancel drawing or deselect. Changing tools cancels the unfinished drawing.
- **Delete / Backspace:** delete selection.
- **Ctrl/Command+Z:** undo; **Ctrl/Command+Shift+Z** or **Ctrl/Command+Y:** redo.
- **G:** toggle grid. Snap rounds newly drawn and edited nodes to the 10 m grid.
- Mouse wheel zooms around the cursor. Bottom-right controls zoom or fit all objects.
- **Export layout:** download the station as renderer-independent JSON.

Each tool also has a brief in-app guide. Coordinates and geometry use meters; screen transforms never modify stored coordinates.

## Architecture

- `src/model/station.ts`: serializable, renderer-independent station types and pure geometry helpers. Paths have an explicit start, ordered line/quadratic/cubic segments, and a separate kind (placeholder, track, or edge). The `pathKinds` registry supplies the inspector dropdown and can be extended with future kinds. Polygon surfaces are independent objects; edges are separate path objects. IDs use `crypto.randomUUID()`.
- `src/model/pathDraft.ts`: typed standard/control draft points and pure line/quadratic/cubic construction.
- `src/store/editor.ts`: Zustand document, selection, tools, and bounded (100-step) snapshot undo/redo. Document edits and drawing drafts share history snapshots; viewport and selection changes do not.
- `src/components/Canvas.tsx`: Konva rendering, screen-to-world conversion, draft tools, node handles, panning, zooming, and grid. Drag previews stay outside the document until committed.
- `src/App.tsx`: desktop workspace, inspector, object list, shortcuts, export, and tool guides.
- `src/styles.css`: Tailwind integration and workspace styles.
- `src/model/station.test.ts`: geometry and document history regression checks.

Future simulation modules can consume `Station` directly without importing React or Konva. The current document deliberately describes geometry rather than connectivity, routing, or simulation agents.

## Current limits

Work is held in memory and resets on reload. JSON export is supported; import and automatic persistence are not yet implemented. Selection is single-object. The editor does not enforce valid nonintersecting polygons or railway engineering constraints. There is no simulation, networking, or public deployment.

## Verification

`npm run build` and `npm test` pass (geometry and drawing-history regression tests). Interactive browser QA could not be completed in the managed environment: `sites-preview` reported a browser relay readiness timeout. Manual checking of drawing, node dragging, and view controls in a local desktop browser is recommended before relying on the editor for production work.
