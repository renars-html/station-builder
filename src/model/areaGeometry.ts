import type { AreaObject, Point, Segment } from "./station";
import { draftGeometry, type DraftPoint } from "./pathDraft";
// Green's theorem integrated over the exact line/Bezier polynomials.
export function areaSize(area: Pick<AreaObject, "start" | "segments">): number {
  let start = area.start,
    total = 0;
  for (const s of area.segments) {
    const coefficients = (axis: "x" | "y"): number[] => {
      const a = start[axis],
        b = s.end[axis];
      if (s.type === "line") return [a, b - a];
      if (s.type === "quadratic") {
        const c = s.control[axis];
        return [a, 2 * (c - a), a - 2 * c + b];
      }
      const c = s.control1[axis],
        d = s.control2[axis];
      return [a, 3 * (c - a), 3 * (a - 2 * c + d), -a + 3 * c - 3 * d + b];
    };
    const x = coefficients("x"),
      y = coefficients("y");
    for (let i = 0; i < x.length; i++)
      for (let j = 1; j < x.length; j++)
        total += (x[i] * j * y[j] - y[i] * j * x[j]) / (i + j);
    start = s.end;
  }
  return Math.abs(total) / 2;
}
export function areaFromDraft(
  draft: DraftPoint[],
): { start: Point; segments: Segment[] } | null {
  const standards = draft.filter((p) => p.role === "standard");
  if (new Set(standards.map((p) => `${p.x},${p.y}`)).size < 3) return null;
  const first = draft[0];
  if (!first) return null;
  const last = draft.at(-1)!;
  const closed =
    last.role === "standard" && last.x === first.x && last.y === first.y
      ? draft
      : [...draft, first];
  const geometry = draftGeometry(closed);
  return geometry && areaSize(geometry) > 1e-6 ? geometry : null;
}
