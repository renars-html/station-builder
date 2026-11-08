import {
  type PathObject,
  type AreaObject,
  type Point,
  type Segment,
} from "./station";
import type { DraftPoint } from "./pathDraft";
const mix = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});
export function splitSegment<T extends PathObject | AreaObject>(
  path: T,
  index: number,
): T {
  const s = path.segments[index];
  if (!s) return path;
  const a = index ? path.segments[index - 1].end : path.start;
  let replacement: Segment[];
  if (s.type === "line") {
    replacement = [{ type: "line", end: mix(a, s.end, 0.5) }, s];
  } else if (s.type === "quadratic") {
    const x = mix(a, s.control, 0.5),
      y = mix(s.control, s.end, 0.5),
      mid = mix(x, y, 0.5);
    replacement = [
      { type: "quadratic", control: x, end: mid },
      { type: "quadratic", control: y, end: s.end },
    ];
  } else {
    const x = mix(a, s.control1, 0.5),
      y = mix(s.control1, s.control2, 0.5),
      z = mix(s.control2, s.end, 0.5),
      u = mix(x, y, 0.5),
      v = mix(y, z, 0.5),
      mid = mix(u, v, 0.5);
    replacement = [
      { type: "cubic", control1: x, control2: u, end: mid },
      { type: "cubic", control1: v, control2: z, end: s.end },
    ];
  }
  return {
    ...path,
    segments: [
      ...path.segments.slice(0, index),
      ...replacement,
      ...path.segments.slice(index + 1),
    ],
  };
}
export function removeSegment(path: PathObject, index: number): PathObject {
  return path.segments.length <= 1
    ? path
    : { ...path, segments: path.segments.filter((_, i) => i !== index) };
}
export function pathDraft(path: PathObject): DraftPoint[] {
  return [
    { ...path.start, role: "standard" },
    ...path.segments.flatMap((s): DraftPoint[] => [
      ...(s.type === "line"
        ? []
        : s.type === "quadratic"
          ? [{ ...s.control, role: "control" as const }]
          : [
              { ...s.control1, role: "control" as const },
              { ...s.control2, role: "control" as const },
            ]),
      { ...s.end, role: "standard" },
    ]),
  ];
}
