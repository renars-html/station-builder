import type { PathObject, Point } from "./station";
// Dimensions are world meters, independent of canvas zoom.
export const trackStyle = {
  gauge: 1.435,
  railWidth: 0.14,
  bedWidth: 3.4,
  sleeperLength: 2.6,
  sleeperWidth: 0.42,
  sleeperPitch: 0.96,
  bed: "#94765b",
  sleeper: "#c6c1b4",
  rail: "#493327",
};
export const edgeBands = [
  { width: 0.2, color: "#f5f4ed" },
  { width: 1, color: "#777b78" },
  { width: 0.9, color: "#f5f4ed" },
  { width: 0.9, color: "#777b78" },
];
const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);
export function flattenPath(path: PathObject): Point[] {
  const result: Point[] = [path.start];
  let start = path.start;
  for (const s of path.segments) {
    if (s.type === "line") {
      if (distance(start, s.end) > 1e-9) result.push(s.end);
    } else {
      const controls =
        s.type === "quadratic"
          ? [start, s.control, s.end]
          : [start, s.control1, s.control2, s.end];
      const length = controls
        .slice(1)
        .reduce((sum, p, i) => sum + distance(controls[i], p), 0);
      const steps = Math.max(2, Math.min(20000, Math.ceil(length / 0.25)));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps,
          u = 1 - t;
        const p =
          s.type === "quadratic"
            ? {
                x: u * u * start.x + 2 * u * t * s.control.x + t * t * s.end.x,
                y: u * u * start.y + 2 * u * t * s.control.y + t * t * s.end.y,
              }
            : {
                x:
                  u * u * u * start.x +
                  3 * u * u * t * s.control1.x +
                  3 * u * t * t * s.control2.x +
                  t * t * t * s.end.x,
                y:
                  u * u * u * start.y +
                  3 * u * u * t * s.control1.y +
                  3 * u * t * t * s.control2.y +
                  t * t * t * s.end.y,
              };
        if (distance(result[result.length - 1], p) > 1e-9) result.push(p);
      }
    }
    start = s.end;
  }
  return result;
}
export function offsetPath(path: Point[], offset: number): Point[] {
  return path.map((p, i) => {
    const a = path[Math.max(0, i - 1)],
      b = path[Math.min(path.length - 1, i + 1)],
      length = distance(a, b);
    return length
      ? {
          x: p.x - ((b.y - a.y) / length) * offset,
          y: p.y + ((b.x - a.x) / length) * offset,
        }
      : p;
  });
}
export function sleepers(path: Point[]): { center: Point; normal: Point }[] {
  const result: { center: Point; normal: Point }[] = [];
  let next = trackStyle.sleeperPitch / 2,
    travelled = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1],
      b = path[i],
      length = distance(a, b);
    if (!length) continue;
    while (next <= travelled + length) {
      const t = (next - travelled) / length;
      result.push({
        center: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t },
        normal: { x: -(b.y - a.y) / length, y: (b.x - a.x) / length },
      });
      next += trackStyle.sleeperPitch;
    }
    travelled += length;
  }
  return result;
}
