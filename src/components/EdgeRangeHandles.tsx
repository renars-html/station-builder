import type Konva from "konva";
import { useMemo, useRef, useEffect } from "react";
import { Circle, Group, Line } from "react-konva";
import type { PathObject, StationObject } from "../model/station";
import { flattenPath } from "../model/pathAppearance";
import { pointAlong, projectAlong, sliceAlong } from "../model/trackPlatform";
import { useEditor } from "../store/editor";
export default function EdgeRangeHandles({
  track,
  edgeId,
  scale,
  space,
  onPreview,
}: {
  track: PathObject;
  edgeId: string;
  scale: number;
  space: boolean;
  onPreview: (o: StationObject | null) => void;
}) {
  const { station, commit } = useEditor();
  const drag = useRef<{ station: typeof station; node: Konva.Node } | null>(
    null,
  );
  useEffect(() => {
    const cancel = (e: KeyboardEvent | FocusEvent) => {
      if (e.type === "keydown" && (e as KeyboardEvent).key !== "Escape") return;
      const node = drag.current?.node;
      drag.current = null;
      onPreview(null);
      if (node?.isDragging()) node.stopDrag();
    };
    window.addEventListener("keydown", cancel);
    window.addEventListener("blur", cancel);
    return () => {
      window.removeEventListener("keydown", cancel);
      window.removeEventListener("blur", cancel);
    };
  }, []);

  const center = useMemo(() => flattenPath(track), [track]);
  const edge = track.platformEdges?.find((e) => e.id === edgeId);
  if (!edge) return null;
  const change = (
    which: "start" | "end",
    p: { x: number; y: number },
  ): PathObject => {
    const fraction = projectAlong(center, p);
    const value =
      which === "start"
        ? Math.min(fraction, Math.max(0, edge.end - 0.000001))
        : Math.max(fraction, Math.min(1, edge.start + 0.000001));
    return {
      ...track,
      platformEdges: track.platformEdges?.map((e) =>
        e.id === edgeId ? { ...e, [which]: value } : e,
      ),
    };
  };
  return (
    <Group>
      <Line
        points={sliceAlong(center, edge.start, edge.end).flatMap((p) => [
          p.x,
          p.y,
        ])}
        stroke="#277d6c"
        strokeWidth={3 / scale}
        dash={[6 / scale, 4 / scale]}
        listening={false}
      />
      {(["start", "end"] as const).map((which) => (
        <Circle
          key={which}
          {...pointAlong(center, edge[which])}
          radius={(which === "start" ? 7 : 6) / scale}
          fill={which === "start" ? "#277d6c" : "#cb873b"}
          stroke="white"
          strokeWidth={2 / scale}
          draggable={!space}
          onMouseDown={(e) => {
            if (e.evt.button === 0 && !space) e.cancelBubble = true;
          }}
          onDragStart={(e) => {
            drag.current = {
              station: useEditor.getState().station,
              node: e.target,
            };
          }}
          onDragMove={(e) => {
            if (
              !drag.current ||
              drag.current.station !== useEditor.getState().station
            )
              return;
            const next = change(which, e.target.position());
            const attachment = next.platformEdges!.find(
              (a) => a.id === edgeId,
            )!;
            e.target.position(pointAlong(center, attachment[which]));
            onPreview(next);
          }}
          onDragEnd={(e) => {
            const base = drag.current;
            drag.current = null;
            if (!base || base.station !== useEditor.getState().station) {
              onPreview(null);
              return;
            }
            const next = change(which, e.target.position());
            commit(station.objects.map((o) => (o.id === track.id ? next : o)));
            onPreview(null);
          }}
        />
      ))}
    </Group>
  );
}
