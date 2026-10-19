"use client";

import { ButtonHTMLAttributes, CSSProperties, forwardRef } from "react";

type Variant = "primary" | "ghost" | "danger";
type Size = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

/**
 * Letterpress, not UI chrome: square, inked, no radius, no uppercase tracking. The primary is a
 * solid block of ink the way a stamp is.
 */
const variantStyles: Record<Variant, CSSProperties> = {
  primary: { background: "var(--ink)", color: "var(--paper)", border: "1px solid var(--ink)" },
  ghost: { background: "transparent", border: "1px solid var(--rule-strong)", color: "var(--ink)" },
  danger: { background: "transparent", border: "1px solid var(--danger)", color: "var(--danger)" },
};

const sizeStyles: Record<Size, string> = {
  sm: "px-3 py-1.5 text-[14px]",
  md: "px-5 py-2.5 text-[16px]",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading, disabled, children, className = "", style, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={[
        "inline-flex items-center justify-center gap-2 font-medium transition-opacity",
        "cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed",
        sizeStyles[size],
        className,
      ].join(" ")}
      style={{ borderRadius: 0, ...variantStyles[variant], ...style }}
      {...props}
    >
      {loading ? (
        <>
          <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
          {children}
        </>
      ) : (
        children
      )}
    </button>
  ),
);

Button.displayName = "Button";
export default Button;
