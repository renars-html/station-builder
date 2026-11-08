import { useEffect, useRef, useState } from "react";
import { FolderOpen, Download } from "lucide-react";
import { useEditor } from "../store/editor";
import {
  MAX_PROJECT_BYTES,
  parseProject,
  serializeProject,
} from "../model/projectFile";
const KEY = "yard.project.recovery.v1";
export default function ProjectFiles({ onLoaded }: { onLoaded: () => void }) {
  const { station, loadProject } = useEditor();
  const file = useRef<HTMLInputElement>(null),
    initialized = useRef(false),
    blocked = useRef(false);
  const [message, setMessage] = useState(""),
    [error, setError] = useState(false);
  const report = (text: string, isError = false) => {
    setMessage(text);
    setError(isError);
  };
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) {
        loadProject(parseProject(saved), true);
        onLoaded();
        report("Recovered the last project. Draft points are not recovered.");
      }
    } catch (e) {
      blocked.current = true;
      report(
        `Recovery unavailable: ${e instanceof Error ? e.message : "storage access failed"}. Save JSON to keep your work.`,
        true,
      );
    }
  }, []);
  useEffect(() => {
    if (!initialized.current || blocked.current) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(
          KEY,
          serializeProject(useEditor.getState().station),
        );
      } catch (e) {
        blocked.current = true;
        report(
          `Automatic recovery could not save: ${e instanceof Error ? e.message : "storage is full"}. Use Save JSON.`,
          true,
        );
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [station]);
  const save = () => {
    try {
      const blob = new Blob([serializeProject(station)], {
          type: "application/json",
        }),
        url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = "station-layout.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      report("Project saved as JSON.");
    } catch (e) {
      report(
        `Save failed: ${e instanceof Error ? e.message : "unknown error"}`,
        true,
      );
    }
  };
  return (
    <>
      <input
        aria-label="Open project JSON"
        ref={file}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={async (e) => {
          const chosen = e.target.files?.[0];
          e.target.value = "";
          if (!chosen) return;
          try {
            if (chosen.size > MAX_PROJECT_BYTES)
              throw new Error("Project is too large (maximum 8 MB).");
            const next = parseProject(await chosen.text());
            loadProject(next);
            onLoaded();
            report(
              `Opened ${chosen.name}. Undo restores the previous project.`,
            );
          } catch (err) {
            report(
              `Open failed: ${err instanceof Error ? err.message : "file could not be read"}`,
              true,
            );
          }
        }}
      />
      <button className="file-open" onClick={() => file.current?.click()}>
        <FolderOpen size={15} />
        Open JSON
      </button>
      <button className="export" onClick={save}>
        <Download size={15} />
        Save JSON
      </button>
      {message && (
        <div
          className={"project-message " + (error ? "error" : "")}
          role={error ? "alert" : "status"}
        >
          <span>{message}</span>
          <button aria-label="Dismiss message" onClick={() => setMessage("")}>
            ×
          </button>
        </div>
      )}
    </>
  );
}
