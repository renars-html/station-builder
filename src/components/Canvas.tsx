import EdgeRangeHandles from "./EdgeRangeHandles";
import type { EdgeEditing } from "./TrackPlatformProperties";
import { useEffect, useRef, useState } from "react";
import { Stage, Layer, Line, Path, Group, Circle } from "react-konva";
import Konva from "konva";
import {
  colors,
  pathData,
  points,
  setPoint,
  translate,
  type AreaKind,
  type Point,
  type StationObject,
} from "../model/station";
import { draftGeometry } from "../model/pathDraft";
import PathAppearance from "./PathAppearance";
import { useEditor } from "../store/editor";
import { BASE_SCALE, MIN_SCALE, MAX_SCALE, GRID_SPACING } from "../model/view";

// Konva otherwise permits middle-button object/node dragging by default.
Konva.dragButtons = [0];

export interface View {
  x: number;
  y: number;
  scale: number;
}
interface Props {
  editingEdge: EdgeEditing | null;
  grid: boolean;
  snap: boolean;
  kind: AreaKind;
  view: View;
  setView: (v: View) => void;
  finishRef: React.RefObject<(() => void) | null>;
  onPosition: (p: Point) => void;
}
export default function Canvas({
  editingEdge,
  grid,
  snap,
  kind,
  view,
  setView,
  finishRef,
  onPosition,
}: Props) {
  const initialized = useRef(false);
  const host = useRef<HTMLDivElement>(null),
    stage = useRef<Konva.Stage>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [hover, setHover] = useState<Point | null>(null);
  const [preview, setPreview] = useState<StationObject | null>(null);
  const pan = useRef<{ x: number; y: number; vx: number; vy: number } | null>(
    null,
  );
  const [space, setSpace] = useState(false);
  const {
    station,
    selected,
    select,
    tool,
    commit,
    draft,
    addPoint,
    removeLastPoint,
    finishPath,
  } = useEditor();
  useEffect(() => {
    const observer = new ResizeObserver((e) => {
      const { width, height } = e[0].contentRect;
      setSize({ width, height });
      if (!initialized.current && width && height) {
        initialized.current = true;
        setView({
          x: width / 2 - 450 * BASE_SCALE,
          y: height / 2 - 240 * BASE_SCALE,
          scale: BASE_SCALE,
        });
      }
    });
    if (host.current) observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        setSpace(true);
      }
    };
    const up = () => {
      setSpace(false);
      pan.current = null;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", up);
    };
  }, []);

  const world = () => {
    const p = stage.current?.getPointerPosition();
    if (!p) return null;
    const v = {
      x: (p.x - view.x) / view.scale,
      y: (p.y - view.y) / view.scale,
    };
    return snap
      ? { x: Math.round(v.x / 10) * 10, y: Math.round(v.y / 10) * 10 }
      : v;
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        tool !== "path" ||
        e.key.toLowerCase() !== "e" ||
        e.repeat ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        space ||
        !hover ||
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLSelectElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      e.preventDefault();
      addPoint({ ...hover, role: "control" });
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [tool, hover, space, addPoint]);
  const finish = () => {
    if (tool === "area" && draft.length >= 3) {
      const o: StationObject = {
        id: crypto.randomUUID(),
        name: kind[0].toUpperCase() + kind.slice(1) + " area",
        type: "area",
        kind,
        vertices: draft.map(({ x, y }) => ({ x, y })),
      };
      commit([...station.objects, o], true);
      select(o.id);
    } else if (tool === "path") {
      finishPath();
    }
  };
  finishRef.current = finish;
  const active = station.objects.find((o) => o.id === selected);
  const actual = preview ?? active;
  const editing =
    tool === "select" &&
    actual?.type === "path" &&
    actual.kind === "track" &&
    editingEdge?.pathId === actual.id &&
    actual.platformEdges?.some((e) => e.id === editingEdge.edgeId)
      ? editingEdge
      : null;
  const handle = (o: StationObject) => ({
    onClick: (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (tool === "select" && !space && e.evt.button === 0) {
        e.cancelBubble = true;
        select(o.id);
      }
    },
    draggable: tool === "select" && !space && !(editing && o.id === selected),
    onDragStart: () => select(o.id),
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
      const dx = e.target.x(),
        dy = e.target.y();
      e.target.position({ x: 0, y: 0 });
      commit(
        station.objects.map((a) => (a.id === o.id ? translate(o, dx, dy) : a)),
      );
    },
  });
  const lowX = Math.floor(-view.x / view.scale / GRID_SPACING) * GRID_SPACING,
    lowY = Math.floor(-view.y / view.scale / GRID_SPACING) * GRID_SPACING;
  const highX = (size.width - view.x) / view.scale,
    highY = (size.height - view.y) / view.scale;
  const lines = [];
  if (grid) {
    for (let x = lowX; x < highX; x += GRID_SPACING)
      lines.push(
        <Line
          key={"x" + x}
          points={[x, lowY, x, highY]}
          stroke={x % 100 === 0 ? "#ccd2cb" : "#e0e4dd"}
          strokeWidth={1 / view.scale}
        />,
      );
    for (let y = lowY; y < highY; y += GRID_SPACING)
      lines.push(
        <Line
          key={"y" + y}
          points={[lowX, y, highX, y]}
          stroke={y % 100 === 0 ? "#ccd2cb" : "#e0e4dd"}
          strokeWidth={1 / view.scale}
        />,
      );
  }
  const scaleLength = 10 ** Math.floor(Math.log10(120 / view.scale));
  return (
    <div
      ref={host}
      className="canvas-host"
      style={{
        cursor:
          space || tool === "pan"
            ? "grab"
            : tool === "select"
              ? "default"
              : "crosshair",
      }}
    >
      <Stage
        ref={stage}
        {...size}
        x={view.x}
        y={view.y}
        scaleX={view.scale}
        scaleY={view.scale}
        onContextMenu={(e) => e.evt.preventDefault()}
        onWheel={(e) => {
          e.evt.preventDefault();
          const p = stage.current?.getPointerPosition();
          if (!p) return;
          const scale = Math.max(
            MIN_SCALE,
            Math.min(
              MAX_SCALE,
              view.scale * (e.evt.deltaY < 0 ? 1.1 : 1 / 1.1),
            ),
          );
          setView({
            scale,
            x: p.x - ((p.x - view.x) / view.scale) * scale,
            y: p.y - ((p.y - view.y) / view.scale) * scale,
          });
        }}
        onMouseDown={(e) => {
          if (e.evt.button === 2) {
            if (tool === "path" || tool === "area") removeLastPoint();
            return;
          }
          if (space || tool === "pan" || e.evt.button === 1) {
            const p = stage.current?.getPointerPosition();
            if (p) pan.current = { ...p, vx: view.x, vy: view.y };
            return;
          }
          if (e.evt.button !== 0) return;
          const p = world();
          if (!p) return;
          if (tool === "select") {
            if (e.target === stage.current) select(null);
          } else {
            if (
              tool === "area" &&
              draft.length >= 3 &&
              Math.hypot(p.x - draft[0].x, p.y - draft[0].y) < 12 / view.scale
            ) {
              finish();
              return;
            }
            addPoint({ ...p, role: "standard" });
          }
        }}
        onMouseMove={() => {
          const p = world();
          if (p) {
            setHover(p);
            onPosition(p);
          }
          if (pan.current) {
            const p = stage.current?.getPointerPosition();
            if (p)
              setView({
                ...view,
                x: pan.current.vx + p.x - pan.current.x,
                y: pan.current.vy + p.y - pan.current.y,
              });
          }
        }}
        onMouseUp={() => {
          pan.current = null;
        }}
        onMouseLeave={() => {
          pan.current = null;
          setHover(null);
        }}
      >
        <Layer listening={false}>{lines}</Layer>
        <Layer>
          {[
            ...station.objects.filter((o) => o.type === "area"),
            ...station.objects.filter((o) => o.type !== "area"),
          ].map((original) => {
            const o = preview?.id === original.id ? preview : original;
            return (
              <Group key={o.id} {...handle(o)}>
                {o.type === "area" ? (
                  <Line
                    points={o.vertices.flatMap((p) => [p.x, p.y])}
                    closed
                    fill={colors[o.kind]}
                    stroke={o.id === selected ? "#277d6c" : "#a7afa3"}
                    strokeWidth={o.id === selected ? 2 : 1}
                  />
                ) : (
                  <PathAppearance
                    hitWidth={20 / view.scale}
                    path={o}
                    selected={o.id === selected}
                    edgeSide={(() => {
                      // Direct edge bands toward the nearest platform surface.
                      const platforms = station.objects.filter(
                        (a) => a.type === "area" && a.kind === "platform",
                      );
                      let side = 1,
                        nearest = Infinity;
                      const end = o.segments[0]?.end ?? o.start;
                      for (const area of platforms) {
                        if (area.type !== "area") continue;
                        const c = area.vertices.reduce(
                          (p, v) => ({
                            x: p.x + v.x / area.vertices.length,
                            y: p.y + v.y / area.vertices.length,
                          }),
                          { x: 0, y: 0 },
                        );
                        const d = Math.hypot(c.x - o.start.x, c.y - o.start.y);
                        if (d < nearest) {
                          nearest = d;
                          side =
                            (end.x - o.start.x) * (c.y - o.start.y) -
                              (end.y - o.start.y) * (c.x - o.start.x) >=
                            0
                              ? 1
                              : -1;
                        }
                      }
                      return side;
                    })()}
                  />
                )}
              </Group>
            );
          })}
          {draft.length > 0 && (
            <Group listening={false}>
              {tool === "area" ? (
                <Line
                  points={[...draft, ...(hover ? [hover] : [])].flatMap((p) => [
                    p.x,
                    p.y,
                  ])}
                  closed
                  fill={colors[kind]}
                  opacity={0.65}
                  stroke="#277d6c"
                  strokeWidth={2}
                />
              ) : (
                <>
                  <Path
                    data={pathData({
                      id: "preview",
                      name: "Preview",
                      type: "path",
                      kind: "placeholder",
                      ...draftGeometry([
                        ...draft,
                        ...(hover
                          ? [{ ...hover, role: "standard" as const }]
                          : []),
                      ])!,
                    })}
                    stroke="#277d6c"
                    strokeWidth={4}
                  />
                  <Line
                    points={[...draft, ...(hover ? [hover] : [])].flatMap(
                      (p) => [p.x, p.y],
                    )}
                    stroke="#277d6c"
                    dash={[5, 5]}
                    strokeWidth={1}
                  />
                </>
              )}
              {draft.map((p, i) => (
                <Circle
                  key={i}
                  {...p}
                  radius={4 / view.scale}
                  fill={p.role === "control" ? "#e4b15c" : "white"}
                  stroke="#277d6c"
                />
              ))}
            </Group>
          )}
          {editing && actual?.type === "path" && (
            <EdgeRangeHandles
              track={actual}
              edgeId={editing.edgeId}
              scale={view.scale}
              space={space}
              onPreview={setPreview}
            />
          )}
          {tool === "select" && actual && !editing && (
            <Group>
              {actual.type !== "area" &&
                actual.segments.map((s, i) =>
                  s.type !== "line" ? (
                    <Line
                      key={i}
                      points={[
                        (i === 0 ? actual.start : actual.segments[i - 1].end).x,
                        (i === 0 ? actual.start : actual.segments[i - 1].end).y,
                        ...(s.type === "quadratic"
                          ? [s.control.x, s.control.y]
                          : [
                              s.control1.x,
                              s.control1.y,
                              s.control2.x,
                              s.control2.y,
                            ]),
                        s.end.x,
                        s.end.y,
                      ]}
                      stroke="#469b88"
                      strokeWidth={1 / view.scale}
                      dash={[4, 4]}
                      listening={false}
                    />
                  ) : null,
                )}
              {points(actual).map((p, i) => (
                <Circle
                  key={i}
                  {...p}
                  radius={4.5 / view.scale}
                  fill="white"
                  stroke="#277d6c"
                  strokeWidth={1.5 / view.scale}
                  draggable={!space}
                  onMouseDown={(e) => {
                    if (e.evt.button === 0 && !space) e.cancelBubble = true;
                  }}
                  onDragMove={(e) => {
                    let p = { x: e.target.x(), y: e.target.y() };
                    if (snap)
                      p = {
                        x: Math.round(p.x / 10) * 10,
                        y: Math.round(p.y / 10) * 10,
                      };
                    setPreview(setPoint(actual, i, p));
                  }}
                  onDragEnd={(e) => {
                    const p = snap
                      ? {
                          x: Math.round(e.target.x() / 10) * 10,
                          y: Math.round(e.target.y() / 10) * 10,
                        }
                      : { x: e.target.x(), y: e.target.y() };
                    commit(
                      station.objects.map((o) =>
                        o.id === actual.id ? setPoint(actual, i, p) : o,
                      ),
                    );
                    setPreview(null);
                  }}
                />
              ))}
            </Group>
          )}
        </Layer>
      </Stage>
      <div className="north">
        <span>↑</span>N
      </div>
      <div className="scale-bar">
        <span style={{ width: scaleLength * view.scale }} />
        {scaleLength} m
      </div>
    </div>
  );
}
