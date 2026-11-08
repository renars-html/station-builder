import { describe, it, expect } from "vitest";
import { areaFromDraft, areaSize } from "./areaGeometry";
import { points, setPoint, type AreaObject } from "./station";
import { splitSegment } from "./pathEditing";
import { parseProject, serializeProject } from "./projectFile";
import { useEditor } from "../store/editor";
import type { DraftPoint } from "./pathDraft";
const standard = (x: number, y: number): DraftPoint => ({
  x,
  y,
  role: "standard",
});
const control = (x: number, y: number): DraftPoint => ({
  x,
  y,
  role: "control",
});
const draft = [
  standard(0, 0),
  control(5, -5),
  standard(10, 0),
  standard(10, 10),
  control(-5, 10),
  control(-5, 0),
];
const area: AreaObject = {
  id: "area",
  name: "Platform",
  type: "area",
  kind: "platform",
  ...areaFromDraft(draft)!,
};
describe("curved areas", () => {
  it("builds quadratic and cubic boundaries, including a curved closing segment", () => {
    expect(area.segments.map((s) => s.type)).toEqual([
      "quadratic",
      "line",
      "cubic",
    ]);
    expect(area.segments.at(-1)!.end).toEqual(area.start);
    expect(areaSize(area)).toBeGreaterThan(50);
    expect(points(area)).toHaveLength(6);
  });
  it("moves the first anchor and its closing endpoint together without changing controls", () => {
    const edited = setPoint(area, 0, { x: -2, y: -2 });
    expect(edited.start).toEqual(edited.segments.at(-1)!.end);
    expect(points(edited)).toHaveLength(points(area).length);
    expect(area.start).toEqual({ x: 0, y: 0 });
  });
  it("splits a closing curve while preserving enclosure and closure", () => {
    const split = splitSegment(area, 2);
    expect(split.segments).toHaveLength(4);
    expect(areaSize(split)).toBeCloseTo(areaSize(area), 2);
    expect(split.segments.at(-1)!.end).toEqual(split.start);
  });
  it("migrates version-1 polygon files and round-trips curved version-2 areas", () => {
    const migrated = parseProject(
      JSON.stringify({
        version: 1,
        objects: [
          {
            id: "old",
            name: "Grass",
            type: "area",
            kind: "grass",
            vertices: [
              { x: 0, y: 0 },
              { x: 10, y: 0 },
              { x: 10, y: 10 },
            ],
          },
        ],
      }),
    );
    expect(migrated.version).toBe(2);
    const polygon = migrated.objects[0] as AreaObject;
    expect(polygon.segments).toHaveLength(3);
    expect(polygon.segments.at(-1)!.end).toEqual(polygon.start);
    expect(
      parseProject(serializeProject({ version: 2, objects: [area] })),
    ).toEqual({ version: 2, objects: [area] });
  });
  it("rejects collapsed drafts and unclosed file boundaries", () => {
    expect(
      areaFromDraft([standard(0, 0), standard(1, 0), standard(2, 0)]),
    ).toBeNull();
    const bad = structuredClone(area);
    bad.segments.at(-1)!.end = { x: 1, y: 1 };
    expect(() =>
      parseProject(JSON.stringify({ version: 2, objects: [bad] })),
    ).toThrow("close");
  });
  it("records curved area drawing and finishing in undo/redo", () => {
    useEditor.getState().loadProject({ version: 2, objects: [] }, true);
    useEditor.getState().setTool("area");
    draft.forEach((p) => useEditor.getState().addPoint(p));
    useEditor.getState().finishArea("platform");
    expect(useEditor.getState().station.objects).toHaveLength(1);
    useEditor.getState().undo();
    expect(useEditor.getState().draft).toEqual(draft);
    useEditor.getState().redo();
    expect(
      (useEditor.getState().station.objects[0] as AreaObject).segments.at(-1)!
        .type,
    ).toBe("cubic");
  });
});
