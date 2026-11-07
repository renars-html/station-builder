import { useEffect, useRef, useState } from "react";
import { Stage, Layer, Line, Path, Group, Circle, Text } from "react-konva";
import type Konva from "konva";
import {
  colors,
  pathData,
  points,
  setPoint,
  translate,
  type AreaKind,
  type Point,
  type PathObject,
  type StationObject,
} from "../model/station";
import { useEditor } from "../store/editor";
export interface View {
  x: number;
  y: number;
  scale: number;
}
interface Props {
  grid: boolean;
  snap: boolean;
  curve: boolean;
  kind: AreaKind;
  view: View;
  setView: (v: View) => void;
  draft: Point[];
  setDraft: (p: Point[]) => void;
  finishRef: React.RefObject<(() => void) | null>;
  onPosition: (p: Point) => void;
}
export default function Canvas({
  grid,
  snap,
  curve,
  kind,
  view,
  setView,
  draft,
  setDraft,
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
  const { station, selected, select, tool, commit } = useEditor();
  useEffect(() => {
    const observer = new ResizeObserver((e) => {
      const { width, height } = e[0].contentRect;
      setSize({ width, height });
      if (!initialized.current && width && height) {
        initialized.current = true;
        setView({
          x: 25,
          y: 90,
          scale: Math.max(
            0.15,
            Math.min(1, (width - 70) / 1100, (height - 130) / 650),
          ),
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
  const modes = useRef<Record<number, boolean>>({});
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
  function makePath(p: Point[]): PathObject {
    const segments: PathObject["segments"] = [];
    let i = 1;
    while (i < p.length) {
      if ((modes.current[i] ?? curve) && i + 2 < p.length) {
        segments.push({
          type: "cubic",
          control1: p[i],
          control2: p[i + 1],
          end: p[i + 2],
        });
        i += 3;
      } else if (!(modes.current[i] ?? curve)) {
        segments.push({ type: "line", end: p[i] });
        i++;
      } else break;
    }
    return {
      id: crypto.randomUUID(),
      name: tool === "edge" ? "Platform edge" : "Track",
      type: tool === "edge" ? "edge" : "track",
      start: p[0],
      segments,
    };
  }
  const finish = () => {
    if (tool === "area" && draft.length >= 3) {
      const o: StationObject = {
        id: crypto.randomUUID(),
        name: kind[0].toUpperCase() + kind.slice(1) + " area",
        type: "area",
        kind,
        vertices: draft,
      };
      commit([...station.objects, o]);
      select(o.id);
      setDraft([]);
    } else if ((tool === "track" || tool === "edge") && draft.length > 1) {
      const o = makePath(draft);
      if (o.segments.length) {
        commit([...station.objects, o]);
        select(o.id);
        setDraft([]);
      }
    }
  };
  finishRef.current = finish;
  const active = station.objects.find((o) => o.id === selected);
  const actual = preview ?? active;
  const handle = (o: StationObject) => ({
    onClick: (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (tool === "select" && !space) {
        e.cancelBubble = true;
        select(o.id);
      }
    },
    draggable: tool === "select" && !space,
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
  const lowX = Math.floor(-view.x / view.scale / 20) * 20,
    lowY = Math.floor(-view.y / view.scale / 20) * 20;
  const highX = (size.width - view.x) / view.scale,
    highY = (size.height - view.y) / view.scale;
  const lines = [];
  if (grid) {
    for (let x = lowX; x < highX; x += 20)
      lines.push(
        <Line
          key={"x" + x}
          points={[x, lowY, x, highY]}
          stroke={x % 100 === 0 ? "#ccd2cb" : "#e0e4dd"}
          strokeWidth={1 / view.scale}
        />,
      );
    for (let y = lowY; y < highY; y += 20)
      lines.push(
        <Line
          key={"y" + y}
          points={[lowX, y, highX, y]}
          stroke={y % 100 === 0 ? "#ccd2cb" : "#e0e4dd"}
          strokeWidth={1 / view.scale}
        />,
      );
  }
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
            0.15,
            Math.min(4, view.scale * (e.evt.deltaY < 0 ? 1.1 : 1 / 1.1)),
          );
          setView({
            scale,
            x: p.x - ((p.x - view.x) / view.scale) * scale,
            y: p.y - ((p.y - view.y) / view.scale) * scale,
          });
        }}
        onMouseDown={(e) => {
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
            if (draft.length === 0) modes.current = {};
            let next = 1;
            while (next < draft.length) {
              const c = modes.current[next] ?? curve;
              if (c && next + 2 >= draft.length) break;
              next += c ? 3 : 1;
            }
            if (next === draft.length) modes.current[next] = curve;
            setDraft([...draft, p]);
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
                  <>
                    {o.id === selected && (
                      <Path
                        data={pathData(o)}
                        stroke="#54a58e"
                        opacity={0.25}
                        strokeWidth={22}
                      />
                    )}
                    <Path
                      data={pathData(o)}
                      stroke={o.type === "track" ? "#737f79" : "#ba8d43"}
                      strokeWidth={o.type === "track" ? 14 : 5}
                      hitStrokeWidth={20}
                    />
                    {o.type === "track" && (
                      <>
                        <Path
                          data={pathData(o)}
                          stroke="#dce0d7"
                          strokeWidth={10}
                        />
                        <Path
                          data={pathData(o)}
                          stroke="#6c7770"
                          strokeWidth={13}
                          dash={[2, 8]}
                        />
                        <Path
                          data={pathData(o)}
                          stroke="#e9ece5"
                          strokeWidth={6}
                        />
                      </>
                    )}
                    {o.type === "edge" && (
                      <Path
                        data={pathData(o)}
                        stroke="#fff3c9"
                        strokeWidth={2}
                        dash={[4, 4]}
                      />
                    )}
                  </>
                )}
                {o.type === "area" && o.kind === "platform" && (
                  <Text
                    x={o.vertices[0].x + 24}
                    y={o.vertices[0].y + 20}
                    text={o.name.toUpperCase()}
                    fontSize={10}
                    letterSpacing={2}
                    fill="#8d8b7d"
                    listening={false}
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
                    data={pathData(
                      makePath([...draft, ...(hover ? [hover] : [])]),
                    )}
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
                  fill="white"
                  stroke="#277d6c"
                />
              ))}
            </Group>
          )}
          {tool === "select" && actual && (
            <Group>
              {actual.type !== "area" &&
                actual.segments.map((s, i) =>
                  s.type === "cubic" ? (
                    <Line
                      key={i}
                      points={[
                        (i === 0 ? actual.start : actual.segments[i - 1].end).x,
                        (i === 0 ? actual.start : actual.segments[i - 1].end).y,
                        s.control1.x,
                        s.control1.y,
                        s.control2.x,
                        s.control2.y,
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
                  draggable
                  onMouseDown={(e) => {
                    e.cancelBubble = true;
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
        <span style={{ width: 100 * view.scale }} />
        100 m
      </div>
    </div>
  );
}
