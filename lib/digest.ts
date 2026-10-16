import type { Hex } from "viem";

/**
 * Hashing, entirely in the browser.
 *
 * The file never leaves the machine — there is no upload, no API route, and no server to trust.
 * What goes on chain is 32 bytes that say nothing about the contents. That property is the only
 * reason a notary like this is safe to use on a contract or a manuscript, so it is worth stating
 * in the UI rather than leaving the user to infer it.
 *
 * SHA-256, not keccak256. The point of a digest here is that a third party can reproduce it with
 * tools they already have — `sha256sum` on Linux, `shasum -a 256` on macOS, `Get-FileHash` on
 * Windows — without installing anything Ethereum-shaped. The contract stores whatever 32 bytes it
 * is handed, so the choice is the frontend's to make.
 */

/**
 * `crypto.subtle.digest` has no streaming form: the whole file has to be in memory as one buffer.
 * That is fine for the documents this is for and not fine for a disk image, so the limit is
 * explicit and the message says what to do instead, rather than letting the tab die.
 */
export const MAX_FILE_BYTES = 256 * 1024 * 1024;

export class DigestError extends Error {}

/** SHA-256 of a file, as a 0x-prefixed 32-byte hex string. */
export async function digestFile(file: File): Promise<Hex> {
  if (file.size === 0) {
    // An empty file has a perfectly good SHA-256, but sealing one is never what the user meant,
    // and that one digest is the same for everybody — the first person to seal it locks it out
    // for all the rest.
    throw new DigestError("That file is empty. There is nothing to seal.");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new DigestError(
      `That file is ${formatBytes(file.size)}. Hashing happens in the browser, which caps out at ` +
        `${formatBytes(MAX_FILE_BYTES)}. Hash it locally with \`sha256sum\` and paste the digest instead.`,
    );
  }
  if (typeof crypto === "undefined" || !crypto.subtle) {
    // WebCrypto is only exposed in a secure context. Served over plain HTTP from anything but
    // localhost, `crypto.subtle` is simply undefined, and the failure otherwise reads as a bug.
    throw new DigestError(
      "This browser will not hash files on an insecure connection. Open the site over HTTPS.",
    );
  }

  const buffer = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return toHex(new Uint8Array(hash));
}

/** 32 bytes as lowercase hex. */
export function toHex(bytes: Uint8Array): Hex {
  let out = "";
  for (const byte of bytes) out += byte.toString(16).padStart(2, "0");
  return `0x${out}`;
}

/**
 * Accept a digest a user pasted, in any of the shapes the standard tools print.
 *
 * `sha256sum` emits bare lowercase hex followed by the filename; `Get-FileHash` emits uppercase;
 * people paste with the `0x` on or off. All four are the same 32 bytes, so all four are accepted
 * and normalised rather than rejected on formatting.
 */
export function parseDigest(input: string): Hex | null {
  const first = input.trim().split(/\s+/)[0] ?? "";
  const body = (first.startsWith("0x") || first.startsWith("0X") ? first.slice(2) : first)
    .toLowerCase();

  if (!/^[0-9a-f]{64}$/.test(body)) return null;
  // All-zero is the contract's empty value and it refuses to seal it, so refuse it here too
  // rather than sending a transaction that cannot succeed.
  if (/^0+$/.test(body)) return null;

  return `0x${body}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

/** Shorten a digest for display without losing the ends, which is what people actually compare. */
export function shortDigest(digest: string): string {
  return `${digest.slice(0, 10)}…${digest.slice(-8)}`;
}
