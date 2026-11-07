export interface Point {
  x: number;
  y: number;
}
export type Segment =
  | { type: "line"; end: Point }
  | { type: "quadratic"; control: Point; end: Point }
  | { type: "cubic"; control1: Point; control2: Point; end: Point };
export type AreaKind = "platform" | "grass" | "road" | "other";
interface Base {
  id: string;
  name: string;
}
// Add future path kinds here; geometry remains independent of its use.
export const pathKinds = {
  placeholder: "Placeholder",
  track: "Track",
  edge: "Platform edge",
} as const;
export type PathKind = keyof typeof pathKinds;
export interface PathObject extends Base {
  type: "path";
  kind: PathKind;
  start: Point;
  segments: Segment[];
}
export interface AreaObject extends Base {
  type: "area";
  kind: AreaKind;
  vertices: Point[];
}
export type StationObject = PathObject | AreaObject;
export interface Station {
  version: 1;
  objects: StationObject[];
}
export const colors: Record<AreaKind, string> = {
  platform: "#dfdace",
  grass: "#c0d2b6",
  road: "#bfc4c2",
  other: "#d6c9b5",
};
export function pathData(o: PathObject): string {
  return (
    `M ${o.start.x} ${o.start.y} ` +
    o.segments
      .map((s) =>
        s.type === "line"
          ? `L ${s.end.x} ${s.end.y}`
          : s.type === "quadratic"
            ? `Q ${s.control.x} ${s.control.y} ${s.end.x} ${s.end.y}`
            : `C ${s.control1.x} ${s.control1.y} ${s.control2.x} ${s.control2.y} ${s.end.x} ${s.end.y}`,
      )
      .join(" ")
  );
}
export function points(o: StationObject): Point[] {
  return o.type === "area"
    ? o.vertices
    : [
        o.start,
        ...o.segments.flatMap((s) =>
          s.type === "line"
            ? [s.end]
            : s.type === "quadratic"
              ? [s.control, s.end]
              : [s.control1, s.control2, s.end],
        ),
      ];
}
export function translate(
  o: StationObject,
  dx: number,
  dy: number,
): StationObject {
  const p = (v: Point) => ({ x: v.x + dx, y: v.y + dy });
  return o.type === "area"
    ? { ...o, vertices: o.vertices.map(p) }
    : {
        ...o,
        start: p(o.start),
        segments: o.segments.map((s) =>
          s.type === "line"
            ? { ...s, end: p(s.end) }
            : s.type === "quadratic"
              ? { ...s, control: p(s.control), end: p(s.end) }
              : {
                  ...s,
                  control1: p(s.control1),
                  control2: p(s.control2),
                  end: p(s.end),
                },
        ),
      };
}
export function setPoint(
  o: StationObject,
  index: number,
  p: Point,
): StationObject {
  const copy = structuredClone(o);
  if (copy.type === "area") copy.vertices[index] = p;
  else if (index === 0) copy.start = p;
  else {
    let n = 1;
    for (const s of copy.segments) {
      if (s.type === "quadratic" && n++ === index) {
        s.control = p;
        break;
      }
      if (s.type === "cubic") {
        if (n++ === index) {
          s.control1 = p;
          break;
        }
        if (n++ === index) {
          s.control2 = p;
          break;
        }
      }
      if (n++ === index) {
        s.end = p;
        break;
      }
    }
  }
  return copy;
}
const path = (id: string, name: string, y: number): PathObject => ({
  id,
  name,
  type: "path",
  kind: "track",
  start: { x: 80, y },
  segments: [
    { type: "line", end: { x: 650, y } },
    {
      type: "cubic",
      control1: { x: 800, y },
      control2: { x: 810, y: y + 120 },
      end: { x: 1040, y: y + 120 },
    },
  ],
});
export const example: Station = {
  version: 1,
  objects: [
    {
      id: "grass-1",
      name: "North green",
      type: "area",
      kind: "grass",
      vertices: [
        { x: 70, y: 90 },
        { x: 1020, y: 90 },
        { x: 1020, y: 180 },
        { x: 70, y: 180 },
      ],
    },
    {
      id: "road-1",
      name: "Station approach",
      type: "area",
      kind: "road",
      vertices: [
        { x: 70, y: 570 },
        { x: 1040, y: 570 },
        { x: 1040, y: 625 },
        { x: 70, y: 625 },
      ],
    },
    {
      id: "platform-1",
      name: "Island platform 01",
      type: "area",
      kind: "platform",
      vertices: [
        { x: 160, y: 260 },
        { x: 670, y: 260 },
        { x: 760, y: 300 },
        { x: 670, y: 340 },
        { x: 160, y: 340 },
        { x: 120, y: 300 },
      ],
    },
    {
      id: "platform-2",
      name: "Side platform 02",
      type: "area",
      kind: "platform",
      vertices: [
        { x: 160, y: 435 },
        { x: 660, y: 435 },
        { x: 740, y: 475 },
        { x: 160, y: 475 },
      ],
    },
    path("track-1", "Track 01 · Main line", 220),
    path("track-2", "Track 02 · Main line", 380),
    path("track-3", "Track 03 · Siding", 515),
    {
      id: "edge-1",
      name: "Platform 01 · North edge",
      type: "path",
      kind: "edge",
      start: { x: 160, y: 260 },
      segments: [
        { type: "line", end: { x: 670, y: 260 } },
        { type: "line", end: { x: 760, y: 300 } },
      ],
    },
    {
      id: "edge-2",
      name: "Platform 01 · South edge",
      type: "path",
      kind: "edge",
      start: { x: 160, y: 340 },
      segments: [
        { type: "line", end: { x: 670, y: 340 } },
        { type: "line", end: { x: 760, y: 300 } },
      ],
    },
    {
      id: "edge-3",
      name: "Platform 02 · Edge",
      type: "path",
      kind: "edge",
      start: { x: 160, y: 435 },
      segments: [
        { type: "line", end: { x: 660, y: 435 } },
        { type: "line", end: { x: 740, y: 475 } },
      ],
    },
  ],
};
