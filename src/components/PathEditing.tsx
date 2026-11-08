import { useState } from "react";
import type { PathObject } from "../model/station";
import { splitSegment, removeSegment } from "../model/pathEditing";
import { useEditor } from "../store/editor";
export default function PathEditing({ path }: { path: PathObject }) {
  const { station, commit, extendPath } = useEditor();
  const [index, setIndex] = useState(0);
  const current = Math.min(index, path.segments.length - 1);
  const update = (next: PathObject) =>
    commit(station.objects.map((o) => (o.id === path.id ? next : o)));
  return (
    <section className="path-editing">
      <h3>Path editing</h3>
      <button className="edge-action" onClick={() => extendPath(path.id)}>
        Extend from end
      </button>
      <label>
        Segment
        <select
          value={current}
          onChange={(e) => setIndex(Number(e.target.value))}
        >
          {path.segments.map((s, i) => (
            <option key={i} value={i}>
              {i + 1} · {s.type}
            </option>
          ))}
        </select>
      </label>
      <button
        className="edge-action"
        onClick={() => update(splitSegment(path, current))}
      >
        Insert midpoint
      </button>
      <button
        className="delete-button"
        disabled={path.segments.length <= 1}
        onClick={() => update(removeSegment(path, current))}
      >
        Remove segment
      </button>
      <p className="muted">
        Drag outlined nodes to reshape. Midpoint insertion preserves curves.
        Extend uses the normal path drawing controls.
      </p>
    </section>
  );
}
