import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import {
  BaseError,
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sealRegistryAbi } from "@/lib/botchain/abi";

/**
 * The hand-written ABI, against the real compiled contract, on a real EVM.
 *
 * Nothing else catches a mismatch between the two. The Solidity tests never see
 * `lib/botchain/abi.ts`; TypeScript believes whatever its `as const` claims; and a wrong signature
 * surfaces in the browser as an unexplained revert. So this deploys the actual artifact and drives
 * it only through the app's ABI and the app's own read helpers.
 *
 *   npm run test:integration
 *
 * Needs anvil on PATH and `forge build` output. Spends nothing — the node is thrown away.
 */

const PORT = 8546;
const RPC = `http://127.0.0.1:${PORT}`;
/** Bohr's ID, so the app's chain config and deployment map apply unchanged. */
const CHAIN_ID = 968 as const;
/** anvil's first well-known development account. Public by design, worthless anywhere real. */
const KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const local = defineChain({
  id: CHAIN_ID,
  name: "anvil",
  nativeCurrency: { name: "Test BOT", symbol: "tBOT", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
});

const DIGEST = "0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08" as Hex;

let node: ChildProcess;
let publicClient: PublicClient;
let wallet: WalletClient;
let address: Address;
let deployBlock: bigint;
const account = privateKeyToAccount(KEY);

/** Name of the custom error a revert carries, or undefined if it was not one of ours. */
function revertName(err: unknown): string | undefined {
  if (!(err instanceof BaseError)) return undefined;
  const found = err.walk(
    (e) => typeof e === "object" && e !== null && "data" in e && Boolean((e as { data?: { errorName?: string } }).data?.errorName),
  ) as { data?: { errorName?: string; args?: readonly unknown[] } } | null;
  return found?.data?.errorName;
}

function revertArgs(err: unknown): readonly unknown[] | undefined {
  if (!(err instanceof BaseError)) return undefined;
  const found = err.walk(
    (e) => typeof e === "object" && e !== null && "data" in e && Boolean((e as { data?: { errorName?: string } }).data?.errorName),
  ) as { data?: { args?: readonly unknown[] } } | null;
  return found?.data?.args;
}

beforeAll(async () => {
  node = spawn("anvil", ["--port", String(PORT), "--chain-id", String(CHAIN_ID), "--silent"], {
    stdio: ["ignore", "ignore", "inherit"],
  });

  publicClient = createPublicClient({ chain: local, transport: http() }) as PublicClient;
  wallet = createWalletClient({ account, chain: local, transport: http() });

  // anvil needs a moment to bind the port.
  for (let i = 0; ; i++) {
    try {
      await publicClient.getBlockNumber();
      break;
    } catch {
      if (i > 100) throw new Error(`anvil never answered on ${RPC}`);
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  const artifact = JSON.parse(
    readFileSync(
      new URL("../../contracts/out/SealRegistry.sol/SealRegistry.json", import.meta.url),
      "utf8",
    ),
  ) as { bytecode: { object: Hex } };

  const hash = await wallet.deployContract({
    abi: sealRegistryAbi,
    bytecode: artifact.bytecode.object,
    account,
    chain: local,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  expect(receipt.status).toBe("success");
  address = receipt.contractAddress!;
  deployBlock = receipt.blockNumber;

  // Point the app's modules at this node before they are imported — `deployment.ts` reads
  // `process.env` at module load.
  process.env.NEXT_PUBLIC_BOHR_RPC = RPC;
  process.env.NEXT_PUBLIC_BOTCHAIN_NETWORK = "testnet";
  process.env.NEXT_PUBLIC_CONTRACT_968 = address;
  // Floored at 1 the same way Deploy.s.sol floors it: anvil deploys in block 1, and 0 is what
  // the app reads as "no deploy block configured".
  process.env.NEXT_PUBLIC_DEPLOY_BLOCK_968 = String(deployBlock > 1n ? deployBlock - 1n : 1n);
}, 60_000);

afterAll(() => {
  node?.kill("SIGTERM");
});

describe("the app's ABI against the compiled contract", () => {
  it("deploys", () => {
    expect(address).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it("reads an unsealed digest as null rather than throwing", async () => {
    // The distinction the verify screen and the certificate page both rest on: "not sealed" is an
    // answer, "could not read" is not.
    //
    // `isDeployed` is asserted first on purpose. `readRecord` also returns null for an
    // unconfigured deployment, so without this the test passes whether the digest is genuinely
    // unsealed or the address never got wired up — which is exactly how it passed while the
    // deploy block was being floored to 0.
    const { readRecord } = await import("@/lib/seal");
    const { isDeployed } = await import("@/lib/botchain/deployment");
    expect(isDeployed(CHAIN_ID)).toBe(true);

    const client = createPublicClient({ chain: local, transport: http() }) as PublicClient;
    await expect(readRecord(client, CHAIN_ID, DIGEST)).resolves.toBeNull();
  });

  it("seals, emits a decodable receipt, and reads back through lib/seal", async () => {
    const hash = await wallet.writeContract({
      address,
      abi: sealRegistryAbi,
      functionName: "seal",
      args: [DIGEST, "contract.pdf"],
      account,
      chain: local,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    expect(receipt.status).toBe("success");

    // What a user actually pays, base transaction cost included — a number the Solidity gas test
    // cannot see. Mainnet BOT has no faucet, so this is the figure that matters.
    expect(receipt.gasUsed).toBeLessThan(60_000n);

    const logs = await publicClient.getContractEvents({
      address,
      abi: sealRegistryAbi,
      eventName: "Sealed",
      fromBlock: deployBlock,
    });
    expect(logs).toHaveLength(1);
    expect(logs[0].args.digest).toBe(DIGEST);
    expect(logs[0].args.sealer?.toLowerCase()).toBe(account.address.toLowerCase());
    expect(logs[0].args.label).toBe("contract.pdf");

    const { readRecord, formatSealedAt } = await import("@/lib/seal");
    const client = createPublicClient({ chain: local, transport: http() }) as PublicClient;
    const record = await readRecord(client, CHAIN_ID, DIGEST);

    expect(record).not.toBeNull();
    expect(record!.sealer.toLowerCase()).toBe(account.address.toLowerCase());
    expect(record!.sealedAt).toBeGreaterThan(1_700_000_000);
    expect(formatSealedAt(record!.sealedAt)).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} UTC$/);
  });

  it("refuses a second seal, and the revert names who got there first", async () => {
    // This decode is what lets SealForm say "sealed by 0x… on 12 March" instead of
    // "transaction failed".
    try {
      await publicClient.simulateContract({
        account,
        address,
        abi: sealRegistryAbi,
        functionName: "seal",
        args: [DIGEST, "mine now"],
      });
      throw new Error("re-sealing did not revert");
    } catch (err) {
      expect(revertName(err)).toBe("AlreadySealed");
      const args = revertArgs(err);
      expect(args?.[0]).toBe(DIGEST);
      expect(String(args?.[1]).toLowerCase()).toBe(account.address.toLowerCase());
    }
  });

  it("refuses a zero digest", async () => {
    try {
      await publicClient.simulateContract({
        account,
        address,
        abi: sealRegistryAbi,
        functionName: "seal",
        args: [`0x${"0".repeat(64)}` as Hex, ""],
      });
      throw new Error("a zero digest did not revert");
    } catch (err) {
      expect(revertName(err)).toBe("EmptyDigest");
    }
  });

  it("refuses an overlong label", async () => {
    try {
      await publicClient.simulateContract({
        account,
        address,
        abi: sealRegistryAbi,
        functionName: "seal",
        args: [`0x${"ab".repeat(32)}` as Hex, "x".repeat(201)],
      });
      throw new Error("an overlong label did not revert");
    } catch (err) {
      expect(revertName(err)).toBe("LabelTooLong");
    }
  });

  it("agrees with the contract on the label limit", async () => {
    // Two constants that must match: MAX_LABEL_BYTES in lib/seal.ts and in the contract. If they
    // drift, the form validates against a limit the chain does not enforce.
    const { MAX_LABEL_BYTES } = await import("@/lib/seal");
    const onChain = await publicClient.readContract({
      address,
      abi: sealRegistryAbi,
      functionName: "MAX_LABEL_BYTES",
    });
    expect(Number(onChain)).toBe(MAX_LABEL_BYTES);
  });
});
