import { beforeEach, describe, it, expect } from "vitest";
import { draftGeometry, type DraftPoint } from "./pathDraft";
import {
  pathData,
  points,
  setPoint,
  translate,
  type PathObject,
} from "./station";
import { useEditor } from "../store/editor";
const standard = (x: number, y = 0): DraftPoint => ({ x, y, role: "standard" });
const control = (x: number, y = 10): DraftPoint => ({ x, y, role: "control" });
const editor = () => useEditor.getState();
const add = (...draft: DraftPoint[]) =>
  draft.forEach((p) => editor().addPoint(p));
beforeEach(() =>
  useEditor.setState({
    station: { version: 1, objects: [] },
    tool: "path",
    draft: [],
    past: [],
    future: [],
    selected: null,
  }),
);
describe("standard and control points", () => {
  it("builds mixed line, quadratic and cubic segments with independent controls", () => {
    const geometry = draftGeometry([
      standard(0),
      standard(10),
      control(15),
      standard(20),
      control(25),
      control(30),
      standard(40),
    ])!;
    const path: PathObject = {
      id: "mixed",
      type: "path",
      kind: "placeholder",
      name: "Path",
      ...geometry,
    };
    expect(pathData(path)).toBe("M 0 0 L 10 0 Q 15 10 20 0 C 25 10 30 10 40 0");
    expect(points(path)).toHaveLength(7);
    expect(points(setPoint(path, 2, { x: 16, y: 12 }))[2]).toEqual({
      x: 16,
      y: 12,
    });
    expect(points(setPoint(path, 4, { x: 26, y: 12 }))[4]).toEqual({
      x: 26,
      y: 12,
    });
    expect(points(translate(path, 2, 3))).toEqual(
      points(path).map((p) => ({ x: p.x + 2, y: p.y + 3 })),
    );
    expect(path.segments[1]).toEqual({
      type: "quadratic",
      control: { x: 15, y: 10 },
      end: { x: 20, y: 0 },
    });
  });
  it("rejects initial controls and limits each interval to two controls", () => {
    add(control(0));
    expect(editor().draft).toHaveLength(0);
    add(standard(0), control(5), control(10), control(15));
    expect(editor().draft).toHaveLength(3);
    add(standard(20), control(25));
    expect(editor().draft).toHaveLength(5);
  });
  it("does not finish an empty draft, lone point, or pending controls", () => {
    editor().finishPath();
    add(standard(0));
    editor().finishPath();
    add(standard(10), control(15));
    editor().finishPath();
    expect(editor().station.objects).toHaveLength(0);
    expect(editor().draft).toHaveLength(3);
  });
  it("removing a point can change a quadratic segment back to a line", () => {
    add(standard(0), control(5));
    editor().removeLastPoint();
    add(standard(10));
    editor().finishPath();
    const path = editor().station.objects[0] as PathObject;
    expect(path.segments).toEqual([{ type: "line", end: { x: 10, y: 0 } }]);
  });
});
describe("drawing history", () => {
  it("undoes and redoes every placement and removal, preserving point roles", () => {
    const draft = [standard(0), control(10), control(20), standard(30)];
    add(...draft);
    editor().removeLastPoint();
    expect(editor().draft).toEqual(draft.slice(0, -1));
    editor().undo();
    expect(editor().draft).toEqual(draft);
    editor().undo();
    expect(editor().draft).toEqual(draft.slice(0, -1));
    editor().undo();
    expect(editor().draft).toEqual(draft.slice(0, 2));
    editor().redo();
    editor().redo();
    expect(editor().draft).toEqual(draft);
    editor().redo();
    expect(editor().draft).toEqual(draft.slice(0, -1));
  });
  it("undoes finishing atomically into an editable draft, then redoes the same object", () => {
    const draft = [standard(0), control(10), standard(20)];
    add(...draft);
    editor().finishPath();
    const finished = editor().station.objects[0];
    expect(editor().draft).toEqual([]);
    editor().undo();
    expect(editor().station.objects).toEqual([]);
    expect(editor().draft).toEqual(draft);
    editor().redo();
    expect(editor().station.objects).toEqual([finished]);
    expect(editor().draft).toEqual([]);
  });
  it("reopens a cancelled draft and restores its tool after switching tools", () => {
    add(standard(0), control(10));
    const draft = editor().draft;
    editor().setTool("select");
    expect(editor().draft).toEqual([]);
    editor().undo();
    expect(editor().draft).toEqual(draft);
    expect(editor().tool).toBe("path");
    editor().setDraft([]);
    editor().undo();
    expect(editor().draft).toEqual(draft);
  });
  it("clears redo when drawing branches and ignores removal from an empty draft", () => {
    editor().removeLastPoint();
    expect(editor().past).toEqual([]);
    add(standard(0), control(10));
    editor().undo();
    add(standard(20));
    expect(editor().future).toEqual([]);
    editor().redo();
    expect(editor().draft).toEqual([standard(0), standard(20)]);
  });
});
