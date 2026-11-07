import { describe, it, expect } from "vitest";
import {
  flattenPath,
  offsetPath,
  sleepers,
  trackStyle,
} from "./pathAppearance";
import type { PathObject } from "./station";
const path: PathObject = {
  id: "test",
  name: "Track",
  type: "path",
  kind: "track",
  start: { x: 0, y: 0 },
  segments: [
    { type: "line", end: { x: 2, y: 0 } },
    { type: "line", end: { x: 4, y: 0 } },
  ],
};
describe("path appearance geometry", () => {
  it("keeps sleeper spacing continuous across path segment boundaries", () => {
    const ties = sleepers(flattenPath(path));
    expect(ties).toHaveLength(6);
    ties.forEach((tie, i) => {
      expect(tie.center.x).toBeCloseTo(trackStyle.sleeperPitch * (i + 0.5));
      expect(tie.center.y).toBe(0);
      expect(tie.normal).toEqual({ x: -0, y: 1 });
    });
  });
  it("offsets the two rails to standard gauge", () => {
    const center = flattenPath(path),
      left = offsetPath(center, -trackStyle.gauge / 2),
      right = offsetPath(center, trackStyle.gauge / 2);
    left.forEach((p, i) =>
      expect(Math.hypot(p.x - right[i].x, p.y - right[i].y)).toBeCloseTo(1.435),
    );
  });
  it("follows both curve types and avoids duplicate points on zero-length segments", () => {
    const curve: PathObject = {
      ...path,
      segments: [
        { type: "line", end: { x: 0, y: 0 } },
        { type: "quadratic", control: { x: 5, y: 10 }, end: { x: 10, y: 0 } },
        {
          type: "cubic",
          control1: { x: 15, y: -10 },
          control2: { x: 20, y: -10 },
          end: { x: 25, y: 0 },
        },
      ],
    };
    const flattened = flattenPath(curve);
    expect(flattened[0]).toEqual({ x: 0, y: 0 });
    expect(flattened.at(-1)).toEqual({ x: 25, y: 0 });
    expect(flattened.some((p) => p.y > 4)).toBe(true);
    expect(flattened.some((p) => p.y < -6)).toBe(true);
    expect(
      offsetPath(flattened, 1).every(
        (p) => Number.isFinite(p.x) && Number.isFinite(p.y),
      ),
    ).toBe(true);
    for (let i = 1; i < flattened.length; i++)
      expect(
        Math.hypot(
          flattened[i].x - flattened[i - 1].x,
          flattened[i].y - flattened[i - 1].y,
        ),
      ).toBeGreaterThan(0);
  });
});
