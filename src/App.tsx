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
  Download,
  ChevronDown,
  Layers,
  Trash2,
  TrainFront,
  Check,
  HelpCircle,
  X,
  PanelLeftClose,
} from "lucide-react";
import Canvas, { type View } from "./components/Canvas";
import { useEditor, type Tool } from "./store/editor";
import { colors, points, type AreaKind, type Point } from "./model/station";
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
    id: "track",
    label: "Track",
    key: "T",
    icon: Route,
    help: "Click to place points. In curve mode: start, control 1, control 2, end. Enter finishes the path.",
  },
  {
    id: "edge",
    label: "Platform edge",
    key: "E",
    icon: Spline,
    help: "Draw a platform boundary. Click points for lines, or groups of 3 for curves. Enter finishes.",
  },
  {
    id: "area",
    label: "Area",
    key: "A",
    icon: Hexagon,
    help: "Click to place polygon vertices. Click the first vertex or press Enter to close the area.",
  },
] as const;
export default function App() {
  const {
    station,
    tool,
    setTool,
    selected,
    select,
    commit,
    undo,
    redo,
    past,
    future,
    remove,
  } = useEditor();
  const [grid, setGrid] = useState(true),
    [snap, setSnap] = useState(false),
    [curve, setCurve] = useState(false),
    [kind, setKind] = useState<AreaKind>("platform"),
    [view, setView] = useState<View>({ x: 30, y: 15, scale: 0.82 }),
    [draft, setDraft] = useState<Point[]>([]),
    [position, setPosition] = useState<Point>({ x: 0, y: 0 }),
    [help, setHelp] = useState(false);
  const finishRef = useRef<(() => void) | null>(null);
  const active = station.objects.find((o) => o.id === selected);
  const current = tools.find((t) => t.id === tool)!;
  function changeTool(t: Tool) {
    setDraft([]);
    setTool(t);
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLSelectElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === "z") {
        e.preventDefault();
        setDraft([]);
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && k === "y") {
        e.preventDefault();
        setDraft([]);
        redo();
        return;
      }
      if (e.ctrlKey || e.metaKey) return;
      if (k === "escape") {
        setDraft([]);
        select(null);
      } else if (k === "enter") finishRef.current?.();
      else if (k === "delete" || k === "backspace") {
        e.preventDefault();
        remove();
      } else if (k === "g") setGrid((v) => !v);
      else {
        const t = tools.find((t) => t.key.toLowerCase() === k);
        if (t) {
          setDraft([]);
          setTool(t.id);
        }
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [redo, undo, remove, setTool, select]);
  function download() {
    const blob = new Blob([JSON.stringify(station, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "station-layout.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  const counts = {
    track: station.objects.filter((o) => o.type === "track").length,
    edge: station.objects.filter((o) => o.type === "edge").length,
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
          <button className="export" onClick={download}>
            <Download size={15} /> Export layout
          </button>
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
          <div className="tool-options">
            <div className="section-heading">
              {tool === "area" ? "AREA TYPE" : "PATH GEOMETRY"}
            </div>
            {tool === "area" ? (
              <div className="area-options">
                {(["platform", "grass", "road", "other"] as AreaKind[]).map(
                  (k) => (
                    <button
                      className={kind === k ? "chosen" : ""}
                      onClick={() => {
                        setKind(k);
                        setDraft([]);
                      }}
                      key={k}
                    >
                      <i style={{ background: colors[k] }} />
                      {k}
                      <span>{kind === k && <Check size={13} />}</span>
                    </button>
                  ),
                )}
              </div>
            ) : (
              <div className="segmented">
                <button
                  className={!curve ? "chosen" : ""}
                  onClick={() => {
                    setCurve(false);
                  }}
                >
                  Straight
                </button>
                <button
                  className={curve ? "chosen" : ""}
                  onClick={() => {
                    setCurve(true);
                  }}
                >
                  Bézier
                </button>
              </div>
            )}
          </div>
          <div className="layers-title section-heading">
            <span>
              <Layers size={14} /> OBJECTS
            </span>
            <b>{station.objects.length}</b>
          </div>
          <div className="object-list">
            {[...station.objects].reverse().map((o) => (
              <button
                className={
                  "object-row " + (selected === o.id ? "selected" : "")
                }
                key={o.id}
                onClick={() => {
                  select(o.id);
                  changeTool("select");
                }}
              >
                {o.type === "area" ? (
                  <i style={{ background: colors[o.kind] }} />
                ) : o.type === "track" ? (
                  <Route size={14} />
                ) : (
                  <Spline size={14} />
                )}
                <span>{o.name}</span>
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
                  setDraft([]);
                  undo();
                }}
                disabled={!past.length}
              >
                <Undo2 size={17} />
              </button>
              <button
                title="Redo (Ctrl+Shift+Z)"
                onClick={() => {
                  setDraft([]);
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
                title="Snap to 10 m grid"
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
              grid={grid}
              snap={snap}
              curve={curve}
              kind={kind}
              view={view}
              setView={setView}
              draft={draft}
              setDraft={setDraft}
              finishRef={finishRef}
              onPosition={setPosition}
            />
            <div className="canvas-heading">
              <span>STATION PLAN</span>
              <h1>A place for every journey.</h1>
              <p>Shape the station. Connect the possibilities.</p>
            </div>
            <div className="zoom-controls">
              <button
                title="Zoom out"
                onClick={() =>
                  setView({ ...view, scale: Math.max(0.15, view.scale / 1.2) })
                }
              >
                <Minus size={16} />
              </button>
              <span>{Math.round(view.scale * 100)}%</span>
              <button
                title="Zoom in"
                onClick={() =>
                  setView({ ...view, scale: Math.min(4, view.scale * 1.2) })
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
                    setView({ x: 30, y: 15, scale: 0.82 });
                    return;
                  }
                  const minX = Math.min(...ps.map((p) => p.x)),
                    minY = Math.min(...ps.map((p) => p.y)),
                    w = Math.max(...ps.map((p) => p.x)) - minX,
                    h = Math.max(...ps.map((p) => p.y)) - minY;
                  const el = document.querySelector(".canvas-host")!;
                  const scale = Math.max(
                    0.15,
                    Math.min(
                      4,
                      (el.clientWidth - 100) / Math.max(w, 1),
                      (el.clientHeight - 180) / Math.max(h, 1),
                    ),
                  );
                  setView({
                    scale,
                    x: (el.clientWidth - w * scale) / 2 - minX * scale,
                    y:
                      110 +
                      (el.clientHeight - 140 - h * scale) / 2 -
                      minY * scale,
                  });
                }}
              >
                <Maximize size={15} />
              </button>
            </div>
            {draft.length > 0 && (
              <div className="draft-actions">
                <span>{draft.length} points placed</span>
                <button onClick={() => finishRef.current?.()}>
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
                {tool === "select" ? "Ready to edit" : "Click to place points"}
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
            Properties <span>{active ? "1 SELECTED" : "NO SELECTION"}</span>
          </div>
          {active ? (
            <div className="property-body">
              <div className="object-type">
                {active.type === "area"
                  ? active.kind + " surface"
                  : active.type === "track"
                    ? "Railway track"
                    : "Platform boundary"}
              </div>
              <label>
                Object name
                <input
                  value={active.name}
                  onChange={(e) =>
                    commit(
                      station.objects.map((o) =>
                        o.id === active.id ? { ...o, name: e.target.value } : o,
                      ),
                    )
                  }
                />
              </label>
              <div className="property-stats">
                <div>
                  <span>Geometry</span>
                  <b>{active.type === "area" ? "Polygon" : "Path"}</b>
                </div>
                <div>
                  <span>
                    {active.type === "area" ? "Vertices" : "Segments"}
                  </span>
                  <b>
                    {active.type === "area"
                      ? active.vertices.length
                      : active.segments.length}
                  </b>
                </div>
              </div>
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
              <button className="delete-button" onClick={remove}>
                <Trash2 size={14} />
                Delete object <kbd>⌫</kbd>
              </button>
            </div>
          ) : (
            <div className="empty-selection">
              <div className="selection-icon">
                <MousePointer2 size={24} />
                <span>+</span>
              </div>
              <h3>Make it your own</h3>
              <p>
                Select an object on the canvas
                <br />
                to view and edit its properties.
              </p>
            </div>
          )}
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
            <h3>
              {current.label}
              {tool === "track" || tool === "edge"
                ? curve
                  ? " · Bézier"
                  : " · Straight"
                : ""}
            </h3>
            <p>{current.help}</p>
            <div>
              <kbd>Esc</kbd> cancel <span>·</span> <kbd>Space</kbd> pan
            </div>
          </div>
          <div className="inspector-note">
            Designed for possibilities.
            <br />
            <span>Simulation comes later.</span>
          </div>
        </aside>
      </div>
      {help && (
        <div className="modal-backdrop" onClick={() => setHelp(false)}>
          <div className="help-modal" onClick={(e) => e.stopPropagation()}>
            <button className="close-modal" onClick={() => setHelp(false)}>
              <X size={18} />
            </button>
            <span className="eyebrow">A LITTLE GUIDANCE</span>
            <h2>Your station starts here.</h2>
            <p>
              Draw paths and surfaces, then select an object to refine its
              nodes. Curve paths use three clicks per segment: two controls,
              then an endpoint. Switch between straight and Bézier geometry
              after completing a segment to mix them in one path.
            </p>
            {[
              ["V / H", "Select / Pan"],
              ["T / E / A", "Track / Edge / Area"],
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
              Work is held in memory. Export your layout as structured JSON
              before closing.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
