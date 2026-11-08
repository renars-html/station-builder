import type { PathObject, TrackPlatformEdge } from "./station";
import { flattenPath, offsetPath, trackStyle } from "./pathAppearance";
import { polylineLength, sliceAlong } from "./trackPlatform";
export const pathLength = (path: PathObject): number =>
  polylineLength(flattenPath(path));
// Measure the attached edge's outer boundary, including its offset on curves.
export function attachedEdgeLength(
  path: PathObject,
  edge: TrackPlatformEdge,
): number {
  const section = sliceAlong(flattenPath(path), edge.start, edge.end);
  const offset =
    (trackStyle.bedWidth / 2 + edge.distance) *
    (edge.side === "right" ? 1 : -1);
  return polylineLength(offsetPath(section, offset));
}
