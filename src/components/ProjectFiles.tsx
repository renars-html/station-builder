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
  const { station, loadProject, draft } = useEditor();
  const [savedDocument, setSavedDocument] = useState<string | null>(null);
  const dirty = JSON.stringify(station) !== savedDocument;
  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty || draft.length) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty, draft.length]);
  const file = useRef<HTMLInputElement>(null),
    initialized = useRef(false),
    blocked = useRef(false),
    openRequest = useRef(0);
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
      setSavedDocument(JSON.stringify(station));
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
          const request = ++openRequest.current;
          try {
            if (chosen.size > MAX_PROJECT_BYTES)
              throw new Error("Project is too large (maximum 8 MB).");
            const next = parseProject(await chosen.text());
            if (request !== openRequest.current) return;
            blocked.current = false;
            loadProject(next);
            setSavedDocument(JSON.stringify(next));
            onLoaded();
            report(
              `Opened ${chosen.name}. Undo restores the previous project.`,
            );
          } catch (err) {
            if (request !== openRequest.current) return;
            report(
              `Open failed: ${err instanceof Error ? err.message : "file could not be read"}`,
              true,
            );
          }
        }}
      />
      <span className={"save-status " + (dirty ? "dirty" : "")}>
        {dirty ? "Unsaved JSON" : "JSON saved"}
      </span>
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
