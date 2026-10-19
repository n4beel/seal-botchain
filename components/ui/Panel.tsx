import { HTMLAttributes } from "react";

interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
  noPadding?: boolean;
}

/**
 * Not a panel. On paper a grouped block is a ruled section, so this draws a hairline above the
 * content and nothing else — no border box, no fill, no radius. The prop signature is kept so the
 * shared gate and status components can use it unchanged.
 */
export default function Panel({
  elevated,
  noPadding,
  children,
  className = "",
  style,
  ...props
}: PanelProps) {
  return (
    <div
      className={[noPadding ? "" : "py-6", className].join(" ")}
      style={{
        borderTop: "1px solid var(--rule)",
        background: elevated ? "var(--paper-sunk)" : "transparent",
        paddingLeft: elevated ? "20px" : undefined,
        paddingRight: elevated ? "20px" : undefined,
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}
