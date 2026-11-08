import { points, type Point, type StationObject } from "./station";
import { flattenPath } from "./pathAppearance";
import { pointAlong, projectAlong } from "./trackPlatform";
export interface SnapResult {
  point: Point;
  kind: "anchor" | "boundary" | "grid";
}
export function resolveSnap(
  p: Point,
  objects: StationObject[],
  scale: number,
  excludeObjectId?: string,
  excludePointIndex?: number,
): SnapResult {
  const tolerance = 10 / scale;
  let best = tolerance,
    anchor: Point | undefined;
  for (const object of objects) {
    const ps = points(object);
    let n = 0;
    const controls = new Set<number>();
    {
      n = 1;
      for (const s of object.segments) {
        if (s.type === "quadratic") controls.add(n++);
        if (s.type === "cubic") {
          controls.add(n++);
          controls.add(n++);
        }
        n++;
      }
    }
    ps.forEach((a, i) => {
      if (
        controls.has(i) ||
        (object.id === excludeObjectId && i === excludePointIndex)
      )
        return;
      const d = Math.hypot(a.x - p.x, a.y - p.y);
      if (d <= best) {
        best = d;
        anchor = a;
      }
    });
  }
  if (anchor) return { point: { ...anchor }, kind: "anchor" };
  best = tolerance;
  let boundary: Point | undefined;
  for (const object of objects) {
    if (object.id === excludeObjectId) continue;
    const line = flattenPath(object);
    const q = pointAlong(line, projectAlong(line, p));
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d <= best) {
      best = d;
      boundary = q;
    }
  }
  if (boundary) return { point: boundary, kind: "boundary" };
  return {
    point: { x: Math.round(p.x / 10) * 10, y: Math.round(p.y / 10) * 10 },
    kind: "grid",
  };
}
