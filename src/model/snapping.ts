import {
  points,
  type Point,
  type StationObject,
  type Segment,
} from "./station";
import {
  flattenPath,
  offsetPath,
  edgeBands,
  trackStyle,
} from "./pathAppearance";
import { sliceAlong } from "./trackPlatform";
import { edgeSideFor } from "./renderPlan";
import { closestOnSegment } from "./curveProjection";
export interface SnapResult {
  point: Point;
  kind: "anchor" | "boundary" | "grid";
  objectId?: string;
  label?: string;
}
interface SnapOptions {
  z?: number;
  excludeIds?: string[];
  grid?: boolean;
}
interface Anchor {
  point: Point;
  index: number;
}
interface Boundary {
  start: Point;
  segment: Segment;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}
interface Geometry {
  anchors: Anchor[];
  boundaries: Boundary[];
  attached: Boundary[];
}
const cache = new WeakMap<StationObject, Geometry>();
function boundaries(start: Point, segments: Segment[]): Boundary[] {
  return segments.map((segment) => {
    const controls =
      segment.type === "line"
        ? []
        : segment.type === "quadratic"
          ? [segment.control]
          : [segment.control1, segment.control2];
    const ps = [start, ...controls, segment.end],
      result = {
        start,
        segment,
        minX: Math.min(...ps.map((p) => p.x)),
        maxX: Math.max(...ps.map((p) => p.x)),
        minY: Math.min(...ps.map((p) => p.y)),
        maxY: Math.max(...ps.map((p) => p.y)),
      };
    start = segment.end;
    return result;
  });
}
const polyline = (ps: Point[]) =>
  ps.length
    ? boundaries(
        ps[0],
        ps.slice(1).map((end) => ({ type: "line", end })),
      )
    : [];
function geometry(object: StationObject): Geometry {
  const saved = cache.get(object);
  if (saved) return saved;
  const ps = points(object),
    anchors: Anchor[] = [{ point: object.start, index: 0 }];
  let index = 1;
  for (let i = 0; i < object.segments.length; i++) {
    const s = object.segments[i];
    index += s.type === "line" ? 0 : s.type === "quadratic" ? 1 : 2;
    if (index < ps.length) anchors.push({ point: s.end, index });
    index++;
  }
  const attached: Boundary[] = [];
  if (
    object.type === "path" &&
    object.kind === "track" &&
    object.platformEdges?.length
  ) {
    const center = flattenPath(object),
      width = edgeBands.reduce((sum, b) => sum + b.width, 0);
    for (const edge of object.platformEdges) {
      const section = sliceAlong(center, edge.start, edge.end),
        side = edge.side === "right" ? 1 : -1;
      for (const offset of [
        trackStyle.bedWidth / 2 + edge.distance,
        trackStyle.bedWidth / 2 + edge.distance + width,
      ])
        attached.push(...polyline(offsetPath(section, side * offset)));
    }
  }
  const result = {
    anchors,
    boundaries: boundaries(object.start, object.segments),
    attached,
  };
  cache.set(object, result);
  return result;
}
function eligible(object: StationObject, options: SnapOptions): boolean {
  return (
    !object.hidden &&
    !options.excludeIds?.includes(object.id) &&
    (options.z === undefined || (object.z ?? 0) === options.z)
  );
}
export function resolveSnap(
  p: Point,
  objects: StationObject[],
  scale: number,
  excludeObjectId?: string,
  excludePointIndex?: number,
  options?: SnapOptions & { grid?: true },
): SnapResult;
export function resolveSnap(
  p: Point,
  objects: StationObject[],
  scale: number,
  excludeObjectId: string | undefined,
  excludePointIndex: number | undefined,
  options: SnapOptions & { grid: false },
): SnapResult | null;
export function resolveSnap(
  p: Point,
  objects: StationObject[],
  scale: number,
  excludeObjectId?: string,
  excludePointIndex?: number,
  options: SnapOptions = {},
): SnapResult | null {
  const tolerance = 10 / scale;
  let best = tolerance,
    result: SnapResult | null = null;
  for (const object of objects) {
    if (!eligible(object, options)) continue;
    for (const anchor of geometry(object).anchors) {
      if (object.id === excludeObjectId && anchor.index === excludePointIndex)
        continue;
      const d = Math.hypot(p.x - anchor.point.x, p.y - anchor.point.y);
      if (d < best || (!result && d === best)) {
        best = d;
        result = {
          point: { ...anchor.point },
          kind: "anchor",
          objectId: object.id,
          label: `${object.type === "area" ? "Area" : "Path"} anchor · ${object.name}`,
        };
      }
    }
  }
  if (result) return result;
  best = tolerance;
  for (const object of objects) {
    if (!eligible(object, options) || object.id === excludeObjectId) continue;
    const g = geometry(object);
    const sets: { items: Boundary[]; label: string }[] = [
      {
        items: g.boundaries,
        label: object.type === "area" ? "Area boundary" : "Path",
      },
      { items: g.attached, label: "Attached platform edge" },
    ];
    if (object.type === "path" && object.kind === "edge") {
      const width = edgeBands.reduce((sum, b) => sum + b.width, 0);
      sets.push({
        items: polyline(
          offsetPath(flattenPath(object), edgeSideFor(object, objects) * width),
        ),
        label: "Platform edge boundary",
      });
    }
    for (const set of sets)
      for (const boundary of set.items) {
        const dx = Math.max(boundary.minX - p.x, 0, p.x - boundary.maxX),
          dy = Math.max(boundary.minY - p.y, 0, p.y - boundary.maxY);
        if (Math.hypot(dx, dy) > best) continue;
        const hit = closestOnSegment(boundary.start, boundary.segment, p);
        if (hit.distance < best || (!result && hit.distance === best)) {
          best = hit.distance;
          result = {
            point: hit.point,
            kind: "boundary",
            objectId: object.id,
            label: `${set.label} · ${object.name}`,
          };
        }
      }
  }
  if (result) return result;
  return options.grid === false
    ? null
    : {
        point: { x: Math.round(p.x / 10) * 10, y: Math.round(p.y / 10) * 10 },
        kind: "grid",
        label: "Grid · 10 m",
      };
}
// Apply one translation to the entire selection: snap an anchor, never distort
// individual points. Every source anchor only considers targets at its own Z.
export function snapTranslation(
  objects: StationObject[],
  ids: string[],
  delta: Point,
  scale: number,
): { delta: Point; target: SnapResult | null } {
  const sources = objects.filter(
    (o) => ids.includes(o.id) && !o.locked && !o.hidden,
  );
  let best = Infinity,
    chosen: SnapResult | null = null,
    correction = { x: 0, y: 0 };
  for (const source of sources)
    for (const anchor of geometry(source).anchors) {
      const proposed = {
          x: anchor.point.x + delta.x,
          y: anchor.point.y + delta.y,
        },
        target = resolveSnap(proposed, objects, scale, undefined, undefined, {
          z: source.z ?? 0,
          excludeIds: ids,
          grid: false,
        });
      if (!target) continue;
      const d = Math.hypot(
          target.point.x - proposed.x,
          target.point.y - proposed.y,
        ),
        priority = target.kind === "anchor" ? 0 : 1,
        currentPriority = chosen?.kind === "anchor" ? 0 : 1;
      if (
        (chosen && priority < currentPriority) ||
        !chosen ||
        (priority === currentPriority && d < best)
      ) {
        best = d;
        chosen = target;
        correction = {
          x: target.point.x - proposed.x,
          y: target.point.y - proposed.y,
        };
      }
    }
  if (!chosen && sources.length) {
    const start = sources[0].start,
      proposed = { x: start.x + delta.x, y: start.y + delta.y },
      grid = {
        x: Math.round(proposed.x / 10) * 10,
        y: Math.round(proposed.y / 10) * 10,
      };
    chosen = { point: grid, kind: "grid", label: "Grid · 10 m" };
    correction = { x: grid.x - proposed.x, y: grid.y - proposed.y };
  }
  return {
    delta: { x: delta.x + correction.x, y: delta.y + correction.y },
    target: chosen,
  };
}
