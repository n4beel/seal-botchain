/**
 * A local chain with Seal already deployed and one digest already sealed, wired into `.env.local`.
 *
 *   node scripts/local-stack.mjs       # then: npm run dev
 *
 * For working on the UI without a faucet, a wallet, or a testnet deploy. Every state the app can
 * show exists on this chain: a sealed digest for the record and certificate views, and every other
 * digest unsealed for the empty ones.
 *
 * Rewrites `.env.local`. It leaves anvil running in the background on 8547; stop it with
 * `pkill -f 'anvil .-port 8547'`.
 */

import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createPublicClient, createWalletClient, defineChain, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const PORT = 8547;
const RPC = `http://127.0.0.1:${PORT}`;
/** Bohr's ID, so the app's own chain config applies with no changes. */
const CHAIN_ID = 968;
/** anvil's first well-known development account. Public by design; worthless anywhere real. */
const KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
/** SHA-256 of "hello" — reproducible with `printf hello | sha256sum`. */
const DIGEST = "0x2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";

const local = defineChain({
  id: CHAIN_ID,
  name: "anvil",
  nativeCurrency: { name: "Test BOT", symbol: "tBOT", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
});

spawn("anvil", ["--port", String(PORT), "--chain-id", String(CHAIN_ID), "--silent"], {
  detached: true,
  stdio: "ignore",
}).unref();

const account = privateKeyToAccount(KEY);
const pub = createPublicClient({ chain: local, transport: http() });
const wallet = createWalletClient({ account, chain: local, transport: http() });

for (let i = 0; ; i++) {
  try {
    await pub.getBlockNumber();
    break;
  } catch {
    if (i > 100) throw new Error(`anvil never answered on ${RPC}`);
    await new Promise((r) => setTimeout(r, 100));
  }
}

const artifact = JSON.parse(
  readFileSync(new URL("../contracts/out/SealRegistry.sol/SealRegistry.json", import.meta.url), "utf8"),
);

// A couple of blocks first, so the deploy does not land in block 1 — the edge where a deploy
// block of `n - 1` would be 0, which the app reads as unconfigured.
await wallet.sendTransaction({ to: account.address, value: 0n });
await wallet.sendTransaction({ to: account.address, value: 0n });

const deployHash = await wallet.deployContract({
  abi: artifact.abi,
  bytecode: artifact.bytecode.object,
});
const deployed = await pub.waitForTransactionReceipt({ hash: deployHash });
const address = deployed.contractAddress;

const sealHash = await wallet.writeContract({
  address,
  abi: artifact.abi,
  functionName: "seal",
  args: [DIGEST, "hello.txt"],
});
const sealed = await pub.waitForTransactionReceipt({ hash: sealHash });

writeFileSync(
  new URL("../.env.local", import.meta.url),
  [
    "# Written by scripts/local-stack.mjs. Not the testnet or mainnet config.",
    "NEXT_PUBLIC_BOTCHAIN_NETWORK=testnet",
    `NEXT_PUBLIC_BOHR_RPC=${RPC}`,
    `NEXT_PUBLIC_CONTRACT_968=${address}`,
    `NEXT_PUBLIC_DEPLOY_BLOCK_968=${deployed.blockNumber - 1n}`,
    "",
  ].join("\n"),
);

console.log(`chain       anvil ${CHAIN_ID} on ${RPC}`);
console.log(`contract    ${address}  (block ${deployed.blockNumber})`);
console.log(`sealed      ${DIGEST}`);
console.log(`  by        ${account.address}`);
console.log(`  gas       ${sealed.gasUsed}`);
console.log(`\ncertificate /record/${DIGEST}`);
console.log("\n.env.local written. Start the app with: npm run dev");
