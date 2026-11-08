import { describe, it, expect } from "vitest";
import { closestOnSegment, segmentPoint } from "./curveProjection";
import type { Segment } from "./station";
describe("curve projection", () => {
  it("projects to the actual quadratic curve at high zoom rather than a sampled chord", () => {
    const start = { x: 0, y: 0 },
      segment: Segment = {
        type: "quadratic",
        control: { x: 5, y: 12 },
        end: { x: 10, y: 0 },
      },
      t = 0.373,
      p = segmentPoint(start, segment, t),
      dx = 10,
      dy = 24 - 48 * t,
      l = Math.hypot(dx, dy),
      query = { x: p.x - (dy / l) * 0.02, y: p.y + (dx / l) * 0.02 };
    const hit = closestOnSegment(start, segment, query);
    expect(hit.t).toBeCloseTo(t, 10);
    expect(hit.point.x).toBeCloseTo(p.x, 10);
    expect(hit.point.y).toBeCloseTo(p.y, 10);
  });
  it("finds the nearest branch of a looping cubic", () => {
    const segment: Segment = {
        type: "cubic",
        control1: { x: 20, y: 30 },
        control2: { x: -20, y: 30 },
        end: { x: 0, y: 0 },
      },
      start = { x: 0, y: 0 };
    for (const p of [
      { x: 4, y: 8 },
      { x: -4, y: 15 },
      { x: 0, y: 23 },
      { x: 1, y: 1 },
    ]) {
      const hit = closestOnSegment(start, segment, p);
      let sampled = Infinity;
      for (let i = 0; i <= 10000; i++) {
        const q = segmentPoint(start, segment, i / 10000);
        sampled = Math.min(sampled, Math.hypot(q.x - p.x, q.y - p.y));
      }
      expect(hit.distance).toBeLessThanOrEqual(sampled + 1e-8);
    }
  });
  it("handles degenerate curves, exact hits and clamped line endpoints", () => {
    const p = { x: 5, y: 5 };
    expect(
      closestOnSegment(
        p,
        { type: "cubic", control1: p, control2: p, end: p },
        { x: 10, y: 5 },
      ).point,
    ).toEqual(p);
    expect(
      closestOnSegment(
        { x: 0, y: 0 },
        { type: "line", end: { x: 10, y: 0 } },
        { x: 20, y: 2 },
      ).point,
    ).toEqual({ x: 10, y: 0 });
    const s: Segment = {
        type: "quadratic",
        control: { x: 10, y: 10 },
        end: { x: 20, y: 0 },
      },
      q = segmentPoint({ x: 0, y: 0 }, s, 0.5);
    expect(closestOnSegment({ x: 0, y: 0 }, s, q).distance).toBeCloseTo(0, 12);
  });
});
