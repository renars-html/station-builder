import { transformSelection } from "../model/selection";
import { areaFromDraft, areaSize } from "../model/areaGeometry";
import { pathDraft } from "../model/pathEditing";
import { pathLength } from "../model/pathMeasurements";
import { create } from "zustand";
import {
  example,
  type Station,
  type AreaKind,
  type StationObject,
} from "../model/station";
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
  editingObjectId: string | null;
}
interface Editor extends Snapshot {
  error: string | null;
  clearError: () => void;
  past: Snapshot[];
  future: Snapshot[];
  selected: string | null;
  selection: string[];
  selectMany: (ids: string[]) => void;
  nudge: (dx: number, dy: number) => void;
  loadProject: (station: Station, recovery?: boolean) => void;
  commit: (objects: StationObject[], finishDraft?: boolean) => void;
  setDraft: (draft: DraftPoint[]) => void;
  addPoint: (point: DraftPoint) => void;
  removeLastPoint: () => void;
  finishPath: () => void;
  finishArea: (kind: AreaKind) => void;
  extendPath: (id: string) => void;
  select: (id: string | null, additive?: boolean) => void;
  setTool: (tool: Tool) => void;
  undo: () => void;
  redo: () => void;
  remove: () => void;
}
const snapshot = (s: Snapshot): Snapshot => ({
  station: s.station,
  draft: s.draft,
  tool: s.tool,
  editingObjectId: s.editingObjectId,
});
const history = (s: Editor) => ({
  past: [...s.past.slice(-99), snapshot(s)],
  future: [],
});
export const useEditor = create<Editor>((set, get) => ({
  error: null,
  clearError: () => set({ error: null }),
  station: structuredClone(example),
  draft: [],
  tool: "select",
  editingObjectId: null,
  past: [],
  future: [],
  selected: null,
  selection: [],
  loadProject: (station, recovery = false) =>
    set((s) => ({
      ...(recovery ? { past: [], future: [] } : history(s)),
      station: structuredClone(station),
      draft: [],
      selected: null,
      selection: [],
      editingObjectId: null,
      error: null,
      tool: "select",
    })),
  commit: (objects, finishDraft = false) => {
    if (
      objects.some((o) =>
        o.type === "area" ? areaSize(o) < 1e-6 : pathLength(o) < 1e-6,
      )
    ) {
      set({
        error:
          "Edit rejected: paths need nonzero length and areas must enclose a nonzero surface.",
      });
      return;
    }
    if (
      !finishDraft &&
      JSON.stringify(objects) === JSON.stringify(get().station.objects)
    )
      return;
    set((s) => ({
      ...history(s),
      error: null,
      station: { version: 2, objects },
      ...(finishDraft ? { draft: [], editingObjectId: null } : {}),
    }));
  },
  setDraft: (draft) =>
    set((s) =>
      s.draft.length === 0 && draft.length === 0
        ? {}
        : {
            ...history(s),
            draft,
            ...(!draft.length ? { editingObjectId: null } : {}),
          },
    ),
  addPoint: (point) => {
    const s = get();
    if (s.tool !== "path" && s.tool !== "area") return;
    if (point.role === "control" && !canAddControl(s.draft)) return;
    set({ error: null });
    s.setDraft([...s.draft, point]);
  },
  removeLastPoint: () => {
    const s = get();
    if (s.draft.length) s.setDraft(s.draft.slice(0, -1));
  },
  extendPath: (id) => {
    const s = get(),
      object = s.station.objects.find((o) => o.id === id);
    if (object?.type !== "path" || object.locked || object.hidden) return;
    set({
      ...history(s),
      tool: "path",
      draft: pathDraft(object),
      editingObjectId: id,
      selected: id,
      selection: [id],
    });
  },
  finishArea: (kind) => {
    const s = get();
    if (s.tool !== "area") return;
    const geometry = areaFromDraft(s.draft);
    if (!geometry) {
      set({
        error:
          "An area needs three distinct standard points and a nonzero enclosed area.",
      });
      return;
    }
    const object: StationObject = {
      id: crypto.randomUUID(),
      name: kind[0].toUpperCase() + kind.slice(1) + " area",
      type: "area",
      kind,
      ...geometry,
    };
    s.commit([...s.station.objects, object], true);
    set({ selected: object.id, selection: [object.id] });
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
    if (pathLength(object) < 1e-6) {
      set({
        error: "Path has no length. Move or add a point before finishing.",
      });
      return;
    }
    const original = s.station.objects.find((o) => o.id === s.editingObjectId);
    const next =
      original?.type === "path"
        ? { ...original, start: object.start, segments: object.segments }
        : object;
    s.commit(
      original
        ? s.station.objects.map((o) => (o.id === original.id ? next : o))
        : [...s.station.objects, next],
      true,
    );
    set({ selected: next.id, selection: [next.id] });
  },
  select: (id, additive = false) =>
    set((s) => {
      const selection =
        id === null
          ? []
          : additive
            ? s.selection.includes(id)
              ? s.selection.filter((v) => v !== id)
              : [...s.selection, id]
            : [id];
      return { selection, selected: selection.at(-1) ?? null };
    }),
  selectMany: (ids) => {
    const valid = [...new Set(ids)].filter((id) =>
      get().station.objects.some((o) => o.id === id && !o.hidden),
    );
    set({ selection: valid, selected: valid.at(-1) ?? null });
  },
  nudge: (dx, dy) => {
    const s = get();
    if (s.tool !== "select") return;
    s.commit(
      transformSelection(
        s.station.objects,
        s.selection.length ? s.selection : s.selected ? [s.selected] : [],
        { x: dx, y: dy },
      ),
    );
  },
  setTool: (tool) =>
    set((s) =>
      s.tool === tool
        ? {}
        : s.draft.length
          ? { ...history(s), tool, draft: [], editingObjectId: null }
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
            error: null,
            selection: [],
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
            error: null,
            selection: [],
          }
        : {},
    ),
  remove: () => {
    const s = get(),
      ids = s.selection.length ? s.selection : s.selected ? [s.selected] : [];
    const removed = new Set(
      s.station.objects
        .filter((o) => ids.includes(o.id) && !o.locked)
        .map((o) => o.id),
    );
    if (!removed.size) return;
    s.commit(s.station.objects.filter((o) => !removed.has(o.id)));
    const selection = s.selection.filter((id) => !removed.has(id));
    set({ selection, selected: selection.at(-1) ?? null });
  },
}));
