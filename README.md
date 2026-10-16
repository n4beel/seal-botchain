# Seal

Hash a file. Timestamp it on BOT Chain. Prove it existed.

The file is hashed in your browser with SHA-256 and never uploaded. What goes on chain is 32 bytes
that say nothing about the contents — which is why this is safe to point at a contract, a
manuscript or a dataset you have not published.

**The one transaction:** `seal(bytes32 digest, string label)` — records the digest, who submitted
it, and the timestamp of the block it landed in.

### Bohr testnet (968) — live

| | |
|---|---|
| Contract | [`0x1541EA25d30Ba97e643a254E8740d5802Bbf6ce9`](https://scan.bohr.life/address/0x1541EA25d30Ba97e643a254E8740d5802Bbf6ce9) · source verified |
| Deploy tx | [`0x4304ecac…5ac2d5f4`](https://scan.bohr.life/tx/0x4304ecac6687359c2fe7eaf488386ea5cd7742560992c3b0e68780605ac2d5f4) · block 27,042,362 · 265,230 gas |
| First seal | [`0xa1a0dd27…4330cca2`](https://scan.bohr.life/tx/0xa1a0dd276e9655fa3cb8b200993cdcf5b6ce9ce374d8a7ab69bdb7534330cca2) · block 27,042,400 · **48,089 gas** |
| Sealed digest | `0xf5b1937f9a608175329ad25ff35b6cbf0833cd500007f096daddf60609423ce1` |
| Sealed at | 2026-10-16 09:01:23 UTC |

The first seal is this contract's own source, so the digest is reproducible from this repo:

```bash
sha256sum contracts/src/SealRegistry.sol
# f5b1937f9a608175329ad25ff35b6cbf0833cd500007f096daddf60609423ce1
```

### BOT Chain mainnet (677) — not yet deployed

| | |
|---|---|
| Contract | _pending_ |
| First transaction | _pending_ |
| Live URL | _pending_ |

Mainnet is the only network the listing bar accepts. Deploy costs ~0.0069 BOT and the first seal
~0.00096 BOT, both measured on Bohr at 20 gwei.

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

## Seal requires HTTPS

`crypto.subtle` — the only way to hash a file in a browser without shipping a hash implementation
— is exposed **only in a secure context**. That means `https://`, `localhost` or `127.0.0.1`, and
nothing else. Served over plain HTTP from a LAN IP, `crypto.subtle` is simply `undefined` and
hashing cannot happen at all.

Consequences worth knowing before testing:

- `http://localhost:3000` works. Desktop MetaMask testing is unaffected.
- `http://192.168.x.x:3000` **does not** — so a phone on the same wifi cannot test the hashing
  flow against a local dev server. Use a real HTTPS deployment, or an HTTPS tunnel, for mobile.
- Any production host must be HTTPS. Vercel and Netlify are by default.

`digestFile` detects this and says so rather than failing as an unexplained error, but it cannot
work around it.

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

Measured cost: **31,068 gas** for `seal()` in the Solidity harness; **48,089 gas** for the real
transaction on Bohr, including the 21,000 base cost. At 20 gwei that is **0.00096 BOT** per seal.
The local anvil measurement was 48,017 — within 0.2% of the live chain.

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

Put `DEPLOYER_PRIVATE_KEY` in `.env` (gitignored, `0x` prefix optional), then:

```bash
cd contracts
./deploy.sh bohr --dry     # simulate, broadcast nothing
./deploy.sh bohr           # testnet
./deploy.sh botchain       # mainnet — real BOT, no faucet
```

The wrapper asks the node what chain it is on and refuses to broadcast if it disagrees with the
network named, which is the one mistake here that cannot be undone. It then verifies the source on
the explorer — both run Blockscout.

The script prints the two `.env.local` lines the frontend needs. Both are required: an address
without a deploy block is treated as unconfigured, because a contract whose start block is unknown
cannot be read back over logs.

## Built from the template

`../template`, extracted from `ST-Frontier/ghost-pay`. See `../TEMPLATE.md`.
