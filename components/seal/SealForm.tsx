"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BaseError, ContractFunctionRevertedError, type Hex } from "viem";
import {
  useAccount,
  useChainId,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import Panel from "@/components/ui/Panel";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import TxStatus, { type TxStage } from "@/components/ui/TxStatus";
import { useToast } from "@/components/ui/Toast";
import RecordCard from "./RecordCard";
import { isBotChainId } from "@/lib/botchain/chain";
import { getDeployment } from "@/lib/botchain/deployment";
import { sealRegistryAbi } from "@/lib/botchain/abi";
import { labelByteLength, MAX_LABEL_BYTES, truncateLabel, type SealRecord } from "@/lib/seal";
import { shortDigest } from "@/lib/digest";

/**
 * The one transaction this app exists to make.
 *
 * The digest is read back from the chain before the Seal button is offered. That read is the point
 * of this component: first seal wins, so sealing an already-sealed digest is a guaranteed revert,
 * and on a chain whose native token has no faucet a guaranteed revert is a user paying real money
 * to be told no. Finding the existing record first turns that into an answer.
 */
export default function SealForm({
  digest,
  suggestedLabel,
}: {
  digest: Hex | null;
  suggestedLabel?: string;
}) {
  const chainId = useChainId();
  const { address } = useAccount();
  const { toast } = useToast();
  const { writeContractAsync } = useWriteContract();

  const [label, setLabel] = useState("");
  const [stage, setStage] = useState<TxStage>("idle");
  const [hash, setHash] = useState<Hex | null>(null);
  const [collision, setCollision] = useState<SealRecord | null>(null);

  const deployment = isBotChainId(chainId) ? getDeployment(chainId) : null;

  // Pre-fill from the file name, trimmed to the contract's byte budget rather than left to
  // revert. A user who never chose a label should not be the one to discover the limit.
  useEffect(() => {
    setLabel(suggestedLabel ? truncateLabel(suggestedLabel) : "");
    setStage("idle");
    setHash(null);
    setCollision(null);
  }, [digest, suggestedLabel]);

  const existing = useReadContract({
    address: deployment?.address,
    abi: sealRegistryAbi,
    functionName: "recordOf",
    args: digest ? [digest] : undefined,
    query: { enabled: Boolean(digest && deployment) },
  });

  const alreadySealed: SealRecord | null = useMemo(() => {
    if (collision) return collision;
    const record = existing.data;
    if (!digest || !record || record.sealedAt === 0n) return null;
    return { digest, sealer: record.sealer, sealedAt: Number(record.sealedAt) };
  }, [collision, existing.data, digest]);

  const receipt = useWaitForTransactionReceipt({
    hash: hash ?? undefined,
    query: { enabled: Boolean(hash) },
  });

  /**
   * One settlement per transaction, keyed by its hash.
   *
   * This replaces two effects that keyed off `receipt.isSuccess` / `receipt.isError` alone. The
   * success one also listed the whole `useReadContract` result in its dependencies, and that
   * object is a fresh identity on every render — so once a receipt arrived the effect ran on
   * *every* render, each run firing a toast, each toast setting state in the provider, each render
   * handing the effect a new object. React stopped it with "Maximum update depth exceeded", and
   * the stack blamed `ToastProvider` in the root layout rather than this file.
   *
   * A ref holding the hash already settled is what makes this fire once. It is a ref rather than
   * state because changing it must not itself cause a render — that is the loop this is escaping.
   */
  const settledHash = useRef<Hex | null>(null);
  // Pulled out so the effect depends on the function, not on the query object that wraps it.
  // react-query keeps `refetch` stable across renders; the result object around it is not.
  const refetchExisting = existing.refetch;

  useEffect(() => {
    if (!hash || settledHash.current === hash) return;
    if (!receipt.isSuccess && !receipt.isError) return;

    settledHash.current = hash;

    if (receipt.isSuccess) {
      setStage("confirmed");
      toast("success", "Sealed", "The digest is now timestamped on chain.");
      // The record shown afterwards comes from the chain, not from local state, so a reload or a
      // shared link shows exactly what a third party would see.
      void refetchExisting();
    } else {
      setStage("failed");
      toast("error", "Transaction failed", "Nothing was recorded. Check the explorer and try again.");
    }
  }, [hash, receipt.isSuccess, receipt.isError, toast, refetchExisting]);

  const labelBytes = labelByteLength(label);
  const labelTooLong = labelBytes > MAX_LABEL_BYTES;

  const handleSeal = useCallback(async () => {
    if (!digest || !deployment || !isBotChainId(chainId) || labelTooLong) return;

    setStage("signing");
    setHash(null);
    settledHash.current = null;
    try {
      const txHash = await writeContractAsync({
        address: deployment.address,
        abi: sealRegistryAbi,
        functionName: "seal",
        args: [digest, label],
        chainId,
      });
      setHash(txHash);
      setStage("pending");
    } catch (err) {
      setStage("idle");

      // `AlreadySealed` carries the record that beat this one. It can genuinely happen here even
      // after the pre-check: two people sealing the same digest in the same few seconds. Decoding
      // it turns "transaction failed" into who got there first, and when.
      const reverted = err instanceof BaseError
        ? err.walk((e) => e instanceof ContractFunctionRevertedError)
        : null;

      if (reverted instanceof ContractFunctionRevertedError) {
        const error = reverted.data;
        if (error?.errorName === "AlreadySealed") {
          const [collidedDigest, sealer, sealedAt] = error.args as [Hex, Hex, bigint];
          setCollision({ digest: collidedDigest, sealer, sealedAt: Number(sealedAt) });
          toast("warning", "Already sealed", "Someone sealed this digest first.");
          return;
        }
        if (error?.errorName === "LabelTooLong") {
          toast("error", "Label too long", `Keep it under ${MAX_LABEL_BYTES} bytes.`);
          return;
        }
        if (error?.errorName === "EmptyDigest") {
          toast("error", "Empty digest", "That is not a file this app can seal.");
          return;
        }
      }

      // A rejection in the wallet is the common case and is not a failure worth a red banner.
      const message = err instanceof BaseError ? err.shortMessage : "Something went wrong.";
      if (/rejected|denied/i.test(message)) {
        toast("info", "Cancelled", "Nothing was sent.");
      } else {
        toast("error", "Could not send", message);
      }
    }
  }, [digest, deployment, chainId, label, labelTooLong, writeContractAsync, toast]);

  if (!digest) {
    return (
      <Panel>
        <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
          Choose a file above, and its digest appears here ready to seal.
        </p>
      </Panel>
    );
  }

  // Checked before `alreadySealed`, and the order matters. Confirming a seal refetches the record,
  // which immediately makes `alreadySealed` true — so with the other branch first, the moment a
  // seal succeeded the screen replaced it with "you already sealed this, nothing to pay for
  // twice". That reads as a rejection of the thing that just worked, and it threw away the
  // transaction hash, which is the one artifact worth keeping.
  if (stage === "confirmed") {
    return (
      <div className="flex flex-col gap-3">
        {alreadySealed && <RecordCard record={alreadySealed} chainId={chainId} />}
        <Panel>
          <div className="flex flex-col gap-3">
            <TxStatus stage="confirmed" hash={hash} confirmedLabel="Sealed on chain" />
            <a
              href={`/record/${digest}`}
              className="text-[11px] uppercase tracking-[0.04em] underline"
              style={{ color: "var(--accent)" }}
            >
              Open the shareable certificate
            </a>
          </div>
        </Panel>
      </div>
    );
  }

  if (alreadySealed) {
    const mine = address && alreadySealed.sealer.toLowerCase() === address.toLowerCase();
    return (
      <div className="flex flex-col gap-2">
        <RecordCard record={alreadySealed} chainId={chainId} />
        <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
          {mine
            ? "You already sealed this. The first timestamp is the one that counts, so there is nothing to pay for twice."
            : "This digest is already sealed, by another address. First seal wins and cannot be overwritten."}
        </p>
      </div>
    );
  }

  return (
    <Panel>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <span
            className="text-[10px] uppercase tracking-[0.06em]"
            style={{ color: "var(--text-secondary)" }}
          >
            Digest to seal
          </span>
          <span
            className="font-mono text-[12px] break-all"
            style={{ color: "var(--text-primary)" }}
            title={digest}
          >
            {digest}
          </span>
        </div>

        <Input
          label="Label (optional)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="contract.pdf"
          disabled={stage === "signing" || stage === "pending"}
          error={labelTooLong ? `${labelBytes} of ${MAX_LABEL_BYTES} bytes` : undefined}
          hint={
            labelTooLong
              ? undefined
              : "Goes in the receipt, not storage. Visible to anyone — leave it blank if the name is sensitive."
          }
        />

        {stage === "idle" || stage === "failed" ? (
          <Button onClick={handleSeal} disabled={labelTooLong}>
            Seal {shortDigest(digest)}
          </Button>
        ) : null}

        <TxStatus
          stage={stage}
          hash={hash}
          failedLabel="Transaction failed — nothing was sealed."
        />
      </div>
    </Panel>
  );
}
