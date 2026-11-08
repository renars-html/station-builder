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
    expect(resolveSnap({ x: 0.5, y: 0.2 }, [path], 12)).toMatchObject({
      point: { x: 0, y: 0 },
      kind: "anchor",
    });
    expect(resolveSnap({ x: 0.5, y: 0.2 }, [path], 120).kind).toBe("grid");
    expect(resolveSnap({ x: 50, y: 0.5 }, [path], 12)).toMatchObject({
      point: { x: 50, y: 0 },
      kind: "boundary",
    });
  });
  it("excludes the moved node and its own boundary", () => {
    expect(resolveSnap({ x: 0.2, y: 0 }, [path], 12, "a", 0).kind).toBe("grid");
    expect(resolveSnap({ x: 99.8, y: 0 }, [path], 12, "a", 0)).toMatchObject({
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
    expect(resolveSnap({ x: 25, y: 40 }, [area], 12)).toMatchObject({
      point: { x: 30, y: 40 },
      kind: "grid",
    });
  });
});

import { snapTranslation } from "./snapping";
import { segmentPoint } from "./curveProjection";
import { transformSelection } from "./selection";
import { points, type AreaObject } from "./station";
import { useEditor } from "../store/editor";
const area: AreaObject = {
  id: "area",
  name: "Platform",
  type: "area",
  kind: "platform",
  start: { x: 0, y: 5 },
  segments: [
    { type: "line", end: { x: 2, y: 5 } },
    { type: "line", end: { x: 2, y: 7 } },
    { type: "line", end: { x: 0, y: 5 } },
  ],
};
describe("snapping between paths and areas", () => {
  it("resolves curved area boundaries precisely with source-aware feedback", () => {
    const curved: AreaObject = {
      ...area,
      segments: [
        { type: "quadratic", control: { x: 5, y: 15 }, end: { x: 10, y: 5 } },
        { type: "line", end: { x: 10, y: 20 } },
        { type: "line", end: { x: 0, y: 5 } },
      ],
    };
    const p = segmentPoint(curved.start, curved.segments[0], 0.373),
      target = resolveSnap(
        { x: p.x + 0.005, y: p.y },
        [curved],
        288,
        undefined,
        undefined,
        { z: 0 },
      );
    expect(target.kind).toBe("boundary");
    expect(target.objectId).toBe(curved.id);
    expect(target.label).toContain("Area boundary");
    const hit = target.point,
      t = hit.x / 10;
    expect(hit.y).toBeCloseTo(5 + 20 * t * (1 - t), 9);
  });
  it("only considers the source Z level, while hidden and moving objects are excluded", () => {
    const bridge = { ...path, z: 1 };
    expect(
      resolveSnap({ x: 50, y: 0.2 }, [bridge], 12, undefined, undefined, {
        z: 0,
      }).kind,
    ).toBe("grid");
    expect(
      resolveSnap({ x: 50, y: 0.2 }, [bridge], 12, undefined, undefined, {
        z: 1,
      }).kind,
    ).toBe("boundary");
    expect(
      resolveSnap({ x: 50, y: 0.2 }, [{ ...path, hidden: true }], 12).kind,
    ).toBe("grid");
    expect(
      resolveSnap({ x: 0.1, y: 0 }, [path], 12, undefined, undefined, {
        excludeIds: [path.id],
        grid: false,
      }),
    ).toBeNull();
  });
  it("snaps areas to both visible boundaries of track-attached platform edges", () => {
    const track: PathObject = {
      ...path,
      platformEdges: [
        { id: "attached", side: "right", distance: 0, start: 0.1, end: 0.9 },
      ],
    };
    for (const y of [1.7, 4.7]) {
      const target = resolveSnap({ x: 50, y: y + 0.1 }, [track], 12);
      expect(target.point.y).toBeCloseTo(y);
      expect(target.label).toContain("Attached platform edge");
    }
    const beyond = resolveSnap({ x: 5, y: 1.8 }, [track], 12);
    expect(beyond.label).not.toContain("Attached");
  });
  it("does not treat curve controls as join anchors", () => {
    const curve: PathObject = {
      ...path,
      segments: [
        { type: "quadratic", control: { x: 50, y: 20 }, end: { x: 100, y: 0 } },
      ],
    };
    expect(resolveSnap({ x: 50, y: 20 }, [curve], 12).kind).toBe("grid");
  });
  it("translates a whole area onto a path without distorting its boundary", () => {
    const target: PathObject = { ...path, start: { x: -20, y: 0 } };
    const raw = { x: 0.2, y: -4.6 },
      result = snapTranslation([area, target], [area.id], raw, 12);
    expect(result.target?.kind).toBe("boundary");
    expect(result.delta.x).toBeCloseTo(0.2);
    expect(result.delta.y).toBeCloseTo(-5);
    const moved = transformSelection(
      [area, target],
      [area.id],
      result.delta,
    )[0];
    points(area).forEach((p, i) =>
      expect(points(moved)[i]).toEqual({
        x: p.x + result.delta.x,
        y: p.y + result.delta.y,
      }),
    );
  });
  it("translates a path onto an area anchor and gives anchors priority over nearby boundaries", () => {
    const moving: PathObject = {
      ...path,
      id: "moving",
      start: { x: 0, y: 0 },
      segments: [{ type: "line", end: { x: 2, y: 0 } }],
    };
    const result = snapTranslation(
      [moving, area],
      [moving.id],
      { x: 0.2, y: 4.8 },
      12,
    );
    expect(result.target?.kind).toBe("anchor");
    expect(result.delta).toEqual({ x: 0, y: 5 });
  });
  it("aligns an area anchor to another area without snapping to its own old geometry", () => {
    const target = {
      ...area,
      id: "other-area",
      start: { x: 10, y: 5 },
      segments: area.segments.map((s) => ({
        ...s,
        end: { x: s.end.x + 10, y: s.end.y },
      })),
    };
    const result = snapTranslation(
      [area, target],
      [area.id],
      { x: 7.8, y: 0.1 },
      12,
    );
    expect(result.target?.objectId).toBe(target.id);
    expect(result.target?.kind).toBe("anchor");
    expect(result.delta.x).toBeCloseTo(8);
    expect(result.delta.y).toBeCloseTo(0);
  });
  it("keeps multi-selection rigid and makes the snapped move one undoable edit", () => {
    const moving: PathObject = {
        ...path,
        id: "moving",
        start: { x: 10, y: 5 },
        segments: [{ type: "line", end: { x: 12, y: 5 } }],
      },
      target: PathObject = { ...path, start: { x: -20, y: 0 } },
      objects = [area, moving, target];
    useEditor.getState().loadProject({ version: 2, objects }, true);
    const result = snapTranslation(
      objects,
      [area.id, moving.id],
      { x: 0.2, y: -4.6 },
      12,
    );
    useEditor
      .getState()
      .commit(transformSelection(objects, [area.id, moving.id], result.delta));
    const next = useEditor.getState().station.objects;
    expect(next[1].start.x - next[0].start.x).toBe(10);
    expect(next[1].start.y - next[0].start.y).toBe(0);
    expect(useEditor.getState().past).toHaveLength(1);
    useEditor.getState().undo();
    expect(useEditor.getState().station.objects).toEqual(objects);
    useEditor.getState().redo();
    expect(useEditor.getState().station.objects).toEqual(next);
  });
  it("falls back to a single grid-aligned translation without moving locked sources", () => {
    const result = snapTranslation([area], [area.id], { x: 3, y: 2 }, 12);
    expect(result.target?.kind).toBe("grid");
    expect(result.delta).toEqual({ x: 0, y: 5 });
    expect(
      snapTranslation(
        [{ ...area, locked: true }],
        [area.id],
        { x: 3, y: 2 },
        12,
      ),
    ).toEqual({ delta: { x: 3, y: 2 }, target: null });
  });
});
