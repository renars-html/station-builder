import { describe, it, expect } from "vitest";
import { example, type PathObject, type PathKind } from "./station";
import { pathLength, attachedEdgeLength } from "./pathMeasurements";
const path: PathObject = {
  id: "test",
  name: "Path",
  type: "path",
  kind: "track",
  start: { x: 0, y: 0 },
  segments: [{ type: "line", end: { x: 30, y: 40 } }],
};
describe("path measurements", () => {
  it("measures every path kind in world meters", () => {
    for (const kind of ["placeholder", "track", "edge"] as PathKind[])
      expect(pathLength({ ...path, kind })).toBe(50);
  });
  it("measures a trimmed attached edge, including on the opposite side", () => {
    const edge = {
      id: "edge",
      side: "right" as const,
      distance: 0,
      start: 0.2,
      end: 0.8,
    };
    expect(attachedEdgeLength(path, edge)).toBeCloseTo(30);
    expect(
      attachedEdgeLength(path, { ...edge, side: "left", distance: 5 }),
    ).toBeCloseTo(30);
  });
  it("accounts for side and offset when measuring curved edges", () => {
    const curve: PathObject = {
      ...path,
      segments: [
        { type: "quadratic", control: { x: 20, y: 30 }, end: { x: 40, y: 0 } },
      ],
    };
    const edge = {
      id: "edge",
      side: "right" as const,
      distance: 0,
      start: 0,
      end: 1,
    };
    expect(attachedEdgeLength(curve, edge)).toBeGreaterThan(pathLength(curve));
    expect(attachedEdgeLength(curve, { ...edge, side: "left" })).toBeLessThan(
      pathLength(curve),
    );
    expect(attachedEdgeLength(curve, { ...edge, distance: 2 })).toBeGreaterThan(
      attachedEdgeLength(curve, edge),
    );
  });
  it("starts with a single straight track and a full-length attached platform edge", () => {
    expect(example.objects).toHaveLength(1);
    const track = example.objects[0] as PathObject;
    expect(track.kind).toBe("track");
    expect(track.segments).toHaveLength(1);
    expect(track.segments[0].type).toBe("line");
    expect(track.platformEdges).toHaveLength(1);
    expect(pathLength(track)).toBe(50);
    expect(attachedEdgeLength(track, track.platformEdges![0])).toBe(50);
  });
});
