import { areaSize } from "./areaGeometry";
import {
  colors,
  points,
  pathKinds,
  type Point,
  type Segment,
  type Station,
  type StationObject,
  type TrackPlatformEdge,
} from "./station";
export const MAX_PROJECT_BYTES = 8 * 1024 * 1024;
const record = (v: unknown, label: string): Record<string, unknown> => {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw new Error(`${label} must be an object.`);
  return v as Record<string, unknown>;
};
const list = (v: unknown, label: string, max: number): unknown[] => {
  if (!Array.isArray(v) || v.length > max)
    throw new Error(`${label} must be an array with at most ${max} items.`);
  return v;
};
const number = (v: unknown, label: string, min = -1e7, max = 1e7): number => {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max)
    throw new Error(
      `${label} must be a finite number between ${min} and ${max}.`,
    );
  return v;
};
const string = (v: unknown, label: string): string => {
  if (typeof v !== "string" || !v.trim() || v.length > 200)
    throw new Error(
      `${label} must be nonempty text of at most 200 characters.`,
    );
  return v;
};
export function parseProject(text: string): Station {
  if (text.length > MAX_PROJECT_BYTES)
    throw new Error("Project is too large (maximum 8 MB).");
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON. Choose a station layout JSON file.");
  }
  const root = record(data, "Project");
  if (root.version !== 1 && root.version !== 2)
    throw new Error(
      `Unsupported project version: ${String(root.version)}. This editor supports versions 1 and 2.`,
    );
  const ids = new Set<string>();
  let count = 0;
  const id = (v: unknown) => {
    const value = string(v, "ID");
    if (ids.has(value)) throw new Error(`Duplicate ID: ${value}.`);
    ids.add(value);
    return value;
  };
  const point = (v: unknown): Point => {
    if (++count > 100000)
      throw new Error("Project exceeds the 100,000 geometry-point limit.");
    const p = record(v, "Point");
    return { x: number(p.x, "Point x"), y: number(p.y, "Point y") };
  };
  const segment = (v: unknown): Segment => {
    const s = record(v, "Segment"),
      end = point(s.end);
    switch (s.type) {
      case "line":
        return { type: "line", end };
      case "quadratic":
        return { type: "quadratic", control: point(s.control), end };
      case "cubic":
        return {
          type: "cubic",
          control1: point(s.control1),
          control2: point(s.control2),
          end,
        };
      default:
        throw new Error("Unknown path segment type.");
    }
  };
  const attachment = (v: unknown): TrackPlatformEdge => {
    const e = record(v, "Platform edge");
    if (e.side !== "left" && e.side !== "right")
      throw new Error("Platform edge side must be left or right.");
    const start = number(e.start, "Edge start", 0, 1),
      end = number(e.end, "Edge end", 0, 1);
    if (start >= end)
      throw new Error("Platform edge start must precede its end.");
    return {
      id: id(e.id),
      side: e.side,
      distance: number(e.distance, "Edge distance", 0),
      start,
      end,
    };
  };
  const objects = list(root.objects, "Objects", 10000).map(
    (v): StationObject => {
      const o = record(v, "Object"),
        base = {
          id: id(o.id),
          name:
            typeof o.name === "string" && o.name.length <= 200
              ? o.name
              : string(o.name, "Object name"),
        };
      if (o.type === "path") {
        if (typeof o.kind !== "string" || !Object.hasOwn(pathKinds, o.kind))
          throw new Error("Unknown path kind.");
        const segments = list(o.segments, "Segments", 20000).map(segment);
        if (!segments.length)
          throw new Error("Paths need at least one segment.");
        const result: StationObject = {
          ...base,
          type: "path",
          kind: o.kind as keyof typeof pathKinds,
          start: point(o.start),
          segments,
          ...(o.platformEdges === undefined
            ? {}
            : {
                platformEdges: list(
                  o.platformEdges,
                  "Attached platform edges",
                  1,
                ).map(attachment),
              }),
        };
        if (
          points(result).every(
            (p) => p.x === result.start.x && p.y === result.start.y,
          )
        )
          throw new Error("Path must have nonzero length.");
        return result;
      }
      if (o.type === "area") {
        if (typeof o.kind !== "string" || !Object.hasOwn(colors, o.kind))
          throw new Error("Unknown area fill.");
        let start: Point, segments: Segment[];
        if (root.version === 1) {
          const vertices = list(o.vertices, "Area vertices", 20000).map(point);
          if (vertices.length < 3)
            throw new Error("Areas need at least three vertices.");
          start = vertices[0];
          segments = [...vertices.slice(1), start].map((end) => ({
            type: "line",
            end,
          }));
        } else {
          start = point(o.start);
          segments = list(o.segments, "Area segments", 20000).map(segment);
        }
        const last = segments.at(-1)?.end;
        if (
          segments.length < 3 ||
          !last ||
          last.x !== start.x ||
          last.y !== start.y
        )
          throw new Error(
            "Area boundary must have at least three segments and close at its start.",
          );
        if (areaSize({ start, segments }) < 1e-6)
          throw new Error("Area must enclose a nonzero surface.");
        return {
          ...base,
          type: "area",
          kind: o.kind as keyof typeof colors,
          start,
          segments,
        };
      }
      throw new Error("Unknown object type.");
    },
  );
  return { version: 2, objects };
}
export function serializeProject(station: Station): string {
  return JSON.stringify(parseProject(JSON.stringify(station)), null, 2);
}
