import { describe, it, expect } from "vitest";
import {
  attachedBands,
  pointAlong,
  projectAlong,
  sliceAlong,
} from "./trackPlatform";
import { flattenPath } from "./pathAppearance";
import { translate, type PathObject, type TrackPlatformEdge } from "./station";
import { useEditor } from "../store/editor";
const center = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 20 },
];
const edge: TrackPlatformEdge = {
  id: "edge",
  side: "right",
  distance: 0,
  start: 0,
  end: 1,
};
describe("track-attached platform geometry", () => {
  it("locates and clips endpoints by distance along a multi-segment track", () => {
    expect(pointAlong(center, 0.5)).toEqual({ x: 10, y: 5 });
    expect(sliceAlong(center, 0.2, 0.8)).toEqual([
      { x: 6, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 14 },
    ]);
  });
  it("projects dragged points onto the track and clamps beyond endpoints", () => {
    expect(projectAlong(center, { x: 12, y: 7 })).toBeCloseTo(17 / 30);
    expect(projectAlong(center, { x: -5, y: 0 })).toBe(0);
    expect(projectAlong(center, { x: 10, y: 40 })).toBe(1);
  });
  it("places the first strip against either side of the bed and respects distance and range", () => {
    const straight = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ];
    const right = attachedBands(straight, { ...edge, start: 0.2, end: 0.8 });
    expect(right[0].points).toEqual([20, 1.7, 80, 1.7, 80, 1.9, 20, 1.9]);
    const left = attachedBands(straight, {
      ...edge,
      side: "left",
      distance: 2,
    });
    expect(left[0].points[1]).toBeCloseTo(-3.7);
    expect(left[0].points[5]).toBeCloseTo(-3.9);
    expect(
      attachedBands(straight, { ...edge, start: 0.5, end: 0.5 })[0].points,
    ).toEqual([]);
  });
  it("keeps attached edges on curved and translated tracks without storing duplicate geometry", () => {
    const track: PathObject = {
      id: "track",
      name: "Track",
      type: "path",
      kind: "track",
      start: { x: 0, y: 0 },
      segments: [
        { type: "quadratic", control: { x: 50, y: 50 }, end: { x: 100, y: 0 } },
      ],
      platformEdges: [{ ...edge, start: 0.1, end: 0.9 }],
    };
    const samples = flattenPath(track),
      p = pointAlong(samples, 0.35);
    expect(projectAlong(samples, p)).toBeCloseTo(0.35);
    const moved = translate(track, 20, 30) as PathObject;
    const original = attachedBands(samples, track.platformEdges![0])[0].points;
    const shifted = attachedBands(
      flattenPath(moved),
      moved.platformEdges![0],
    )[0].points;
    original.forEach((v, i) =>
      expect(shifted[i]).toBeCloseTo(v + (i % 2 ? 30 : 20)),
    );
    expect(moved.platformEdges).toEqual(track.platformEdges);
  });
  it("undoes and redoes attachment property and range edits together with the document", () => {
    const track: PathObject = {
      id: "track",
      name: "Track",
      type: "path",
      kind: "track",
      start: { x: 0, y: 0 },
      segments: [{ type: "line", end: { x: 100, y: 0 } }],
    };
    useEditor.setState({
      station: { version: 2, objects: [track] },
      draft: [],
      past: [],
      future: [],
      tool: "select",
      selected: "track",
    });
    useEditor.getState().commit([{ ...track, platformEdges: [edge] }]);
    const edited = {
      ...track,
      platformEdges: [
        { ...edge, side: "left" as const, distance: 3, start: 0.25, end: 0.75 },
      ],
    };
    useEditor.getState().commit([edited]);
    useEditor.getState().undo();
    expect(
      (useEditor.getState().station.objects[0] as PathObject).platformEdges,
    ).toEqual([edge]);
    useEditor.getState().undo();
    expect(useEditor.getState().station.objects).toEqual([track]);
    useEditor.getState().redo();
    useEditor.getState().redo();
    expect(useEditor.getState().station.objects).toEqual([edited]);
  });
});
