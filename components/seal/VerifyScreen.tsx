"use client";

import { useCallback, useState } from "react";
import type { Hex } from "viem";
import { useChainId, useReadContract } from "wagmi";
import Panel from "@/components/ui/Panel";
import Input from "@/components/ui/Input";
import Spinner from "@/components/ui/Spinner";
import FileDrop, { type HashedFile } from "./FileDrop";
import RecordCard, { NotSealedCard } from "./RecordCard";
import { isBotChainId } from "@/lib/botchain/chain";
import { getDeployment, isDeployed } from "@/lib/botchain/deployment";
import { sealRegistryAbi } from "@/lib/botchain/abi";
import { parseDigest } from "@/lib/digest";

/**
 * Verification. No wallet required, which is the whole point — the person checking a seal is
 * usually not the person who made it.
 *
 * Two ways in, because the two have different trust properties. Dropping the file re-derives the
 * digest here and proves *this file* is the sealed one. Pasting a digest only looks up a record,
 * which is what you do when someone sent you a certificate and you have no file yet.
 */
export default function VerifyScreen() {
  const chainId = useChainId();
  const [digest, setDigest] = useState<Hex | null>(null);
  const [pasted, setPasted] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);

  const deployed = isBotChainId(chainId) && isDeployed(chainId);
  const deployment = isBotChainId(chainId) ? getDeployment(chainId) : null;

  const read = useReadContract({
    address: deployment?.address,
    abi: sealRegistryAbi,
    functionName: "recordOf",
    args: digest ? [digest] : undefined,
    query: { enabled: Boolean(digest && deployed) },
  });

  const handleFile = useCallback((file: HashedFile) => {
    setPasted("");
    setPasteError(null);
    setDigest(file.digest);
  }, []);

  const handlePaste = useCallback((value: string) => {
    setPasted(value);
    if (value.trim() === "") {
      setPasteError(null);
      setDigest(null);
      return;
    }
    const parsed = parseDigest(value);
    if (parsed) {
      setPasteError(null);
      setDigest(parsed);
    } else {
      setPasteError("That is not a 32-byte SHA-256 digest.");
      setDigest(null);
    }
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <FileDrop onHashed={handleFile} />

      <Panel>
        <Input
          label="Or paste a digest"
          value={pasted}
          onChange={(e) => handlePaste(e.target.value)}
          placeholder="0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"
          mono
          error={pasteError ?? undefined}
          hint={
            pasteError
              ? undefined
              : "Output of sha256sum, shasum -a 256 or Get-FileHash. With or without 0x."
          }
        />
      </Panel>

      {!deployed && digest && (
        <Panel>
          <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
            No registry is configured for this network, so there is nothing to check against.
          </p>
        </Panel>
      )}

      {digest && deployed && read.isLoading && (
        <Panel>
          <Spinner label="Reading the chain" />
        </Panel>
      )}

      {/* A failed read is not a "not sealed". Saying so would be the one wrong answer this screen
          can give: it would tell someone their document is unsealed when the node simply did not
          answer. */}
      {digest && deployed && read.isError && (
        <Panel>
          <p className="text-[12px]" style={{ color: "var(--warning)" }}>
            Could not reach the chain, so this is unknown rather than unsealed. Try again.
          </p>
        </Panel>
      )}

      {digest && deployed && read.isSuccess && (
        read.data.sealedAt === 0n ? (
          <NotSealedCard digest={digest} />
        ) : (
          <RecordCard
            record={{
              digest,
              sealer: read.data.sealer,
              sealedAt: Number(read.data.sealedAt),
            }}
            chainId={chainId}
          />
        )
      )}
    </div>
  );
}
