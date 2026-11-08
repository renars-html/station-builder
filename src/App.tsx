import CommittedInput from "./components/CommittedInput";
import { stackingOrder } from "./model/renderPlan";
import PathEditing from "./components/PathEditing";
import ProjectFiles from "./components/ProjectFiles";
import PathMeasurements from "./components/PathMeasurements";
import TrackPlatformProperties, {
  type EdgeEditing,
} from "./components/TrackPlatformProperties";
import { BASE_SCALE, MIN_SCALE, MAX_SCALE, zoomPercent } from "./model/view";
import { useEffect, useRef, useState } from "react";
import {
  MousePointer2,
  Hand,
  Route,
  Spline,
  Hexagon,
  Undo2,
  Redo2,
  Grid2X2,
  Magnet,
  Minus,
  Plus,
  Maximize,
  ChevronDown,
  Layers,
  Trash2,
  TrainFront,
  HelpCircle,
  X,
  PanelLeftClose,
} from "lucide-react";
import Canvas, { type View } from "./components/Canvas";
import { useEditor, type Tool } from "./store/editor";
import {
  colors,
  pathKinds,
  points,
  type PathKind,
  type AreaKind,
  type Point,
} from "./model/station";
const tools = [
  {
    id: "select",
    label: "Select",
    key: "V",
    icon: MousePointer2,
    help: "Click an object to select it. Drag to move; drag its nodes to edit geometry.",
  },
  {
    id: "pan",
    label: "Pan",
    key: "H",
    icon: Hand,
    help: "Drag the canvas to move around. You can also hold Space with any tool.",
  },
  {
    id: "path",
    label: "Path",
    key: "P",
    icon: Route,
    help: "Left-click adds a standard point. E adds a control point at the cursor (up to two between standard points). Right-click removes the last point. Enter finishes after a standard point. Select a finished path to set its type.",
  },
  {
    id: "area",
    label: "Area",
    key: "A",
    icon: Hexagon,
    help: "Left-click standard points; E adds up to two curve controls. Right-click removes the last point. Enter or click the first point closes the area, including a curved closing edge.",
  },
] as const;
export default function App() {
  const {
    error,
    clearError,
    station,
    tool,
    setTool,
    selected,
    selection,
    nudge,
    selectMany,
    select,
    commit,
    undo,
    redo,
    past,
    future,
    remove,
    draft,
    setDraft,
  } = useEditor();
  const [grid, setGrid] = useState(true),
    [snap, setSnap] = useState(false),
    [kind, setKind] = useState<AreaKind>("platform"),
    [view, setView] = useState<View>({ x: 30, y: 15, scale: BASE_SCALE }),
    [position, setPosition] = useState<Point>({ x: 0, y: 0 }),
    [help, setHelp] = useState(false),
    [fitRequest, setFitRequest] = useState(0),
    [editingEdge, setEditingEdge] = useState<EdgeEditing | null>(null);
  const finishRef = useRef<(() => void) | null>(null);
  const active =
    selection.length > 1
      ? undefined
      : station.objects.find((o) => o.id === selected);
  const current = tools.find((t) => t.id === tool)!;
  function changeTool(t: Tool) {
    setTool(t);
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (help) {
        if (e.key === "Escape") {
          e.preventDefault();
          setHelp(false);
        }
        return;
      }
      if (
        e.target instanceof HTMLButtonElement &&
        (e.key === "Enter" || e.code === "Space")
      )
        return;
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLSelectElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      )
        return;
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && k === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && k === "a") {
        e.preventDefault();
        setTool("select");
        selectMany(
          useEditor
            .getState()
            .station.objects.filter((o) => !o.hidden)
            .map((o) => o.id),
        );
        return;
      }
      if (e.ctrlKey || e.metaKey) return;
      if (["arrowleft", "arrowright", "arrowup", "arrowdown"].includes(k)) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        nudge(
          k === "arrowleft" ? -step : k === "arrowright" ? step : 0,
          k === "arrowup" ? -step : k === "arrowdown" ? step : 0,
        );
        return;
      }
      if (k === "escape") {
        setEditingEdge(null);
        setDraft([]);
        select(null);
      } else if (k === "enter") {
        e.preventDefault();
        finishRef.current?.();
      } else if (k === "delete" || k === "backspace") {
        e.preventDefault();
        remove();
      } else if (k === "g") setGrid((v) => !v);
      else {
        const t = tools.find((t) => t.key.toLowerCase() === k);
        if (t) {
          setTool(t.id);
        }
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [redo, undo, remove, setTool, select, setDraft, nudge, selectMany, help]);
  const counts = {
    track: station.objects.filter(
      (o) => o.type === "path" && o.kind === "track",
    ).length,
    edge: station.objects.reduce(
      (total, o) =>
        total +
        (o.type === "path"
          ? o.kind === "edge"
            ? 1
            : o.kind === "track"
              ? (o.platformEdges?.length ?? 0)
              : 0
          : 0),
      0,
    ),
    area: station.objects.filter((o) => o.type === "area").length,
  };
  return (
    <div className="app">
      <header>
        <a className="brand" href="#">
          <span className="brand-icon">
            <TrainFront size={21} />
          </span>
          yard<span className="brand-sub">STATION DESIGNER</span>
        </a>
        <div className="project-title">
          Untitled station <ChevronDown size={14} />
          <span className="version">DRAFT</span>
        </div>
        <div className="header-actions">
          <span className="local-label">
            <span />
            Local workspace
          </span>
          <button
            className="help-button"
            onClick={() => setHelp(!help)}
            title="Keyboard shortcuts"
          >
            <HelpCircle size={17} />
          </button>
          <ProjectFiles
            onLoaded={() => {
              setEditingEdge(null);
              setFitRequest((n) => n + 1);
            }}
          />
        </div>
      </header>
      <div className="workspace">
        <aside className="sidebar">
          <div className="section-heading">
            DESIGN TOOLS <PanelLeftClose size={14} />
          </div>
          <nav>
            {tools.map((t) => (
              <button
                key={t.id}
                className={"tool " + (tool === t.id ? "active" : "")}
                title={t.help}
                onClick={() => changeTool(t.id)}
              >
                <t.icon size={18} />
                <span>{t.label}</span>
                <kbd>{t.key}</kbd>
              </button>
            ))}
          </nav>
          {tool === "area" && (
            <div className="tool-options">
              <div className="section-heading">AREA TYPE</div>
              <label>
                Fill
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value as AreaKind)}
                >
                  {Object.keys(colors).map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          <div className="layers-title section-heading">
            <span>
              <Layers size={14} /> OBJECTS
            </span>
            <b>{station.objects.length}</b>
          </div>
          <div className="object-list">
            {stackingOrder(station.objects)
              .reverse()
              .map((o) => (
                <button
                  className={
                    "object-row " + (selection.includes(o.id) ? "selected" : "")
                  }
                  key={o.id}
                  onClick={(e) => {
                    select(o.id, e.shiftKey);
                    changeTool("select");
                  }}
                >
                  {o.type === "area" ? (
                    <i style={{ background: colors[o.kind] }} />
                  ) : o.type === "path" && o.kind === "track" ? (
                    <Route size={14} />
                  ) : (
                    <Spline size={14} />
                  )}
                  <span>{o.name}</span>
                  <small>
                    {o.hidden ? "Hidden " : ""}
                    {o.locked ? "Locked " : ""}Z{o.z ?? 0}
                  </small>
                </button>
              ))}
          </div>
          <div className="sidebar-bottom">
            <span className="live-dot" /> EDITOR V0.1 <span>2D / TOP VIEW</span>
          </div>
        </aside>
        <main>
          <div className="canvas-toolbar">
            <div className="toolbar-group">
              <button
                title="Undo (Ctrl+Z)"
                onClick={() => {
                  undo();
                }}
                disabled={!past.length}
              >
                <Undo2 size={17} />
              </button>
              <button
                title="Redo (Ctrl+Shift+Z)"
                onClick={() => {
                  redo();
                }}
                disabled={!future.length}
              >
                <Redo2 size={17} />
              </button>
              <span className="divider" />
              <button
                className={grid ? "toggled" : ""}
                title="Toggle grid (G)"
                onClick={() => setGrid(!grid)}
              >
                <Grid2X2 size={16} />
                <span>Grid</span>
              </button>
              <button
                className={snap ? "toggled" : ""}
                title="Snap to nearby anchors and boundaries, then the 10 m grid"
                onClick={() => setSnap(!snap)}
              >
                <Magnet size={16} />
                <span>Snap</span>
              </button>
            </div>
            <span className="view-label">
              PLAN VIEW <span> / </span> METERS
            </span>
          </div>
          <div className="canvas-wrap">
            <Canvas
              fitRequest={fitRequest}
              editingEdge={editingEdge}
              grid={grid}
              snap={snap}
              kind={kind}
              view={view}
              setView={setView}
              finishRef={finishRef}
              onPosition={setPosition}
            />
            {error && (
              <div className="drawing-error" role="alert">
                {error}
                <button aria-label="Dismiss drawing error" onClick={clearError}>
                  ×
                </button>
              </div>
            )}
            <div className="zoom-controls">
              <button
                title="Zoom out"
                onClick={() =>
                  setView({
                    ...view,
                    scale: Math.max(MIN_SCALE, view.scale / 1.2),
                  })
                }
              >
                <Minus size={16} />
              </button>
              <span>{zoomPercent(view.scale)}%</span>
              <button
                title="Zoom in"
                onClick={() =>
                  setView({
                    ...view,
                    scale: Math.min(MAX_SCALE, view.scale * 1.2),
                  })
                }
              >
                <Plus size={16} />
              </button>
              <span className="divider" />
              <button
                title="Fit station to view"
                onClick={() => {
                  const ps = station.objects.flatMap(points);
                  if (!ps.length) {
                    setView({ x: 30, y: 15, scale: BASE_SCALE });
                    return;
                  }
                  const minX = Math.min(...ps.map((p) => p.x)),
                    minY = Math.min(...ps.map((p) => p.y)),
                    w = Math.max(...ps.map((p) => p.x)) - minX,
                    h = Math.max(...ps.map((p) => p.y)) - minY;
                  const el = document.querySelector(".canvas-host")!;
                  const scale = Math.max(
                    MIN_SCALE,
                    Math.min(
                      MAX_SCALE,
                      (el.clientWidth - 100) / Math.max(w, 1),
                      (el.clientHeight - 100) / Math.max(h, 1),
                    ),
                  );
                  setView({
                    scale,
                    x: (el.clientWidth - w * scale) / 2 - minX * scale,
                    y: (el.clientHeight - h * scale) / 2 - minY * scale,
                  });
                }}
              >
                <Maximize size={15} />
              </button>
            </div>
            {draft.length > 0 && (
              <div className="draft-actions">
                <span>
                  {draft.length} points placed
                  {tool === "path" && draft.at(-1)?.role === "control"
                    ? " · Add a standard point to finish"
                    : ""}
                </span>
                <button
                  disabled={
                    tool === "path" &&
                    (draft.length < 2 || draft.at(-1)?.role === "control")
                  }
                  onClick={() => finishRef.current?.()}
                >
                  Finish <kbd>↵</kbd>
                </button>
                <button onClick={() => setDraft([])}>Cancel</button>
              </div>
            )}
          </div>
          <footer>
            <span>
              <i className="live-dot" />
              {current.label} tool{" "}
              <span className="footer-muted">
                ·{" "}
                {tool === "pan"
                  ? "Drag to pan"
                  : tool === "select"
                    ? "Click to select"
                    : "Click to place points"}
              </span>
            </span>
            <span className="coordinates">
              X {position.x.toFixed(1)} <span>m</span>　 Y{" "}
              {position.y.toFixed(1)} <span>m</span>
              <b>1 unit = 1 m</b>
            </span>
          </footer>
        </main>
        <aside className="inspector">
          <div className="inspector-title">
            Properties{" "}
            <span>
              {selection.length
                ? `${selection.length} SELECTED`
                : "NO SELECTION"}
            </span>
          </div>
          {active ? (
            <div className="property-body">
              <div className="object-type">
                {active.type === "area"
                  ? active.kind + " surface"
                  : pathKinds[active.kind] + " path"}
              </div>
              <label>
                Object name
                <CommittedInput
                  value={active.name}
                  onCommit={(value) =>
                    commit(
                      station.objects.map((o) =>
                        o.id === active.id ? { ...o, name: value } : o,
                      ),
                    )
                  }
                />
              </label>
              <label>
                Z level
                <CommittedInput
                  numeric
                  integer
                  min={-1000}
                  max={1000}
                  value={active.z ?? 0}
                  onCommit={(value) =>
                    commit(
                      station.objects.map((o) =>
                        o.id === active.id ? { ...o, z: Number(value) } : o,
                      ),
                    )
                  }
                />
              </label>
              <div className="object-flags">
                <label>
                  <input
                    type="checkbox"
                    checked={active.locked ?? false}
                    onChange={(e) =>
                      commit(
                        station.objects.map((o) =>
                          o.id === active.id
                            ? { ...o, locked: e.target.checked }
                            : o,
                        ),
                      )
                    }
                  />
                  Locked
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={active.hidden ?? false}
                    onChange={(e) =>
                      commit(
                        station.objects.map((o) =>
                          o.id === active.id
                            ? { ...o, hidden: e.target.checked }
                            : o,
                        ),
                      )
                    }
                  />
                  Hidden
                </label>
              </div>
              <p className="muted">
                Higher levels render above lower levels. Use negative levels for
                underpasses and positive levels for bridges.
              </p>
              <div className="property-stats">
                <div>
                  <span>Geometry</span>
                  <b>{active.type === "area" ? "Polygon" : "Path"}</b>
                </div>
                <div>
                  <span>
                    {active.type === "area" ? "Boundary segments" : "Segments"}
                  </span>
                  <b>
                    {active.type === "area"
                      ? active.segments.length
                      : active.segments.length}
                  </b>
                </div>
              </div>
              {active.type === "path" && (
                <label>
                  Path type
                  <select
                    value={active.kind}
                    onChange={(e) =>
                      commit(
                        station.objects.map((o) =>
                          o.id === active.id
                            ? { ...active, kind: e.target.value as PathKind }
                            : o,
                        ),
                      )
                    }
                  >
                    {Object.entries(pathKinds).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {!active.locked &&
                !active.hidden &&
                (active.type === "path" || active.type === "area") && (
                  <PathEditing key={active.id} path={active} />
                )}
              {active.type === "path" && active.kind === "track" && (
                <TrackPlatformProperties
                  track={active}
                  editing={editingEdge}
                  setEditing={setEditingEdge}
                />
              )}
              {active.type === "area" && (
                <label>
                  Surface type
                  <select
                    value={active.kind}
                    onChange={(e) =>
                      commit(
                        station.objects.map((o) =>
                          o.id === active.id
                            ? { ...active, kind: e.target.value as AreaKind }
                            : o,
                        ),
                      )
                    }
                  >
                    {Object.keys(colors).map((k) => (
                      <option key={k}>{k}</option>
                    ))}
                  </select>
                </label>
              )}
              <p className="muted">
                Drag the object to move it. Drag the outlined nodes to reshape
                it.
              </p>
              <button
                className="delete-button"
                disabled={active.locked}
                onClick={remove}
              >
                <Trash2 size={14} />
                Delete object <kbd>⌫</kbd>
              </button>
            </div>
          ) : (
            <div className="empty-selection">
              <p>
                {selection.length > 1
                  ? `${selection.length} objects selected. Drag a selected object to move the group; Delete removes unlocked objects.`
                  : "Select an object on the canvas to view and edit its properties."}
              </p>
            </div>
          )}
          {active?.type === "path" && <PathMeasurements path={active} />}
          <div className="overview">
            <div className="section-heading">STATION OVERVIEW</div>
            <div>
              <span>
                <Route size={15} />
                Tracks
              </span>
              <b>{String(counts.track).padStart(2, "0")}</b>
            </div>
            <div>
              <span>
                <Spline size={15} />
                Platform edges
              </span>
              <b>{String(counts.edge).padStart(2, "0")}</b>
            </div>
            <div>
              <span>
                <Hexagon size={15} />
                Surface areas
              </span>
              <b>{String(counts.area).padStart(2, "0")}</b>
            </div>
          </div>
          <div className="tool-guide">
            <div className="guide-icon">
              <current.icon size={17} />
            </div>
            <span className="eyebrow">TOOL GUIDE</span>
            <h3>{current.label}</h3>
            <p>{current.help}</p>
            <div>
              <kbd>Esc</kbd> cancel <span>·</span> <kbd>Space</kbd> pan
            </div>
          </div>
        </aside>
      </div>
      {help && (
        <div className="modal-backdrop" onClick={() => setHelp(false)}>
          <div className="help-modal" onClick={(e) => e.stopPropagation()}>
            <button className="close-modal" onClick={() => setHelp(false)}>
              <X size={18} />
            </button>
            <h2>Editor shortcuts</h2>
            <p>
              Draw paths and surfaces, then select an object to refine its
              nodes. Left-click places standard points. Press E at the cursor to
              place one control point for a quadratic curve, or two for a cubic
              curve, then left-click the next standard point. Right-click
              removes the last point. Enter finishes a path ending at a standard
              point.
            </p>
            {[
              ["V / H", "Select / Pan"],
              ["P / A", "Path / Area"],
              ["E", "Add path control point at cursor"],
              ["Right-click", "Remove last drawing point"],
              ["Enter", "Finish drawing"],
              ["Escape", "Cancel drawing or deselect"],
              ["Delete", "Delete selection"],
              ["Ctrl / ⌘ + Z", "Undo"],
              ["Ctrl / ⌘ + Shift + Z", "Redo"],
              ["G", "Toggle grid"],
              ["Space + drag", "Pan canvas"],
              ["Mouse wheel", "Zoom at cursor"],
            ].map(([key, label]) => (
              <div className="shortcut" key={key}>
                <span>{label}</span>
                <kbd>{key}</kbd>
              </div>
            ))}
            <p className="muted">
              Use Save JSON for a portable project file, and Open JSON to load
              it. Completed geometry also has local browser recovery; draft
              points are not saved.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
