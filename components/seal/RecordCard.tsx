import Link from "next/link";
import type { Hex } from "viem";
import Panel from "@/components/ui/Panel";
import { addressUrl } from "@/lib/botchain/chain";
import { formatSealedAt, type SealRecord } from "@/lib/seal";

/**
 * One seal, as a receipt. Shared by the verify screen and the certificate page, which is why it
 * is a server component — the certificate has to render without a wallet or any JavaScript.
 */
export default function RecordCard({
  record,
  chainId,
  showLink = true,
}: {
  record: SealRecord;
  chainId: number;
  showLink?: boolean;
}) {
  return (
    <Panel>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ background: "var(--success)" }}
          />
          <span
            className="text-[11px] uppercase tracking-[0.06em]"
            style={{ color: "var(--success)" }}
          >
            Sealed
          </span>
        </div>

        <Row label="Digest">
          <span className="font-mono text-[12px] break-all" style={{ color: "var(--text-primary)" }}>
            {record.digest}
          </span>
        </Row>

        <Row label="Sealed at">
          <span className="font-mono text-[12px]" style={{ color: "var(--text-primary)" }}>
            {formatSealedAt(record.sealedAt)}
          </span>
        </Row>

        <Row label="Sealed by">
          <a
            href={addressUrl(chainId, record.sealer)}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[12px] break-all underline"
            style={{ color: "var(--accent)" }}
          >
            {record.sealer}
          </a>
        </Row>

        {/* The honest reading of the proof, next to the proof. A notary that lets a user believe
            this establishes authorship is worse than no notary — anyone who can compute the digest
            can seal it, and all the chain attests is that somebody did, by this block. */}
        <p
          className="text-[11px] leading-relaxed"
          style={{ color: "var(--text-tertiary)", borderTop: "1px solid var(--border-subtle)", paddingTop: "12px" }}
        >
          This proves the digest existed at or before this block, and that this address submitted
          it. It does not prove who wrote the file or who owns it.
        </p>

        {showLink && (
          <Link
            href={`/record/${record.digest}`}
            className="text-[11px] uppercase tracking-[0.04em] underline"
            style={{ color: "var(--accent)" }}
          >
            Shareable certificate
          </Link>
        )}
      </div>
    </Panel>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span
        className="text-[10px] uppercase tracking-[0.06em]"
        style={{ color: "var(--text-secondary)" }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

/** The other answer a verification can give. Deliberately not styled as an error. */
export function NotSealedCard({ digest }: { digest: Hex }) {
  return (
    <Panel>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ background: "var(--text-tertiary)" }}
          />
          <span
            className="text-[11px] uppercase tracking-[0.06em]"
            style={{ color: "var(--text-secondary)" }}
          >
            Not sealed
          </span>
        </div>
        <span className="font-mono text-[12px] break-all" style={{ color: "var(--text-tertiary)" }}>
          {digest}
        </span>
        <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          No record for this digest. Either it was never sealed, or the file differs from the one
          that was — a single changed byte produces a completely different digest.
        </p>
      </div>
    </Panel>
  );
}
