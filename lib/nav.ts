import type { NavItem } from "@/components/layout/PageShell";

/** Two screens. The certificate page is reached from a record, not from the nav. */
export const NAV: NavItem[] = [
  { href: "/", label: "Seal" },
  { href: "/verify", label: "Verify" },
];
