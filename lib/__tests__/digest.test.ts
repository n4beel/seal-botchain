import { describe, expect, it } from "vitest";
import { formatBytes, parseDigest, shortDigest, toHex } from "../digest";

describe("parseDigest", () => {
  const canonical = "0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08";
  const bare = canonical.slice(2);

  // The four shapes the standard tools actually print. Rejecting any of them on formatting would
  // send a user to look for a bug in their own paste.
  it("accepts 0x-prefixed hex", () => {
    expect(parseDigest(canonical)).toBe(canonical);
  });

  it("accepts bare hex, as sha256sum prints it", () => {
    expect(parseDigest(bare)).toBe(canonical);
  });

  it("accepts uppercase, as Get-FileHash prints it", () => {
    expect(parseDigest(bare.toUpperCase())).toBe(canonical);
    expect(parseDigest(`0X${bare.toUpperCase()}`)).toBe(canonical);
  });

  it("takes the digest off a full sha256sum line", () => {
    expect(parseDigest(`${bare}  contract.pdf`)).toBe(canonical);
  });

  it("tolerates surrounding whitespace and newlines", () => {
    expect(parseDigest(`\n  ${canonical}\n`)).toBe(canonical);
  });

  it("rejects the wrong length", () => {
    expect(parseDigest(bare.slice(0, 63))).toBeNull();
    expect(parseDigest(`${bare}ab`)).toBeNull();
  });

  it("rejects non-hex", () => {
    expect(parseDigest(`${bare.slice(0, 63)}z`)).toBeNull();
    expect(parseDigest("not a hash at all")).toBeNull();
    expect(parseDigest("")).toBeNull();
  });

  // The contract refuses to seal zero, because zero is also its empty value. Catching it here
  // means the user is told why instead of paying gas for a certain revert.
  it("rejects an all-zero digest", () => {
    expect(parseDigest(`0x${"0".repeat(64)}`)).toBeNull();
  });
});

describe("toHex", () => {
  it("pads every byte to two places", () => {
    // The bug this catches: a byte below 0x10 rendered as one character shifts every byte after
    // it, producing a digest that is wrong but still looks like a digest.
    expect(toHex(new Uint8Array([0, 1, 15, 16, 255]))).toBe("0x00010f10ff");
  });
});

describe("formatBytes", () => {
  it("scales to the unit a human would use", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1024 * 1024 * 2.5)).toBe("2.5 MB");
    expect(formatBytes(1024 * 1024 * 256)).toBe("256 MB");
    expect(formatBytes(1024 * 1024 * 1024 * 3)).toBe("3.0 GB");
  });
});

describe("shortDigest", () => {
  it("keeps both ends, which is what people compare", () => {
    const digest = `0x${"ab".repeat(32)}`;
    const short = shortDigest(digest);
    expect(short.startsWith("0xabababab")).toBe(true);
    expect(short.endsWith("abababab")).toBe(true);
  });
});

// `label` is validated against the contract's limit, which counts UTF-8 bytes rather than the
// UTF-16 code units `String.length` reports. These two tests are the whole reason there is a
// helper instead of `label.length`.
describe("label byte length", () => {
  it("counts UTF-8 bytes, not JavaScript characters", async () => {
    const { labelByteLength } = await import("../seal");
    expect(labelByteLength("contract.pdf")).toBe(12);
    expect(labelByteLength("café.pdf")).toBe(9); // é is two bytes; String.length says 8
    expect(labelByteLength("📄.pdf")).toBe(8); // four bytes; String.length says 6
  });

  it("truncates without splitting a character", async () => {
    const { labelByteLength, truncateLabel } = await import("../seal");
    const emoji = "📄".repeat(100); // 400 bytes
    const cut = truncateLabel(emoji, 200);

    expect(labelByteLength(cut)).toBeLessThanOrEqual(200);
    // The failure this guards: cutting by code unit leaves half a surrogate pair, which is not a
    // character at all and encodes as U+FFFD.
    expect(cut).not.toContain("�");
    expect(Array.from(cut).every((ch) => ch === "📄")).toBe(true);
  });

  it("leaves a label that already fits alone", async () => {
    const { truncateLabel } = await import("../seal");
    expect(truncateLabel("contract.pdf")).toBe("contract.pdf");
  });
});
