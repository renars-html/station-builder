import type { StationObject } from "./station";
export type Material = "area" | "bed" | "sleepers" | "rails" | "edge" | "path";
export interface RenderItem {
  object: StationObject;
  material: Material;
  z: number;
  order: number;
}
const pass: Record<Material, number> = {
  area: 0,
  bed: 1,
  sleepers: 2,
  rails: 3,
  edge: 4,
  path: 4,
};
export const zLevel = (object: StationObject) => object.z ?? 0;
export function renderPlan(objects: StationObject[]): RenderItem[] {
  return objects
    .filter((object) => !object.hidden)
    .flatMap((object, order): RenderItem[] => {
      const z = zLevel(object);
      const materials: Material[] =
        object.type === "area"
          ? ["area"]
          : object.kind === "track"
            ? [
                "bed",
                "sleepers",
                "rails",
                ...(object.platformEdges?.length ? ["edge" as const] : []),
              ]
            : ["path"];
      return materials.map((material) => ({ object, material, z, order }));
    })
    .sort(
      (a, b) =>
        a.z - b.z || pass[a.material] - pass[b.material] || a.order - b.order,
    );
}
export function stackingOrder(objects: StationObject[]): StationObject[] {
  return [...objects].sort(
    (a, b) =>
      zLevel(a) - zLevel(b) ||
      (a.type === "area"
        ? 0
        : a.kind === "track" && !a.platformEdges?.length
          ? 3
          : 4) -
        (b.type === "area"
          ? 0
          : b.kind === "track" && !b.platformEdges?.length
            ? 3
            : 4) ||
      objects.indexOf(a) - objects.indexOf(b),
  );
}

/** Keep standalone edge bands directed into the nearest same-level platform. */
export function edgeSideFor(
  path: StationObject,
  objects: StationObject[],
): number {
  const end = path.segments[0]?.end ?? path.start;
  let side = 1,
    nearest = Infinity;
  for (const area of objects) {
    if (
      area.type !== "area" ||
      area.kind !== "platform" ||
      zLevel(area) !== zLevel(path)
    )
      continue;
    const anchors = [
      area.start,
      ...area.segments.slice(0, -1).map((s) => s.end),
    ];
    const c = anchors.reduce(
        (p, v) => ({
          x: p.x + v.x / anchors.length,
          y: p.y + v.y / anchors.length,
        }),
        { x: 0, y: 0 },
      ),
      distance = Math.hypot(c.x - path.start.x, c.y - path.start.y);
    if (distance < nearest) {
      nearest = distance;
      side =
        (end.x - path.start.x) * (c.y - path.start.y) -
          (end.y - path.start.y) * (c.x - path.start.x) >=
        0
          ? 1
          : -1;
    }
  }
  return side;
}
