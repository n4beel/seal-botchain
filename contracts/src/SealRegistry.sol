// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/// @title SealRegistry
/// @notice Records that a digest existed at a point in time, and who put it there.
///
/// @dev What this proves, exactly: the digest was submitted to this contract in the block that
/// mined the transaction, by the address that sent it. That bounds the digest's existence to *at
/// or before* that block, and nothing more. It does not prove authorship, ownership, or that the
/// sealer ever held the file — anyone who can compute a digest can seal it. The UI says so too;
/// a notary that lets a user believe otherwise is worse than no notary.
///
/// First seal wins, permanently. Re-sealing an existing digest reverts and hands back the record
/// that already exists, because the useful answer to "I sealed this" is "someone else did, here
/// is when" rather than a second timestamp that quietly overwrites the first one.
contract SealRegistry {
  /// @param sealer The address that submitted the digest.
  /// @param sealedAt The timestamp of the block the seal was mined in.
  /// @dev `address` (20 bytes) and `uint64` (8 bytes) pack into one 32-byte slot, so a seal is a
  /// single `SSTORE` from zero. On a chain whose native token has no faucet, the difference
  /// between one slot and two is the difference between ~22k gas and ~42k, paid by every user.
  struct Record {
    address sealer;
    uint64 sealedAt;
  }

  /// @dev Private with an explicit getter. A public mapping of a struct returns its fields
  /// positionally and silently changes shape if a field is ever added; `recordOf` is a stable
  /// interface the frontend ABI can be written against.
  mapping(bytes32 digest => Record record) private _records;

  /// @notice A digest was sealed for the first time.
  /// @param label Caller-supplied, free-form, and never stored — the log is the only copy. A file
  /// name is the expected use. It is indexed by neither topic because it is for humans reading a
  /// receipt, not for queries.
  event Sealed(bytes32 indexed digest, address indexed sealer, uint64 sealedAt, string label);

  error EmptyDigest();
  error AlreadySealed(bytes32 digest, address sealer, uint64 sealedAt);
  error LabelTooLong(uint256 length, uint256 max);

  /// @dev A label long enough to matter costs the caller 16 gas a byte and bloats the receipt for
  /// no one's benefit. 200 bytes is a generous file name.
  uint256 public constant MAX_LABEL_BYTES = 200;

  /// @notice Seal a digest.
  /// @param digest Hash of whatever is being timestamped. SHA-256 in this app's frontend, but the
  /// contract is indifferent — it stores 32 bytes and never learns what they summarise.
  /// @param label Optional, for the receipt. Pass "" to record nothing.
  function seal(bytes32 digest, string calldata label) external {
    // Zero is what an uninitialised `bytes32` looks like, and it is also `_records`' empty value.
    // Allowing it would let one caller seal the digest that every unsealed lookup collides with.
    if (digest == bytes32(0)) revert EmptyDigest();

    uint256 labelLength = bytes(label).length;
    if (labelLength > MAX_LABEL_BYTES) revert LabelTooLong(labelLength, MAX_LABEL_BYTES);

    Record memory existing = _records[digest];
    if (existing.sealedAt != 0) {
      revert AlreadySealed(digest, existing.sealer, existing.sealedAt);
    }

    // `block.timestamp` is a uint256 that will not exceed uint64 for about 584 billion years, so
    // the cast cannot truncate. It is also the field that makes `sealedAt != 0` a valid existence
    // check: no block has timestamp zero.
    uint64 sealedAt = uint64(block.timestamp);
    _records[digest] = Record({sealer: msg.sender, sealedAt: sealedAt});

    emit Sealed(digest, msg.sender, sealedAt, label);
  }

  /// @notice The record for a digest, or zeroes if it was never sealed.
  /// @dev Returns the struct rather than reverting on a miss: "not sealed" is an ordinary answer
  /// to a verification query, not an error, and a revert would make the frontend treat an
  /// unsealed file the same as an unreachable node.
  function recordOf(bytes32 digest) external view returns (Record memory) {
    return _records[digest];
  }

  /// @notice Whether a digest has been sealed.
  function isSealed(bytes32 digest) external view returns (bool) {
    return _records[digest].sealedAt != 0;
  }
}
