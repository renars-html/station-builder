import { describe, it, expect } from "vitest";
import {
  example,
  pathData,
  points,
  setPoint,
  translate,
  type PathObject,
} from "./station";
import { useEditor } from "../store/editor";
describe("world geometry", () => {
  const path: PathObject = {
    id: "test",
    name: "Mixed",
    type: "path",
    kind: "track",
    start: { x: 0, y: 0 },
    segments: [
      { type: "line", end: { x: 10, y: 0 } },
      {
        type: "cubic",
        control1: { x: 20, y: 0 },
        control2: { x: 20, y: 30 },
        end: { x: 40, y: 30 },
      },
    ],
  };
  it("serializes mixed paths without rendering dependencies", () => {
    expect(pathData(path)).toBe("M 0 0 L 10 0 C 20 0 20 30 40 30");
    expect(JSON.parse(JSON.stringify(example))).toEqual(example);
  });
  it("moves all anchors and controls without mutating the source", () => {
    const moved = translate(path, 5, -3);
    expect(points(moved)).toEqual(
      points(path).map((p) => ({ x: p.x + 5, y: p.y - 3 })),
    );
    expect(path.start).toEqual({ x: 0, y: 0 });
  });
  it("edits a control point without changing endpoints", () => {
    const edited = setPoint(path, 3, { x: 25, y: 35 });
    expect(points(edited)[3]).toEqual({ x: 25, y: 35 });
    expect(points(edited)[4]).toEqual({ x: 40, y: 30 });
    expect(points(path)[3]).toEqual({ x: 20, y: 30 });
  });
  it("changes a placeholder path type without losing geometry and supports undo", () => {
    const placeholder: PathObject = { ...path, kind: "placeholder" };
    useEditor.getState().commit([placeholder]);
    const track: PathObject = { ...placeholder, kind: "track" };
    useEditor.getState().commit([track]);
    expect(points(useEditor.getState().station.objects[0])).toEqual(
      points(placeholder),
    );
    expect(pathData(track)).toEqual(pathData(placeholder));
    useEditor.getState().undo();
    expect(useEditor.getState().station.objects).toEqual([placeholder]);
    useEditor.getState().redo();
    expect(useEditor.getState().station.objects).toEqual([track]);
  });
  it("restores edits and deletion with undo and redo and clears redo on branching", () => {
    const original = useEditor.getState().station;
    useEditor.getState().commit([path]);
    useEditor.getState().select("test");
    useEditor.getState().remove();
    expect(useEditor.getState().station.objects).toHaveLength(0);
    useEditor.getState().undo();
    expect(useEditor.getState().station.objects).toEqual([path]);
    useEditor.getState().redo();
    expect(useEditor.getState().station.objects).toHaveLength(0);
    useEditor.getState().undo();
    useEditor
      .getState()
      .commit(original.objects.map((o) => ({ ...o, name: "Branched edit" })));
    expect(useEditor.getState().future).toHaveLength(0);
  });
});
