import { attachedBands } from "../model/trackPlatform";
import { useMemo } from "react";
import { Group, Line, Path, Shape } from "react-konva";
import { pathData, type PathObject, type Point } from "../model/station";
import {
  edgeBands,
  flattenPath,
  offsetPath,
  sleepers,
  trackStyle,
} from "../model/pathAppearance";
const coordinates = (ps: Point[]) => ps.flatMap((p) => [p.x, p.y]);
export default function PathAppearance({
  path,
  selected,
  edgeSide = 1,
  hitWidth,
}: {
  path: PathObject;
  selected: boolean;
  edgeSide?: number;
  hitWidth: number;
}) {
  const geometry = useMemo(() => {
    if (path.kind === "placeholder") return null;
    const center = flattenPath(path);
    if (path.kind === "track")
      return {
        center,
        rails: [
          offsetPath(center, -trackStyle.gauge / 2),
          offsetPath(center, trackStyle.gauge / 2),
        ],
        sleepers: sleepers(center),
        bands: [],
      };
    let offset = 0;
    const bands = edgeBands.map((b) => {
      const a = offsetPath(center, offset * edgeSide);
      offset += b.width;
      return {
        color: b.color,
        points: coordinates([
          ...a,
          ...offsetPath(center, offset * edgeSide).reverse(),
        ]),
      };
    });
    return { center, rails: [], sleepers: [], bands };
  }, [path, edgeSide]);
  const attached = useMemo(
    () =>
      path.kind === "track" && geometry
        ? (path.platformEdges ?? []).flatMap((edge) =>
            attachedBands(geometry.center, edge),
          )
        : [],
    [path, geometry],
  );
  return (
    <Group>
      {selected && (
        <Path
          data={pathData(path)}
          stroke="#54a58e"
          opacity={0.25}
          strokeWidth={5}
          listening={false}
        />
      )}
      {path.kind === "placeholder" ? (
        <Path
          data={pathData(path)}
          stroke="#64746c"
          strokeWidth={2}
          hitStrokeWidth={Math.max(2, hitWidth)}
        />
      ) : path.kind === "track" && geometry ? (
        <>
          <Line
            points={coordinates(geometry.center)}
            stroke={trackStyle.bed}
            strokeWidth={trackStyle.bedWidth}
            lineJoin="round"
            hitStrokeWidth={Math.max(trackStyle.bedWidth, hitWidth)}
          />
          <Shape
            listening={false}
            sceneFunc={(ctx) => {
              ctx.beginPath();
              for (const { center: p, normal: n } of geometry.sleepers) {
                const half = trackStyle.sleeperLength / 2,
                  w = trackStyle.sleeperWidth / 2;
                ctx.moveTo(
                  p.x + n.x * half - n.y * w,
                  p.y + n.y * half + n.x * w,
                );
                ctx.lineTo(
                  p.x - n.x * half - n.y * w,
                  p.y - n.y * half + n.x * w,
                );
                ctx.lineTo(
                  p.x - n.x * half + n.y * w,
                  p.y - n.y * half - n.x * w,
                );
                ctx.lineTo(
                  p.x + n.x * half + n.y * w,
                  p.y + n.y * half - n.x * w,
                );
                ctx.closePath();
              }
              ctx.setAttr("fillStyle", trackStyle.sleeper);
              ctx.fill();
            }}
          />
          {geometry.rails.map((rail, i) => (
            <Line
              key={i}
              points={coordinates(rail)}
              stroke={trackStyle.rail}
              strokeWidth={trackStyle.railWidth}
              lineJoin="round"
              listening={false}
            />
          ))}
        </>
      ) : (
        geometry?.bands.map((b, i) => (
          <Line
            key={i}
            points={b.points}
            closed
            fill={b.color}
            strokeWidth={0}
          />
        ))
      )}
      {attached.map((b, i) => (
        <Line
          key={"attached" + i}
          points={b.points}
          closed
          fill={b.color}
          strokeWidth={0}
        />
      ))}
      {path.kind === "edge" && (
        <Path
          data={pathData(path)}
          stroke="transparent"
          strokeWidth={0.1}
          hitStrokeWidth={Math.max(0.2, hitWidth)}
        />
      )}
    </Group>
  );
}
