import { describe, it, expect } from "vitest";
import { renderPlan, stackingOrder } from "./renderPlan";
import { parseProject, serializeProject } from "./projectFile";
import { useEditor } from "../store/editor";
import { example, type PathObject, type AreaObject } from "./station";
const a = example.objects[0] as PathObject,
  b = { ...a, id: "b", platformEdges: [] };
const area: AreaObject = {
  id: "surface",
  name: "Bridge",
  type: "area",
  kind: "road",
  z: 1,
  start: { x: 0, y: 0 },
  segments: [
    { type: "line", end: { x: 10, y: 0 } },
    { type: "line", end: { x: 10, y: 10 } },
    { type: "line", end: { x: 0, y: 0 } },
  ],
};
describe("render order", () => {
  it("draws every bed before any sleeper and every sleeper before any rail at the same level", () => {
    const plan = renderPlan([a, b]);
    expect(plan.map((p) => p.material)).toEqual([
      "bed",
      "bed",
      "sleepers",
      "sleepers",
      "rails",
      "rails",
      "edge",
    ]);
    expect(
      plan.filter((p) => p.material === "rails").map((p) => p.object.id),
    ).toEqual([a.id, b.id]);
  });
  it("draws complete levels in order, including surfaces above tracks and tracks above surfaces", () => {
    const bridge = { ...b, z: 2 };
    const plan = renderPlan([bridge, area, a]);
    expect(plan.map((p) => p.z)).toEqual([0, 0, 0, 0, 1, 2, 2, 2]);
    expect(plan.find((p) => p.material === "area")!.object).toBe(area);
    expect(stackingOrder([bridge, area, a]).map((o) => o.id)).toEqual([
      a.id,
      area.id,
      bridge.id,
    ]);
  });
  it("preserves levels in files and defaults legacy levels to ground", () => {
    expect(
      parseProject(serializeProject({ version: 2, objects: [area, b] }))
        .objects[0].z,
    ).toBe(1);
    const old = parseProject(JSON.stringify({ ...example, version: 1 }));
    expect(renderPlan(old.objects).every((p) => p.z === 0)).toBe(true);
    expect(() =>
      parseProject(
        JSON.stringify({ version: 2, objects: [{ ...area, z: 0.5 }] }),
      ),
    ).toThrow("integer");
  });
  it("undoes and redoes level changes with document history", () => {
    useEditor.getState().loadProject({ version: 2, objects: [b] }, true);
    useEditor.getState().commit([{ ...b, z: -1 }]);
    useEditor.getState().undo();
    expect(useEditor.getState().station.objects[0].z).toBeUndefined();
    useEditor.getState().redo();
    expect(useEditor.getState().station.objects[0].z).toBe(-1);
  });
});
