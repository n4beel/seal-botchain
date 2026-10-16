import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PageShell from "@/components/layout/PageShell";
import Panel from "@/components/ui/Panel";
import RecordCard, { NotSealedCard } from "@/components/seal/RecordCard";
import { NAV } from "@/lib/nav";
import { activeBotChain } from "@/lib/botchain/chain";
import { isDeployed } from "@/lib/botchain/deployment";
import { parseDigest } from "@/lib/digest";
import { readClient, readRecord, formatSealedAt } from "@/lib/seal";

/**
 * The shareable certificate.
 *
 * A server component, reading the chain directly with viem rather than through wagmi's hooks. The
 * whole purpose of this page is to be a link sent to a counterparty, a client or a court, so it
 * has to render for someone with no wallet, no extension and JavaScript off. That rules out any
 * read that happens in the browser.
 *
 * It is rendered per request, not cached: a digest that was unsealed a minute ago may be sealed
 * now, and a certificate that serves a stale "not sealed" is worse than a slow one.
 */
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ digest: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { digest } = await params;
  const parsed = parseDigest(decodeURIComponent(digest));
  if (!parsed) return { title: "Not a digest — Seal" };

  // Deliberately no chain read here. Metadata generation runs on every crawl, and a link preview
  // is not worth an RPC call that can hang the response.
  return {
    title: `${parsed.slice(0, 10)}… — Seal`,
    description: "A file digest timestamped on BOT Chain.",
  };
}

export default async function RecordPage({ params }: Params) {
  const { digest: raw } = await params;
  const digest = parseDigest(decodeURIComponent(raw));

  if (!digest) notFound();

  if (!isDeployed(activeBotChain.id)) {
    return (
      <Certificate>
        <Panel>
          <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
            No registry is configured for {activeBotChain.name}, so there is nothing to look up.
          </p>
        </Panel>
      </Certificate>
    );
  }

  let record;
  try {
    record = await readRecord(readClient(), activeBotChain.id, digest);
  } catch {
    // "Unknown" and "not sealed" are different answers, and conflating them on a page someone was
    // sent as proof is the worst thing this page could do.
    return (
      <Certificate>
        <Panel>
          <p className="text-[12px]" style={{ color: "var(--warning)" }}>
            Could not reach {activeBotChain.name}. This is unknown, not unsealed — reload to try
            again.
          </p>
          <p className="mt-2 font-mono text-[12px] break-all" style={{ color: "var(--text-tertiary)" }}>
            {digest}
          </p>
        </Panel>
      </Certificate>
    );
  }

  return (
    <Certificate
      subtitle={
        record
          ? `Timestamped on ${activeBotChain.name} at ${formatSealedAt(record.sealedAt)}.`
          : "No record found for this digest."
      }
    >
      {record ? (
        <RecordCard record={record} chainId={activeBotChain.id} showLink={false} />
      ) : (
        <NotSealedCard digest={digest} />
      )}

      <Panel>
        <p
          className="text-[11px] uppercase tracking-[0.06em] mb-2"
          style={{ color: "var(--text-secondary)" }}
        >
          Check it yourself
        </p>
        <p className="text-[12px] leading-relaxed mb-3" style={{ color: "var(--text-secondary)" }}>
          Nothing here has to be taken on trust. Hash the file with the tool your machine already
          has, and compare:
        </p>
        <pre
          className="font-mono text-[11px] overflow-x-auto p-3"
          style={{ background: "var(--bg-base)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}
        >
{`sha256sum <file>            # Linux
shasum -a 256 <file>        # macOS
Get-FileHash <file>         # Windows`}
        </pre>
      </Panel>
    </Certificate>
  );
}

function Certificate({
  children,
  subtitle,
}: {
  children: React.ReactNode;
  subtitle?: string;
}) {
  return (
    <PageShell nav={NAV} title="Certificate" description={subtitle}>
      <div className="flex flex-col gap-4">{children}</div>
    </PageShell>
  );
}
