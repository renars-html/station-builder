import { create } from "zustand";
import { example, type Station, type StationObject } from "../model/station";
export type Tool = "select" | "pan" | "path" | "area";
interface Editor {
  station: Station;
  past: Station[];
  future: Station[];
  selected: string | null;
  tool: Tool;
  commit: (objects: StationObject[]) => void;
  select: (id: string | null) => void;
  setTool: (tool: Tool) => void;
  undo: () => void;
  redo: () => void;
  remove: () => void;
}
export const useEditor = create<Editor>((set, get) => ({
  station: structuredClone(example),
  past: [],
  future: [],
  selected: null,
  tool: "select",
  commit: (objects) =>
    set((s) => ({
      station: { version: 1, objects },
      past: [...s.past.slice(-99), s.station],
      future: [],
    })),
  select: (selected) => set({ selected }),
  setTool: (tool) => set({ tool }),
  undo: () =>
    set((s) =>
      s.past.length
        ? {
            station: s.past[s.past.length - 1],
            past: s.past.slice(0, -1),
            future: [s.station, ...s.future],
            selected: null,
          }
        : {},
    ),
  redo: () =>
    set((s) =>
      s.future.length
        ? {
            station: s.future[0],
            past: [...s.past, s.station],
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
