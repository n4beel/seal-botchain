"use client";

import { useState } from "react";
import FileDrop, { type HashedFile } from "./FileDrop";
import SealForm from "./SealForm";
import BotChainGate from "@/components/botchain/BotChainGate";

/**
 * The seal flow, in the order a user does it: hash, then transact.
 *
 * The file drop sits *outside* `BotChainGate` on purpose. Hashing needs no wallet and no network,
 * so someone who has not connected yet can still see what this page does to their file — and see
 * that the digest appears without anything being uploaded — before being asked for a wallet.
 */
export default function SealScreen() {
  const [file, setFile] = useState<HashedFile | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <FileDrop onHashed={setFile} />
      <BotChainGate noWalletNote="Hashing a file still works here — it happens in the browser and needs no wallet — but sealing one needs a wallet to sign the transaction.">
        <SealForm digest={file?.digest ?? null} suggestedLabel={file?.name} />
      </BotChainGate>
    </div>
  );
}
