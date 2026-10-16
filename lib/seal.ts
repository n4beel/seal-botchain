import { createPublicClient, http, type Hex, type PublicClient } from "viem";
import { activeBotChain, type BotChainId } from "@/lib/botchain/chain";
import { getDeployment, isDeployed } from "@/lib/botchain/deployment";
import { sealRegistryAbi } from "@/lib/botchain/abi";

/** A seal as the UI deals with it. `null` from a read means the digest was never sealed. */
export type SealRecord = {
  digest: Hex;
  sealer: Hex;
  /** Unix seconds, from the block the seal was mined in. */
  sealedAt: number;
};

/**
 * The contract's label limit, counted the way the contract counts it.
 *
 * Solidity measures `bytes(label).length` — UTF-8 bytes. JavaScript's `String.length` is UTF-16
 * code units, so "café.pdf" is 8 there and 9 on chain, and an emoji is 2 against 4. Validating
 * with the wrong one lets a label through that reverts, on a chain where that costs real money.
 */
export const MAX_LABEL_BYTES = 200;

const encoder = new TextEncoder();

export function labelByteLength(label: string): number {
  return encoder.encode(label).length;
}

/**
 * Trim a label to fit, without splitting a character in half.
 *
 * Used to pre-fill the label from a file name, which the user never chose with a byte budget in
 * mind. Cutting by code unit can leave a lone surrogate, which is an unpaired half of an emoji
 * and encodes as a replacement character — so the cut walks back until the encoded length fits.
 */
export function truncateLabel(label: string, max = MAX_LABEL_BYTES): string {
  if (labelByteLength(label) <= max) return label;
  let out = label;
  while (out.length > 0 && labelByteLength(out) > max) {
    // Code points, not code units, so a surrogate pair leaves together.
    out = Array.from(out).slice(0, -1).join("");
  }
  return out;
}

/**
 * A client for reading the registry without a wallet.
 *
 * The certificate page is a link people send to someone else, so it has to render for a visitor
 * who has no wallet and may have JavaScript off entirely. That rules out wagmi's hooks and means
 * the read happens on the server against the chain the build targets.
 */
export function readClient(): PublicClient {
  return createPublicClient({
    chain: activeBotChain,
    transport: http(undefined, { timeout: 15_000 }),
  }) as PublicClient;
}

/**
 * Read one record. Returns `null` for a digest that was never sealed, and throws only when the
 * chain could not be reached — the caller has to tell those two apart, because "not sealed" is an
 * answer and "no answer" is not.
 */
export async function readRecord(
  client: PublicClient,
  chainId: BotChainId,
  digest: Hex,
): Promise<SealRecord | null> {
  if (!isDeployed(chainId)) return null;

  const record = await client.readContract({
    address: getDeployment(chainId).address,
    abi: sealRegistryAbi,
    functionName: "recordOf",
    args: [digest],
  });

  // `sealedAt` is the existence flag: no block has timestamp zero, so zero means the mapping slot
  // was never written.
  if (record.sealedAt === 0n) return null;

  return { digest, sealer: record.sealer, sealedAt: Number(record.sealedAt) };
}

/** UTC, explicitly. A timestamp on a shared certificate must not change meaning with the reader. */
export function formatSealedAt(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().replace("T", " ").replace(".000Z", " UTC");
}
