import { useEffect, useRef, useState } from "react";
export default function CommittedInput({
  value,
  onCommit,
  numeric,
  min = -Infinity,
  max = Infinity,
  integer = false,
}: {
  value: string | number;
  onCommit: (value: string) => void;
  numeric?: boolean;
  min?: number;
  max?: number;
  integer?: boolean;
}) {
  const [draft, setDraft] = useState(String(value)),
    [error, setError] = useState("");
  const cancelled = useRef(false);
  useEffect(() => {
    setDraft(String(value));
    setError("");
  }, [value]);
  const commit = () => {
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    if (
      numeric &&
      (draft.trim() === "" ||
        !Number.isFinite(Number(draft)) ||
        Number(draft) < min ||
        Number(draft) > max ||
        (integer && !Number.isInteger(Number(draft))))
    ) {
      setError(
        `Enter ${integer ? "an integer" : "a number"} between ${min} and ${max}.`,
      );
      setDraft(String(value));
      return;
    }
    setError("");
    if (draft !== String(value)) onCommit(draft);
  };
  return (
    <>
      <input
        type={numeric ? "number" : "text"}
        value={draft}
        maxLength={numeric ? undefined : 200}
        min={numeric ? min : undefined}
        max={numeric ? max : undefined}
        step={integer ? 1 : "any"}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            e.currentTarget.blur();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            cancelled.current = true;
            setDraft(String(value));
            setError("");
            e.currentTarget.blur();
          }
        }}
      />
      {error && (
        <span className="input-error" role="alert">
          {error}
        </span>
      )}
    </>
  );
}
