import type { Point, TrackPlatformEdge } from "./station";
import { edgeBands, offsetPath, trackStyle } from "./pathAppearance";
const length = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);
export const polylineLength = (ps: Point[]) =>
  ps.slice(1).reduce((sum, p, i) => sum + length(ps[i], p), 0);
export function pointAlong(ps: Point[], fraction: number): Point {
  const total = polylineLength(ps);
  let remaining = Math.max(0, Math.min(1, fraction)) * total;
  for (let i = 1; i < ps.length; i++) {
    const d = length(ps[i - 1], ps[i]);
    if (d > 0 && remaining <= d) {
      const t = remaining / d;
      return {
        x: ps[i - 1].x + (ps[i].x - ps[i - 1].x) * t,
        y: ps[i - 1].y + (ps[i].y - ps[i - 1].y) * t,
      };
    }
    remaining -= d;
  }
  return ps.at(-1) ?? { x: 0, y: 0 };
}
export function projectAlong(ps: Point[], p: Point): number {
  const total = polylineLength(ps);
  if (!total) return 0;
  let travelled = 0,
    best = Infinity,
    result = 0;
  for (let i = 1; i < ps.length; i++) {
    const a = ps[i - 1],
      b = ps[i],
      dx = b.x - a.x,
      dy = b.y - a.y,
      d = Math.hypot(dx, dy);
    if (!d) continue;
    const t = Math.max(
      0,
      Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (d * d)),
    );
    const distance = Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
    if (distance < best) {
      best = distance;
      result = (travelled + t * d) / total;
    }
    travelled += d;
  }
  return result;
}
export function sliceAlong(ps: Point[], start: number, end: number): Point[] {
  const total = polylineLength(ps);
  if (!total || end <= start) return [];
  const result = [pointAlong(ps, start)];
  let travelled = 0;
  for (let i = 1; i < ps.length; i++) {
    travelled += length(ps[i - 1], ps[i]);
    if (travelled > start * total && travelled < end * total)
      result.push(ps[i]);
  }
  result.push(pointAlong(ps, end));
  return result;
}
export function platformBands(center: Point[], side: number, offset = 0) {
  let distance = offset;
  return edgeBands.map((b) => {
    const a = offsetPath(center, distance * side);
    distance += b.width;
    return {
      color: b.color,
      points: [...a, ...offsetPath(center, distance * side).reverse()].flatMap(
        (p) => [p.x, p.y],
      ),
    };
  });
}
export function attachedBands(center: Point[], edge: TrackPlatformEdge) {
  return platformBands(
    sliceAlong(center, edge.start, edge.end),
    edge.side === "right" ? 1 : -1,
    trackStyle.bedWidth / 2 + edge.distance,
  );
}
