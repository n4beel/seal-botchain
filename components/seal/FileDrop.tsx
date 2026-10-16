"use client";

import { useCallback, useId, useRef, useState } from "react";
import type { Hex } from "viem";
import { DigestError, digestFile, formatBytes } from "@/lib/digest";

export type HashedFile = { name: string; size: number; digest: Hex };

/**
 * Pick or drop a file, and hash it here in the browser.
 *
 * The label says so, and it is not decoration: a user is about to hand this page a contract or a
 * manuscript, and the one thing they need to know before doing that is that it does not go
 * anywhere. There is no upload, no API route and no server in the path.
 *
 * It is a `<label>` wrapping a real `<input type="file">` rather than a div with a click handler,
 * so the keyboard and the screen reader both get a file picker for free.
 */
export default function FileDrop({
  onHashed,
  disabled,
}: {
  onHashed: (file: HashedFile) => void;
  disabled?: boolean;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<HashedFile | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setBusy(true);
      try {
        const digest = await digestFile(file);
        const hashed = { name: file.name, size: file.size, digest };
        setCurrent(hashed);
        onHashed(hashed);
      } catch (err) {
        setCurrent(null);
        setError(
          err instanceof DigestError
            ? err.message
            : "That file could not be read. Try choosing it again.",
        );
      } finally {
        setBusy(false);
        // Without this, choosing the same file twice in a row fires no change event, and the page
        // looks frozen to a user who is retrying after an error.
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [onHashed],
  );

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (disabled) return;
          const file = e.dataTransfer.files?.[0];
          if (file) void handleFile(file);
        }}
        className="flex flex-col items-center justify-center gap-1.5 px-5 py-8 text-center cursor-pointer transition-colors"
        style={{
          border: `1px dashed ${dragging ? "var(--accent)" : "var(--border-default)"}`,
          borderRadius: "4px",
          background: dragging ? "color-mix(in srgb, var(--accent) 6%, transparent)" : "var(--bg-surface)",
          opacity: disabled ? 0.5 : 1,
          pointerEvents: disabled ? "none" : undefined,
        }}
      >
        <span className="text-[13px]" style={{ color: "var(--text-primary)" }}>
          {busy ? "Hashing…" : current ? current.name : "Drop a file, or choose one"}
        </span>
        <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
          {current && !busy
            ? `${formatBytes(current.size)} · hashed in your browser`
            : "Hashed in your browser. The file is never uploaded."}
        </span>
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          className="sr-only"
          disabled={disabled}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
      </label>

      {error && (
        <p className="text-[11px] leading-relaxed" style={{ color: "var(--danger)" }} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
