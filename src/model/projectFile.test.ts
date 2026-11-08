import { describe, it, expect } from "vitest";
import { example } from "./station";
import {
  parseProject,
  serializeProject,
  MAX_PROJECT_BYTES,
} from "./projectFile";
import { useEditor } from "../store/editor";
describe("project files", () => {
  it("round trips all geometry without changing IDs or coordinates", () => {
    const project = structuredClone(example);
    project.objects.push({
      id: "area",
      name: "Grass",
      type: "area",
      kind: "grass",
      start: { x: 0, y: 0 },
      segments: [
        { type: "line", end: { x: 10, y: 0 } },
        { type: "line", end: { x: 10, y: 10 } },
        { type: "line", end: { x: 0, y: 0 } },
      ],
    });
    expect(parseProject(serializeProject(project))).toEqual(project);
  });
  it.each([
    "invalid",
    "{}",
    '{"version":9,"objects":[]}',
    '{"version":1,"objects":[null]}',
  ])("rejects malformed project %s", (value) =>
    expect(() => parseProject(value)).toThrow(),
  );
  it("rejects duplicate IDs, nonfinite geometry, invalid ranges, and oversized input", () => {
    const project = structuredClone(example);
    project.objects.push(project.objects[0]);
    expect(() => parseProject(JSON.stringify(project))).toThrow("Duplicate");
    const bad = JSON.stringify(example).replace("425", "1e999");
    expect(() => parseProject(bad)).toThrow("finite");
    expect(() =>
      parseProject(JSON.stringify(example).replace('"end":1', '"end":0')),
    ).toThrow("precede");
    expect(() => parseProject(" ".repeat(MAX_PROJECT_BYTES + 1))).toThrow(
      "large",
    );
  });
  it("loads as one undoable transaction and preserves state on failed parse", () => {
    const s = useEditor.getState();
    s.loadProject(example, true);
    const initial = useEditor.getState().station;
    expect(() =>
      useEditor.getState().loadProject(parseProject("bad")),
    ).toThrow();
    expect(useEditor.getState().station).toBe(initial);
    useEditor.getState().loadProject({ version: 2, objects: [] });
    expect(useEditor.getState().draft).toEqual([]);
    useEditor.getState().undo();
    expect(useEditor.getState().station).toEqual(initial);
    useEditor.getState().redo();
    expect(useEditor.getState().station.objects).toEqual([]);
  });
});
