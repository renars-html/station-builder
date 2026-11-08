import { create } from "zustand";
import { example, type Station, type StationObject } from "../model/station";
import {
  draftGeometry,
  canAddControl,
  type DraftPoint,
} from "../model/pathDraft";
export type Tool = "select" | "pan" | "path" | "area";
interface Snapshot {
  station: Station;
  draft: DraftPoint[];
  tool: Tool;
}
interface Editor extends Snapshot {
  past: Snapshot[];
  future: Snapshot[];
  selected: string | null;
  loadProject: (station: Station, recovery?: boolean) => void;
  commit: (objects: StationObject[], finishDraft?: boolean) => void;
  setDraft: (draft: DraftPoint[]) => void;
  addPoint: (point: DraftPoint) => void;
  removeLastPoint: () => void;
  finishPath: () => void;
  select: (id: string | null) => void;
  setTool: (tool: Tool) => void;
  undo: () => void;
  redo: () => void;
  remove: () => void;
}
const snapshot = (s: Snapshot): Snapshot => ({
  station: s.station,
  draft: s.draft,
  tool: s.tool,
});
const history = (s: Editor) => ({
  past: [...s.past.slice(-99), snapshot(s)],
  future: [],
});
export const useEditor = create<Editor>((set, get) => ({
  station: structuredClone(example),
  draft: [],
  tool: "select",
  past: [],
  future: [],
  selected: null,
  loadProject: (station, recovery = false) =>
    set((s) => ({
      ...(recovery ? { past: [], future: [] } : history(s)),
      station: structuredClone(station),
      draft: [],
      selected: null,
      tool: "select",
    })),
  commit: (objects, finishDraft = false) =>
    set((s) => ({
      ...history(s),
      station: { version: 1, objects },
      ...(finishDraft ? { draft: [] } : {}),
    })),
  setDraft: (draft) =>
    set((s) =>
      s.draft.length === 0 && draft.length === 0
        ? {}
        : { ...history(s), draft },
    ),
  addPoint: (point) => {
    const s = get();
    if (s.tool !== "path" && s.tool !== "area") return;
    if (
      point.role === "control" &&
      (s.tool !== "path" || !canAddControl(s.draft))
    )
      return;
    s.setDraft([...s.draft, point]);
  },
  removeLastPoint: () => {
    const s = get();
    if (s.draft.length) s.setDraft(s.draft.slice(0, -1));
  },
  finishPath: () => {
    const s = get();
    if (s.tool !== "path" || s.draft.at(-1)?.role !== "standard") return;
    const geometry = draftGeometry(s.draft);
    if (!geometry?.segments.length) return;
    const object: StationObject = {
      id: crypto.randomUUID(),
      name: "Path",
      type: "path",
      kind: "placeholder",
      ...geometry,
    };
    s.commit([...s.station.objects, object], true);
    set({ selected: object.id });
  },
  select: (selected) => set({ selected }),
  setTool: (tool) =>
    set((s) =>
      s.tool === tool
        ? {}
        : s.draft.length
          ? { ...history(s), tool, draft: [] }
          : { tool },
    ),
  undo: () =>
    set((s) =>
      s.past.length
        ? {
            ...s.past[s.past.length - 1],
            past: s.past.slice(0, -1),
            future: [snapshot(s), ...s.future],
            selected: null,
          }
        : {},
    ),
  redo: () =>
    set((s) =>
      s.future.length
        ? {
            ...s.future[0],
            past: [...s.past, snapshot(s)],
            future: s.future.slice(1),
            selected: null,
          }
        : {},
    ),
  remove: () => {
    const s = get();
    if (s.selected) {
      s.commit(s.station.objects.filter((o) => o.id !== s.selected));
      set({ selected: null });
    }
  },
}));
