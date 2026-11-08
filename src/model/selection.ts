import { points, type StationObject, type Point, translate } from "./station";
export function transformSelection(
  objects: StationObject[],
  ids: string[],
  delta: Point,
): StationObject[] {
  const selected = new Set(ids);
  return objects.map((o) =>
    selected.has(o.id) && !o.locked && !o.hidden
      ? translate(o, delta.x, delta.y)
      : o,
  );
}
export function boxSelection(
  objects: StationObject[],
  a: Point,
  b: Point,
): string[] {
  const left = Math.min(a.x, b.x),
    right = Math.max(a.x, b.x),
    top = Math.min(a.y, b.y),
    bottom = Math.max(a.y, b.y);
  return objects
    .filter(
      (o) =>
        !o.hidden &&
        points(o).every(
          (p) => p.x >= left && p.x <= right && p.y >= top && p.y <= bottom,
        ),
    )
    .map((o) => o.id);
}
