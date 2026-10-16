/**
 * SealRegistry's ABI.
 *
 * Hand-written and `as const` rather than imported from `contracts/out`. The const assertion is
 * what gives viem and wagmi their argument and return types; a generated JSON artifact loses that
 * unless it is cast, and a mistyped argument would then only surface as a revert.
 *
 * The custom errors are here on purpose. Without them viem cannot decode a revert, and
 * `AlreadySealed` carries the record that already exists — which is the difference between telling
 * a user "someone sealed this on 12 March" and telling them "transaction failed".
 */
export const sealRegistryAbi = [
  {
    type: "function",
    name: "seal",
    stateMutability: "nonpayable",
    inputs: [
      { name: "digest", type: "bytes32" },
      { name: "label", type: "string" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "recordOf",
    stateMutability: "view",
    inputs: [{ name: "digest", type: "bytes32" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "sealer", type: "address" },
          { name: "sealedAt", type: "uint64" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "isSealed",
    stateMutability: "view",
    inputs: [{ name: "digest", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "MAX_LABEL_BYTES",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "event",
    name: "Sealed",
    inputs: [
      { name: "digest", type: "bytes32", indexed: true },
      { name: "sealer", type: "address", indexed: true },
      { name: "sealedAt", type: "uint64", indexed: false },
      { name: "label", type: "string", indexed: false },
    ],
  },
  { type: "error", name: "EmptyDigest", inputs: [] },
  {
    type: "error",
    name: "AlreadySealed",
    inputs: [
      { name: "digest", type: "bytes32" },
      { name: "sealer", type: "address" },
      { name: "sealedAt", type: "uint64" },
    ],
  },
  {
    type: "error",
    name: "LabelTooLong",
    inputs: [
      { name: "length", type: "uint256" },
      { name: "max", type: "uint256" },
    ],
  },
] as const;
