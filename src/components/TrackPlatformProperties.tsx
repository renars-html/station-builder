import type { PathObject, TrackPlatformEdge } from "../model/station";
import { useEditor } from "../store/editor";
export interface EdgeEditing {
  pathId: string;
  edgeId: string;
}
export default function TrackPlatformProperties({
  track,
  editing,
  setEditing,
}: {
  track: PathObject;
  editing: EdgeEditing | null;
  setEditing: (value: EdgeEditing | null) => void;
}) {
  const { station, commit, setTool } = useEditor();
  const edge = track.platformEdges?.[0];
  const update = (edges: TrackPlatformEdge[]) =>
    commit(
      station.objects.map((o) =>
        o.id === track.id ? { ...track, platformEdges: edges } : o,
      ),
    );
  const patch = (changes: Partial<TrackPlatformEdge>) => {
    if (edge) update([{ ...edge, ...changes }]);
  };
  const isEditing = editing?.pathId === track.id && editing.edgeId === edge?.id;
  return (
    <section className="track-platform-properties">
      <h3>Platform edge</h3>
      {!edge ? (
        <button
          className="edge-action"
          onClick={() =>
            update([
              {
                id: crypto.randomUUID(),
                side: "right",
                distance: 0,
                start: 0,
                end: 1,
              },
            ])
          }
        >
          Add platform edge
        </button>
      ) : (
        <>
          <div className="property-stats">
            <div>
              <span>Side</span>
              <b>{edge.side === "left" ? "Left" : "Right"}</b>
            </div>
          </div>
          <button
            className="edge-action"
            onClick={() =>
              patch({ side: edge.side === "left" ? "right" : "left" })
            }
          >
            Flip side
          </button>
          <label>
            Distance from trackbed (m)
            <input
              type="number"
              min="0"
              step="0.1"
              value={edge.distance}
              onChange={(e) => {
                const value = e.target.valueAsNumber;
                if (Number.isFinite(value) && value >= 0)
                  patch({ distance: value });
              }}
            />
          </label>
          <div className="property-stats">
            <div>
              <span>Start along track</span>
              <b>{(edge.start * 100).toFixed(1)}%</b>
            </div>
            <div>
              <span>End along track</span>
              <b>{(edge.end * 100).toFixed(1)}%</b>
            </div>
          </div>
          <button
            className="edge-action"
            onClick={() => {
              setTool("select");
              setEditing(
                isEditing ? null : { pathId: track.id, edgeId: edge.id },
              );
            }}
          >
            {isEditing ? "Done editing" : "Edit start / end"}
          </button>
          {isEditing && (
            <p className="muted">
              Drag the green start and orange end handles along the track.
              Middle-click pans.
            </p>
          )}
          <p className="muted">
            Sides follow the direction from the track’s start to its end. Zero
            distance places the edge against the trackbed.
          </p>
          <button
            className="delete-button"
            onClick={() => {
              update([]);
              setEditing(null);
            }}
          >
            Remove platform edge
          </button>
        </>
      )}
    </section>
  );
}
