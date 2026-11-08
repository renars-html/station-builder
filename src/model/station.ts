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
export interface TrackPlatformEdge {
  id: string;
  side: "left" | "right";
  /** Gap from the outside of the trackbed, in meters. */
  distance: number;
  /** Normalized distances along the track centerline, from 0 to 1. */
  start: number;
  end: number;
}
export interface PathObject extends Base {
  type: "path";
  kind: PathKind;
  start: Point;
  segments: Segment[];
  // Collection allows future multiple edges; the editor currently allows one.
  platformEdges?: TrackPlatformEdge[];
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
  platform: "#777b78",
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
export const example: Station = {
  version: 1,
  objects: [
    {
      id: "track-1",
      name: "Track 01",
      type: "path",
      kind: "track",
      start: { x: 425, y: 240 },
      segments: [{ type: "line", end: { x: 475, y: 240 } }],
      platformEdges: [
        { id: "platform-edge-1", side: "right", distance: 0, start: 0, end: 1 },
      ],
    },
  ],
};
