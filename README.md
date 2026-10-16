# Seal

Hash a file. Timestamp it on BOT Chain. Prove it existed.

The file is hashed in your browser with SHA-256 and never uploaded. What goes on chain is 32 bytes
that say nothing about the contents — which is why this is safe to point at a contract, a
manuscript or a dataset you have not published.

**The one transaction:** `seal(bytes32 digest, string label)` — records the digest, who submitted
it, and the timestamp of the block it landed in.

| | |
|---|---|
| Network | BOT Chain mainnet (677) |
| Contract | _not yet deployed_ |
| First transaction | _pending_ |
| Live | _pending_ |

---

## What it proves, and what it does not

The chain attests that **this digest was submitted by this address, at or before this block**.

That is all. It does not prove who wrote the file, who owns it, or that the sealer ever held it —
anyone who can compute a digest can seal it. The app says so on every record it shows, because a
notary that lets a user believe otherwise is worse than no notary.

What it is genuinely good for: showing a document existed before a given date, and that its
contents have not changed since. A single altered byte produces a completely different digest.

## Anyone can check it without trusting this app

```bash
sha256sum contract.pdf          # Linux
shasum -a 256 contract.pdf      # macOS
Get-FileHash contract.pdf       # Windows
```

Then read the record straight off the chain:

```bash
cast call <contract> "recordOf(bytes32)((address,uint64))" 0x<digest> --rpc-url https://rpc.botchain.ai
```

## Screens

| Route | What it does | Wallet |
|---|---|---|
| `/` | Hash a file, see its digest, seal it | Required to seal |
| `/verify` | Drop a file or paste a digest, read the record | Not required |
| `/record/<digest>` | Shareable certificate, rendered server-side | Not required, works with JS off |

The certificate page is a server component reading the chain with viem directly, not through
wagmi. It is a link you send to a counterparty, so it has to render for someone with no wallet, no
extension, and JavaScript off.

## The contract

`contracts/src/SealRegistry.sol` — 80 lines, one mapping, one function that writes.

- **First seal wins, permanently.** Re-sealing reverts with `AlreadySealed(digest, sealer,
  sealedAt)`, carrying the record that already exists, so the UI can answer "sealed by whom and
  when" rather than "transaction failed".
- **One storage slot.** `address` (20 bytes) and `uint64` (8 bytes) pack into a single slot, so a
  seal is one `SSTORE` from zero. Mainnet BOT has no faucet, so the difference between one slot
  and two is real money for every user.
- **The label is never stored.** It goes in the event only — the log is the only copy.
- **Zero digests are refused.** Zero is also the mapping's empty value, so sealing it would let
  one caller occupy the slot every unsealed lookup collides with.

Measured cost: **31,068 gas** for `seal()` in the Solidity harness, **~52,000** for a real
transaction including the 21,000 base cost. At 20 gwei that is about **0.001 BOT** per seal.

## Development

```bash
npm install
npm run chain:check          # both BOT Chain networks: ID, head age, gas price
npm test                     # 32 unit tests
npm run test:integration     # the app's ABI against the real contract on anvil
npm run dev

cd contracts
forge test -vv               # 14 tests, including the gas ceiling and two fuzz properties
```

`npm run test:integration` is the one worth understanding. It deploys the compiled artifact to a
local node and drives it **only** through the hand-written ABI in `lib/botchain/abi.ts` and the
read helpers in `lib/seal.ts`. Nothing else catches a mismatch between the ABI and the contract:
the Solidity tests never see the ABI, TypeScript believes whatever its `as const` claims, and a
wrong signature surfaces in the browser as an unexplained revert.

## Deploying

```bash
# Bohr testnet
cd contracts
forge script script/Deploy.s.sol --rpc-url bohr --broadcast

# Mainnet, once the testnet flow is verified end to end
DEPLOYER_PRIVATE_KEY=0x... forge script script/Deploy.s.sol --rpc-url botchain --broadcast
```

The script prints the two `.env.local` lines the frontend needs. Both are required — an address
without a deploy block is treated as unconfigured, because a contract whose start block is unknown
cannot be read back over logs.

## Built from the template

`../template`, extracted from `ST-Frontier/ghost-pay`. See `../TEMPLATE.md`.
