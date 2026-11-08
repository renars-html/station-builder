import { useMemo } from "react";
import type { PathObject } from "../model/station";
import { pathLength, attachedEdgeLength } from "../model/pathMeasurements";
export default function PathMeasurements({ path }: { path: PathObject }) {
  const lengths = useMemo(
    () => ({
      path: pathLength(path),
      edges:
        path.kind === "track"
          ? (path.platformEdges ?? []).map((edge) => ({
              id: edge.id,
              length: attachedEdgeLength(path, edge),
            }))
          : [],
    }),
    [path],
  );
  return (
    <section className="path-measurements">
      <div className="section-heading">LENGTH</div>
      <div className="property-stats">
        <div>
          <span>Path length</span>
          <b>{lengths.path.toFixed(2)} m</b>
        </div>
        {lengths.edges.map((edge, i) => (
          <div key={edge.id}>
            <span>
              Platform edge{lengths.edges.length > 1 ? ` ${i + 1}` : ""}
            </span>
            <b>{edge.length.toFixed(2)} m</b>
          </div>
        ))}
      </div>
    </section>
  );
}
