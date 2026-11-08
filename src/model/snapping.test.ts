import { describe, it, expect } from "vitest";
import { resolveSnap } from "./snapping";
import type { PathObject } from "./station";
const path: PathObject = {
  id: "a",
  name: "Path",
  type: "path",
  kind: "track",
  start: { x: 0, y: 0 },
  segments: [{ type: "line", end: { x: 100, y: 0 } }],
};
describe("snapping", () => {
  it("prefers endpoints before boundaries and uses screen-relative tolerance", () => {
    expect(resolveSnap({ x: 0.5, y: 0.2 }, [path], 12)).toEqual({
      point: { x: 0, y: 0 },
      kind: "anchor",
    });
    expect(resolveSnap({ x: 0.5, y: 0.2 }, [path], 120).kind).toBe("grid");
    expect(resolveSnap({ x: 50, y: 0.5 }, [path], 12)).toEqual({
      point: { x: 50, y: 0 },
      kind: "boundary",
    });
  });
  it("excludes the moved node and its own boundary", () => {
    expect(resolveSnap({ x: 0.2, y: 0 }, [path], 12, "a", 0).kind).toBe("grid");
    expect(resolveSnap({ x: 99.8, y: 0 }, [path], 12, "a", 0)).toEqual({
      point: { x: 100, y: 0 },
      kind: "anchor",
    });
  });
  it("snaps to area anchors and boundaries and falls back to grid", () => {
    const area = {
      id: "b",
      name: "Grass",
      type: "area" as const,
      kind: "grass" as const,
      start: { x: 20, y: 20 },
      segments: [
        { type: "line" as const, end: { x: 30, y: 20 } },
        { type: "line" as const, end: { x: 30, y: 30 } },
        { type: "line" as const, end: { x: 20, y: 20 } },
      ],
    };
    expect(resolveSnap({ x: 20.2, y: 20.1 }, [area], 12).kind).toBe("anchor");
    expect(resolveSnap({ x: 25, y: 20.1 }, [area], 12).kind).toBe("boundary");
    expect(resolveSnap({ x: 25, y: 40 }, [area], 12)).toEqual({
      point: { x: 30, y: 40 },
      kind: "grid",
    });
  });
});
