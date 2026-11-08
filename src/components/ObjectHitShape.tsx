import { useMemo } from "react";
import { Line, Path } from "react-konva";
import { pathData, type StationObject } from "../model/station";
import { flattenPath, offsetPath, trackStyle } from "../model/pathAppearance";
import { attachedBands, platformBands } from "../model/trackPlatform";
import type { Material } from "../model/renderPlan";
export default function ObjectHitShape({
  object,
  scale,
  material,
  edgeSide,
}: {
  object: StationObject;
  scale: number;
  material: Material;
  edgeSide: number;
}) {
  const center = useMemo(() => flattenPath(object), [object]);
  const bands = useMemo(
    () =>
      object.type === "path"
        ? object.kind === "track"
          ? (object.platformEdges ?? []).flatMap((edge) =>
              attachedBands(center, edge),
            )
          : object.kind === "edge"
            ? platformBands(center, edgeSide)
            : []
        : [],
    [object, center, edgeSide],
  );
  if (object.type === "area")
    return <Path data={pathData(object) + " Z"} fill="transparent" />;
  if (material === "edge" || object.kind === "edge")
    return (
      <>
        {bands.map((band, i) => (
          <Line key={i} points={band.points} closed fill="transparent" />
        ))}
      </>
    );
  if (material === "rails")
    return (
      <>
        {[-1, 1].map((side) => (
          <Line
            key={side}
            points={offsetPath(center, (side * trackStyle.gauge) / 2).flatMap(
              (p) => [p.x, p.y],
            )}
            stroke="transparent"
            strokeWidth={trackStyle.railWidth}
            hitStrokeWidth={Math.max(trackStyle.railWidth, 8 / scale)}
          />
        ))}
      </>
    );
  return (
    <Path
      data={pathData(object)}
      stroke="transparent"
      strokeWidth={object.kind === "track" ? trackStyle.bedWidth : 2}
      hitStrokeWidth={Math.max(
        object.kind === "track" ? trackStyle.bedWidth : 2,
        20 / scale,
      )}
    />
  );
}
