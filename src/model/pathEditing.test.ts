import { describe, it, expect } from "vitest";
import { splitSegment, pathDraft } from "./pathEditing";
import { draftGeometry } from "./pathDraft";
import { example, type PathObject, type Point, type Segment } from "./station";
import { flattenPath } from "./pathAppearance";
import { pointAlong } from "./trackPlatform";
import { useEditor } from "../store/editor";
const path: PathObject = {
  id: "a",
  name: "Curve",
  type: "path",
  kind: "track",
  start: { x: 0, y: 0 },
  segments: [],
};
describe("finished path editing", () => {
  it.each<Segment>([
    { type: "line", end: { x: 10, y: 10 } },
    { type: "quadratic", control: { x: 5, y: 20 }, end: { x: 10, y: 10 } },
    {
      type: "cubic",
      control1: { x: 0, y: 20 },
      control2: { x: 10, y: 20 },
      end: { x: 10, y: 10 },
    },
  ])("splits a $type segment without changing its shape", (segment) => {
    const original = { ...path, segments: [segment] },
      split = splitSegment(original, 0);
    expect(split.segments).toHaveLength(2);
    const a = flattenPath(original),
      b = flattenPath(split);
    for (let i = 0; i <= 10; i++) {
      const p = pointAlong(a, i / 10),
        q = pointAlong(b, i / 10);
      expect(Math.hypot(p.x - q.x, p.y - q.y)).toBeLessThan(0.01);
    }
    expect(draftGeometry(pathDraft(split))).toEqual({
      start: split.start,
      segments: split.segments,
    });
  });
  it("extends in place preserving ID, kind, attachments and undoable draft history", () => {
    useEditor.getState().loadProject(example, true);
    const original = useEditor.getState().station.objects[0] as PathObject;
    useEditor.getState().extendPath(original.id);
    useEditor.getState().addPoint({ x: 500, y: 240, role: "standard" });
    useEditor.getState().finishPath();
    const extended = useEditor.getState().station.objects[0] as PathObject;
    expect(extended.id).toBe(original.id);
    expect(extended.kind).toBe("track");
    expect(extended.platformEdges).toEqual(original.platformEdges);
    expect(extended.segments).toHaveLength(2);
    useEditor.getState().undo();
    expect(useEditor.getState().editingObjectId).toBe(original.id);
    expect(useEditor.getState().station.objects[0]).toEqual(original);
    useEditor.getState().redo();
    expect(useEditor.getState().station.objects[0]).toEqual(extended);
  });
  it("does not finish a collapsed path", () => {
    useEditor.getState().loadProject({ version: 1, objects: [] }, true);
    useEditor.getState().setTool("path");
    const p: Point = { x: 0, y: 0 };
    useEditor.getState().addPoint({ ...p, role: "standard" });
    useEditor.getState().addPoint({ ...p, role: "standard" });
    useEditor.getState().finishPath();
    expect(useEditor.getState().station.objects).toEqual([]);
  });
});
