import { describe, it, expect, beforeEach } from "vitest";
import { boxSelection, transformSelection } from "./selection";
import { example, type PathObject } from "./station";
import { useEditor } from "../store/editor";
import { renderPlan } from "./renderPlan";
import { parseProject, serializeProject } from "./projectFile";
const a = example.objects[0] as PathObject;
const b: PathObject = {
  ...a,
  id: "b",
  name: "Locked",
  locked: true,
  platformEdges: [],
};
const c: PathObject = {
  ...a,
  id: "c",
  name: "Hidden",
  hidden: true,
  platformEdges: [],
};
beforeEach(() =>
  useEditor.getState().loadProject({ version: 2, objects: [a, b, c] }, true),
);
describe("selection and edit transactions", () => {
  it("toggles additive selection and moves a group in one history step, respecting locks", () => {
    const s = useEditor.getState();
    s.select(a.id);
    s.select(b.id, true);
    expect(useEditor.getState().selection).toEqual([a.id, b.id]);
    useEditor.getState().nudge(1, 2);
    const objects = useEditor.getState().station.objects as PathObject[];
    expect(objects[0].start).toEqual({ x: a.start.x + 1, y: a.start.y + 2 });
    expect(objects[1]).toEqual(b);
    expect(objects[2]).toEqual(c);
    expect(useEditor.getState().past).toHaveLength(1);
    useEditor.getState().undo();
    expect(useEditor.getState().station.objects).toEqual([a, b, c]);
  });
  it("deletes unlocked selected objects as one action and preserves locked ones", () => {
    useEditor.getState().selectMany([a.id, b.id]);
    useEditor.getState().remove();
    expect(useEditor.getState().station.objects.map((o) => o.id)).toEqual([
      b.id,
      c.id,
    ]);
    expect(useEditor.getState().selection).toEqual([b.id]);
    useEditor.getState().undo();
    expect(useEditor.getState().station.objects).toEqual([a, b, c]);
  });
  it("does not create history or discard redo for an unchanged edit", () => {
    useEditor.getState().select(a.id);
    useEditor.getState().nudge(1, 0);
    useEditor.getState().undo();
    const before = useEditor.getState();
    useEditor.getState().commit([...before.station.objects]);
    expect(useEditor.getState().past).toHaveLength(before.past.length);
    expect(useEditor.getState().future).toEqual(before.future);
  });
  it("box-selects contained objects in either drag direction, excluding hidden objects", () => {
    expect(
      boxSelection([a, b, c], { x: 400, y: 230 }, { x: 500, y: 250 }),
    ).toEqual([a.id, b.id]);
    expect(
      boxSelection([a, b, c], { x: 500, y: 250 }, { x: 400, y: 230 }),
    ).toEqual([a.id, b.id]);
    expect(boxSelection([a], { x: 430, y: 230 }, { x: 500, y: 250 })).toEqual(
      [],
    );
  });
  it("preserves locks and visibility in files, hides render items, and does not move hidden objects", () => {
    expect(
      parseProject(serializeProject({ version: 2, objects: [b, c] })).objects,
    ).toEqual([b, c]);
    expect(renderPlan([c])).toEqual([]);
    expect(transformSelection([c], [c.id], { x: 10, y: 0 })).toEqual([c]);
    expect(() =>
      parseProject(
        JSON.stringify({ version: 2, objects: [{ ...a, locked: "true" }] }),
      ),
    ).toThrow("boolean");
  });
  it("rejects extension of locked paths and ignores nudging outside Select mode", () => {
    useEditor.getState().extendPath(b.id);
    expect(useEditor.getState().draft).toEqual([]);
    useEditor.getState().select(a.id);
    useEditor.getState().setTool("path");
    useEditor.getState().nudge(10, 0);
    expect(useEditor.getState().station.objects[0]).toEqual(a);
  });
});
