import { transformSelection, boxSelection } from "../model/selection";
import { renderPlan, edgeSideFor } from "../model/renderPlan";
import ObjectHitShape from "./ObjectHitShape";
import {
  resolveSnap,
  snapTranslation,
  type SnapResult,
} from "../model/snapping";
import EdgeRangeHandles from "./EdgeRangeHandles";
import type { EdgeEditing } from "./TrackPlatformProperties";
import { useEffect, useRef, useState } from "react";
import { Stage, Layer, Line, Path, Group, Circle, Rect } from "react-konva";
import Konva from "konva";
import {
  colors,
  pathData,
  points,
  setPoint,
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
  fitRequest: number;
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
  fitRequest,
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
  const [snapTarget, setSnapTarget] = useState<SnapResult | null>(null);
  const [hover, setHover] = useState<Point | null>(null);
  const [preview, setPreview] = useState<StationObject | null>(null);
  const pan = useRef<{ x: number; y: number; vx: number; vy: number } | null>(
    null,
  );
  const [space, setSpace] = useState(false);
  const [movePreview, setMovePreview] = useState<Record<string, StationObject>>(
    {},
  );
  const [box, setBox] = useState<{ start: Point; end: Point } | null>(null);
  const boxStart = useRef<Point | null>(null);
  const drag = useRef<{
    station: typeof station;
    ids: string[];
    node: Konva.Node;
  } | null>(null);

  const {
    station,
    selected,
    selection,
    selectMany,
    select,
    tool,
    commit,
    draft,
    addPoint,
    removeLastPoint,
    finishPath,
    editingObjectId,
    finishArea,
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
    if (!fitRequest) return;
    initialized.current = true;
    const ps = useEditor.getState().station.objects.flatMap(points);
    if (!ps.length) {
      setView({ x: size.width / 2, y: size.height / 2, scale: BASE_SCALE });
      return;
    }
    const minX = Math.min(...ps.map((p) => p.x)),
      minY = Math.min(...ps.map((p) => p.y)),
      w = Math.max(...ps.map((p) => p.x)) - minX,
      h = Math.max(...ps.map((p) => p.y)) - minY;
    const scale = Math.max(
      MIN_SCALE,
      Math.min(
        BASE_SCALE,
        (size.width - 100) / Math.max(w, 1),
        (size.height - 100) / Math.max(h, 1),
      ),
    );
    setView({
      scale,
      x: (size.width - w * scale) / 2 - minX * scale,
      y: (size.height - h * scale) / 2 - minY * scale,
    });
  }, [fitRequest]);
  useEffect(() => {
    setPreview(null);
    setMovePreview({});
  }, [station, selected, tool]);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (
        e.code === "Space" &&
        !(e.target instanceof HTMLButtonElement) &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLSelectElement) &&
        !(e.target instanceof HTMLTextAreaElement) &&
        !(e.target instanceof HTMLElement && e.target.isContentEditable)
      ) {
        e.preventDefault();
        setSpace(true);
      }
    };
    const up = (e: KeyboardEvent | FocusEvent) => {
      if (e.type === "keyup" && (e as KeyboardEvent).code !== "Space") return;
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

  useEffect(() => {
    const cancel = (e: KeyboardEvent | FocusEvent) => {
      if (e.type === "keydown" && (e as KeyboardEvent).key !== "Escape") return;
      const node = drag.current?.node;
      drag.current = null;
      setPreview(null);
      setMovePreview({});
      setBox(null);
      setSnapTarget(null);
      boxStart.current = null;
      if (node?.isDragging()) node.stopDrag();
    };
    window.addEventListener("keydown", cancel);
    window.addEventListener("blur", cancel);
    return () => {
      window.removeEventListener("keydown", cancel);
      window.removeEventListener("blur", cancel);
    };
  }, []);
  const rawWorld = () => {
    const p = stage.current?.getPointerPosition();
    return p
      ? { x: (p.x - view.x) / view.scale, y: (p.y - view.y) / view.scale }
      : null;
  };
  const world = (bypass = false) => {
    const p = stage.current?.getPointerPosition();
    if (!p) return null;
    const v = {
      x: (p.x - view.x) / view.scale,
      y: (p.y - view.y) / view.scale,
    };
    if (!snap || bypass) {
      setSnapTarget(null);
      return v;
    }
    const source = station.objects.find((o) => o.id === editingObjectId);
    const target = resolveSnap(
      v,
      station.objects,
      view.scale,
      editingObjectId ?? undefined,
      undefined,
      { z: source?.z ?? 0 },
    );
    setSnapTarget(target);
    return target.point;
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        (tool !== "path" && tool !== "area") ||
        e.key.toLowerCase() !== "e" ||
        e.repeat ||
        e.ctrlKey ||
        e.metaKey ||
        space ||
        !hover ||
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLSelectElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      )
        return;
      e.preventDefault();
      const position = world(e.altKey);
      if (position) addPoint({ ...position, role: "control" });
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [tool, hover, space, addPoint, snap, view, station, editingObjectId]);
  const finish = () => {
    if (tool === "area") {
      finishArea(kind);
    } else if (tool === "path") {
      finishPath();
    }
  };
  finishRef.current = finish;
  const active = station.objects.find((o) => o.id === selected);
  const actual =
    preview ?? (selected ? movePreview[selected] : undefined) ?? active;
  const editing =
    tool === "select" &&
    actual?.type === "path" &&
    actual.kind === "track" &&
    !actual.locked &&
    !actual.hidden &&
    selection.length <= 1 &&
    editingEdge?.pathId === actual.id &&
    actual.platformEdges?.some((e) => e.id === editingEdge.edgeId)
      ? editingEdge
      : null;
  const handle = (o: StationObject) => ({
    onClick: (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (tool === "select" && !space && e.evt.button === 0) {
        e.cancelBubble = true;
        select(o.id, e.evt.shiftKey);
      }
    },
    draggable:
      tool === "select" &&
      !space &&
      !o.locked &&
      !o.hidden &&
      !(editing && o.id === selected),
    onDragStart: (e: Konva.KonvaEventObject<DragEvent>) => {
      const s = useEditor.getState();
      if (!s.selection.includes(o.id)) s.select(o.id, e.evt.shiftKey);
      drag.current = {
        station: s.station,
        ids: useEditor.getState().selection,
        node: e.target,
      };
    },
    onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => {
      const base = drag.current;
      if (!base || base.station !== useEditor.getState().station) return;
      const raw = { x: e.target.x(), y: e.target.y() };
      const resolved =
        snap && !e.evt.altKey
          ? snapTranslation(base.station.objects, base.ids, raw, view.scale)
          : { delta: raw, target: null };
      setSnapTarget(resolved.target);
      const moved = transformSelection(
        base.station.objects,
        base.ids,
        resolved.delta,
      );
      setMovePreview(
        Object.fromEntries(
          moved.filter((o) => base.ids.includes(o.id)).map((o) => [o.id, o]),
        ),
      );
    },
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
      const base = drag.current,
        dx = e.target.x(),
        dy = e.target.y();
      drag.current = null;
      e.target.position({ x: 0, y: 0 });
      setMovePreview({});
      if (!base || base.station !== useEditor.getState().station) return;
      const raw = { x: dx, y: dy },
        resolved =
          snap && !e.evt.altKey
            ? snapTranslation(base.station.objects, base.ids, raw, view.scale)
            : { delta: raw, target: null };
      setSnapTarget(null);
      commit(
        transformSelection(base.station.objects, base.ids, resolved.delta),
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
          const p = world(e.evt.altKey);
          if (!p) return;
          if (tool === "select") {
            if (e.target === stage.current) {
              if (!e.evt.shiftKey) select(null);
              const start = rawWorld();
              if (start) {
                boxStart.current = start;
                setBox({ start, end: start });
              }
            }
          } else {
            if (
              tool === "area" &&
              draft.filter((p) => p.role === "standard").length >= 3 &&
              Math.hypot(p.x - draft[0].x, p.y - draft[0].y) < 12 / view.scale
            ) {
              finish();
              return;
            }
            addPoint({ ...p, role: "standard" });
          }
        }}
        onMouseMove={(e) => {
          if (boxStart.current) {
            const end = rawWorld();
            if (end) setBox({ start: boxStart.current, end });
          }
          const p = drag.current ? rawWorld() : world(e.evt.altKey);
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
        onMouseUp={(e) => {
          if (boxStart.current && e.evt.button === 0) {
            const end = rawWorld(),
              start = boxStart.current;
            if (
              end &&
              Math.hypot(end.x - start.x, end.y - start.y) > 3 / view.scale
            ) {
              const ids = boxSelection(station.objects, start, end);
              selectMany(
                e.evt.shiftKey ? [...new Set([...selection, ...ids])] : ids,
              );
            }
            boxStart.current = null;
            setBox(null);
          }
          pan.current = null;
        }}
        onMouseLeave={() => {
          pan.current = null;
          setHover(null);
          setSnapTarget(null);
          boxStart.current = null;
          setBox(null);
        }}
      >
        <Layer listening={false}>{lines}</Layer>
        <Layer>
          {renderPlan(station.objects).map(({ object: original, material }) => {
            const o =
              movePreview[original.id] ??
              (preview?.id === original.id ? preview : original);
            return (
              <Group key={original.id + material} listening={false}>
                {o.type === "area" ? (
                  <Path
                    data={pathData(o) + " Z"}
                    fill={colors[o.kind]}
                    stroke={selection.includes(o.id) ? "#277d6c" : "#a7afa3"}
                    strokeWidth={(o.id === selected ? 2 : 1) / view.scale}
                  />
                ) : (
                  <PathAppearance
                    material={material}
                    hitWidth={20 / view.scale}
                    path={o}
                    selected={selection.includes(o.id)}
                    edgeSide={edgeSideFor(o, station.objects)}
                  />
                )}
              </Group>
            );
          })}
          {renderPlan(station.objects)
            .filter((item) => item.material !== "sleepers")
            .map(({ object, material }) => (
              <Group key={"hit" + object.id + material} {...handle(object)}>
                <ObjectHitShape
                  object={object}
                  scale={view.scale}
                  material={material}
                  edgeSide={edgeSideFor(object, station.objects)}
                />
              </Group>
            ))}
          {draft.length > 0 && (
            <Group listening={false}>
              {tool === "area" ? (
                <Path
                  data={
                    pathData({
                      start: draft[0],
                      segments: draftGeometry([
                        ...draft,
                        ...(hover
                          ? [{ ...hover, role: "standard" as const }]
                          : []),
                        draft[0],
                      ])!.segments,
                    }) + " Z"
                  }
                  fill={colors[kind]}
                  opacity={0.65}
                  stroke="#277d6c"
                  strokeWidth={2 / view.scale}
                />
              ) : (
                <>
                  <Path
                    data={pathData({
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
          {tool === "select" &&
            actual &&
            !actual.locked &&
            !actual.hidden &&
            selection.length <= 1 &&
            !editing && (
              <Group>
                {actual.segments.map((s, i) =>
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
                    onDragStart={(e) => {
                      drag.current = {
                        station: useEditor.getState().station,
                        ids: [actual.id],
                        node: e.target,
                      };
                    }}
                    onDragMove={(e) => {
                      if (
                        !drag.current ||
                        drag.current.station !== useEditor.getState().station
                      )
                        return;
                      let p = { x: e.target.x(), y: e.target.y() };
                      if (snap && !e.evt.altKey) {
                        const target = resolveSnap(
                          p,
                          station.objects,
                          view.scale,
                          actual.id,
                          i,
                          { z: actual.z ?? 0 },
                        );
                        p = target.point;
                        setSnapTarget(target);
                        e.target.position(p);
                      } else setSnapTarget(null);
                      setPreview(setPoint(actual, i, p));
                    }}
                    onDragEnd={(e) => {
                      const base = drag.current;
                      drag.current = null;
                      if (
                        !base ||
                        base.station !== useEditor.getState().station
                      ) {
                        setPreview(null);
                        return;
                      }
                      const raw = { x: e.target.x(), y: e.target.y() };
                      const p =
                        snap && !e.evt.altKey
                          ? resolveSnap(
                              raw,
                              station.objects,
                              view.scale,
                              actual.id,
                              i,
                              { z: actual.z ?? 0 },
                            ).point
                          : raw;
                      setSnapTarget(null);
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
          {box && (
            <Rect
              x={Math.min(box.start.x, box.end.x)}
              y={Math.min(box.start.y, box.end.y)}
              width={Math.abs(box.end.x - box.start.x)}
              height={Math.abs(box.end.y - box.start.y)}
              stroke="#277d6c"
              fill="#277d6c22"
              strokeWidth={1 / view.scale}
              listening={false}
            />
          )}
          {snap && snapTarget && (
            <Circle
              {...snapTarget.point}
              radius={7 / view.scale}
              stroke={snapTarget.kind === "grid" ? "#8b9680" : "#ca8738"}
              strokeWidth={2 / view.scale}
              listening={false}
            />
          )}
        </Layer>
      </Stage>
      {snap && snapTarget && (
        <div className="snap-label" role="status">
          {snapTarget.label ?? snapTarget.kind} · Alt bypasses snapping
        </div>
      )}
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
