import type { Point, Segment } from "./station";
export function segmentPoint(start: Point, s: Segment, t: number): Point {
  const u = 1 - t;
  if (s.type === "line")
    return { x: u * start.x + t * s.end.x, y: u * start.y + t * s.end.y };
  if (s.type === "quadratic")
    return {
      x: u * u * start.x + 2 * u * t * s.control.x + t * t * s.end.x,
      y: u * u * start.y + 2 * u * t * s.control.y + t * t * s.end.y,
    };
  return {
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
}
const evaluate = (polynomial: number[], t: number) =>
  polynomial.reduceRight((sum, value) => sum * t + value, 0);
// Isolate roots on monotone intervals between derivative roots. This also
// considers repeated roots, which a simple sign-change/sample scan can miss.
function unitRoots(input: number[]): number[] {
  const p = [...input],
    scale = Math.max(...p.map(Math.abs));
  if (!scale) return [];
  while (p.length > 1 && Math.abs(p.at(-1)!) < scale * 1e-14) p.pop();
  if (p.length === 1) return [];
  if (p.length === 2) {
    const t = -p[0] / p[1];
    return t >= 0 && t <= 1 ? [t] : [];
  }
  const critical = unitRoots(p.slice(1).map((v, i) => v * (i + 1))),
    bounds = [0, ...critical, 1];
  const roots = bounds.filter((t) => Math.abs(evaluate(p, t)) < scale * 1e-12);
  for (let i = 1; i < bounds.length; i++) {
    let a = bounds[i - 1],
      b = bounds[i],
      fa = evaluate(p, a);
    if (fa * evaluate(p, b) >= 0) continue;
    for (let n = 0; n < 55; n++) {
      const mid = (a + b) / 2,
        fm = evaluate(p, mid);
      if (fa * fm <= 0) b = mid;
      else {
        a = mid;
        fa = fm;
      }
    }
    roots.push((a + b) / 2);
  }
  return roots
    .sort((a, b) => a - b)
    .filter((t, i, all) => !i || t - all[i - 1] > 1e-10);
}
export function closestOnSegment(
  start: Point,
  s: Segment,
  p: Point,
): { point: Point; t: number; distance: number } {
  const distance = (q: Point) => Math.hypot(q.x - p.x, q.y - p.y);
  if (s.type === "line") {
    const dx = s.end.x - start.x,
      dy = s.end.y - start.y,
      l = dx * dx + dy * dy,
      t = l
        ? Math.max(
            0,
            Math.min(1, ((p.x - start.x) * dx + (p.y - start.y) * dy) / l),
          )
        : 0;
    const point = segmentPoint(start, s, t);
    return { point, t, distance: distance(point) };
  }
  const coefficients = (axis: "x" | "y") => {
    const a = start[axis],
      b = s.end[axis];
    if (s.type === "quadratic") {
      const c = s.control[axis];
      return [a - p[axis], 2 * (c - a), a - 2 * c + b];
    }
    const c = s.control1[axis],
      d = s.control2[axis];
    return [
      a - p[axis],
      3 * (c - a),
      3 * (a - 2 * c + d),
      -a + 3 * c - 3 * d + b,
    ];
  };
  const x = coefficients("x"),
    y = coefficients("y"),
    polynomial = new Array<number>(x.length * 2 - 2).fill(0);
  for (let i = 0; i < x.length; i++)
    for (let j = 1; j < x.length; j++)
      polynomial[i + j - 1] += x[i] * j * x[j] + y[i] * j * y[j];
  let result = { point: start, t: 0, distance: distance(start) };
  for (const t of [...unitRoots(polynomial), 1]) {
    const point = segmentPoint(start, s, t),
      d = distance(point);
    if (d < result.distance) result = { point, t, distance: d };
  }
  return result;
}
