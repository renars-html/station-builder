import type { Point, Segment } from "./station";
export interface DraftPoint extends Point {
  role: "standard" | "control";
}
export function canAddControl(draft: DraftPoint[]): boolean {
  if (!draft.length) return false;
  let count = 0;
  for (let i = draft.length - 1; i >= 0 && draft[i].role === "control"; i--)
    count++;
  return count < 2;
}
export function draftGeometry(
  draft: DraftPoint[],
): { start: Point; segments: Segment[] } | null {
  if (!draft.length || draft[0].role !== "standard") return null;
  const point = ({ x, y }: Point): Point => ({ x, y });
  const segments: Segment[] = [];
  let controls: Point[] = [];
  for (const p of draft.slice(1)) {
    if (p.role === "control") {
      controls.push(point(p));
      continue;
    }
    if (controls.length === 0) segments.push({ type: "line", end: point(p) });
    else if (controls.length === 1)
      segments.push({ type: "quadratic", control: controls[0], end: point(p) });
    else if (controls.length === 2)
      segments.push({
        type: "cubic",
        control1: controls[0],
        control2: controls[1],
        end: point(p),
      });
    controls = [];
  }
  return { start: point(draft[0]), segments };
}
