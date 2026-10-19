"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ConnectButton from "@/components/ui/ConnectButton";
import NetworkBadge from "@/components/botchain/NetworkBadge";
import { app } from "@/lib/app-config";

export type NavItem = { href: string; label: string };

interface PageShellProps {
  children: React.ReactNode;
  nav?: NavItem[];
  title?: string;
  description?: string;
}

/**
 * Editorial shell: one narrow measure on paper.
 *
 * Seal's output is a document someone files or forwards, so the page is set like printed matter
 * rather than like an app — a 560px measure, a masthead rule instead of a header bar, navigation
 * as running text, and no panels anywhere. The 560px is a reading measure, not a breakpoint
 * choice: it is roughly 70 characters at this size, which is where prose stays comfortable.
 */
export default function PageShell({ children, nav = [], title, description }: PageShellProps) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col" style={{ minHeight: "100dvh", background: "var(--paper)" }}>
      <header className="mx-auto w-full px-6" style={{ maxWidth: "640px" }}>
        <div
          className="flex items-baseline justify-between gap-4 flex-wrap py-5"
          style={{ borderBottom: "2px solid var(--ink)" }}
        >
          <Link href="/" className="no-underline">
            <span
              className="text-[22px] font-semibold tracking-[-0.02em]"
              style={{ color: "var(--ink)" }}
            >
              {app.name}
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <NetworkBadge />
            <div style={{ width: "160px" }}>
              <ConnectButton />
            </div>
          </div>
        </div>

        {nav.length > 0 && (
          <nav
            className="flex items-center gap-5 py-3 text-[14px]"
            style={{ borderBottom: "1px solid var(--rule)" }}
          >
            {nav.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className="nav-link no-underline"
                  style={{
                    color: active ? "var(--ink)" : "var(--ink-faint)",
                    textDecoration: active ? "underline" : "none",
                    textUnderlineOffset: "4px",
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}
      </header>

      <main className="flex-1 mx-auto w-full px-6 py-10" style={{ maxWidth: "640px" }}>
        {title && (
          <h1 className="text-[34px] leading-[1.15] tracking-[-0.02em]" style={{ color: "var(--ink)" }}>
            {title}
          </h1>
        )}
        {description && (
          <p className="mt-3 text-[18px]" style={{ color: "var(--ink-soft)", maxWidth: "52ch" }}>
            {description}
          </p>
        )}
        <div className={title || description ? "mt-8" : ""}>{children}</div>
      </main>

      <footer
        className="mx-auto w-full px-6 py-8"
        style={{ maxWidth: "640px", borderTop: "1px solid var(--rule)" }}
      >
        <div className="flex flex-col gap-3">
          <p className="text-[14px]" style={{ color: "var(--ink-faint)" }}>
            {app.tagline}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
            <span style={{ color: "var(--ink-soft)" }}>Built on BOT Chain</span>
            <a href="https://botchain.ai" target="_blank" rel="noreferrer" style={{ color: "var(--ink-faint)" }}>
              botchain.ai
            </a>
            <a href="https://scan.botchain.ai" target="_blank" rel="noreferrer" style={{ color: "var(--ink-faint)" }}>
              BOT Chain Explorer
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
