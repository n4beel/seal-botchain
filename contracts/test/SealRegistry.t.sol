// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Test} from "forge-std/Test.sol";
import {SealRegistry} from "../src/SealRegistry.sol";

contract SealRegistryTest is Test {
  SealRegistry internal registry;

  address internal alice = address(0xA11CE);
  address internal bob = address(0xB0B);

  bytes32 internal constant DIGEST = keccak256("a contract, as a PDF");

  event Sealed(bytes32 indexed digest, address indexed sealer, uint64 sealedAt, string label);

  function setUp() public {
    registry = new SealRegistry();
    // Block timestamp is 1 in a fresh VM. Every assertion about `sealedAt` being a real moment is
    // vacuous at 1, and `sealedAt != 0` as an existence check deserves a timestamp that looks
    // like a date.
    vm.warp(1_760_000_000);
  }

  // --- the happy path ---------------------------------------------------------------------------

  function test_RecordsTheSealerAndTheBlockTimestamp() public {
    vm.prank(alice);
    registry.seal(DIGEST, "contract.pdf");

    SealRegistry.Record memory record = registry.recordOf(DIGEST);
    assertEq(record.sealer, alice, "sealer");
    assertEq(record.sealedAt, uint64(block.timestamp), "sealedAt");
    assertTrue(registry.isSealed(DIGEST));
  }

  function test_EmitsTheReceipt() public {
    vm.expectEmit(true, true, false, true, address(registry));
    emit Sealed(DIGEST, alice, uint64(block.timestamp), "contract.pdf");

    vm.prank(alice);
    registry.seal(DIGEST, "contract.pdf");
  }

  /// The label is log-only, so a lookup must still return a full record when nothing was labelled.
  function test_AcceptsAnEmptyLabel() public {
    vm.prank(alice);
    registry.seal(DIGEST, "");

    assertEq(registry.recordOf(DIGEST).sealer, alice);
  }

  function test_KeepsDigestsIndependent() public {
    bytes32 other = keccak256("a different file");

    vm.prank(alice);
    registry.seal(DIGEST, "a");
    vm.prank(bob);
    registry.seal(other, "b");

    assertEq(registry.recordOf(DIGEST).sealer, alice);
    assertEq(registry.recordOf(other).sealer, bob);
  }

  // --- first seal wins -------------------------------------------------------------------------

  /// The whole premise. A second seal must not move the timestamp, whoever sends it.
  function test_RevertsOnReseal() public {
    vm.prank(alice);
    registry.seal(DIGEST, "mine");

    uint64 sealedAt = uint64(block.timestamp);
    vm.warp(block.timestamp + 1 days);

    vm.expectRevert(
      abi.encodeWithSelector(SealRegistry.AlreadySealed.selector, DIGEST, alice, sealedAt)
    );
    vm.prank(bob);
    registry.seal(DIGEST, "actually mine");
  }

  /// The revert carries the existing record, which is what lets the UI answer "sealed by whom,
  /// and when" instead of only "that failed".
  function test_RevertNamesTheOriginalSealer() public {
    vm.prank(alice);
    registry.seal(DIGEST, "mine");
    uint64 sealedAt = uint64(block.timestamp);

    vm.warp(block.timestamp + 365 days);
    vm.prank(alice);
    try registry.seal(DIGEST, "again") {
      fail();
    } catch (bytes memory reason) {
      (bytes32 digest, address sealer, uint64 when) =
        abi.decode(stripSelector(reason), (bytes32, address, uint64));
      assertEq(digest, DIGEST);
      assertEq(sealer, alice);
      assertEq(when, sealedAt, "the original timestamp, not the retry's");
    }
  }

  function test_RevertingResealLeavesTheRecordUntouched() public {
    vm.prank(alice);
    registry.seal(DIGEST, "mine");
    uint64 sealedAt = uint64(block.timestamp);

    vm.warp(block.timestamp + 1 days);
    vm.prank(bob);
    vm.expectRevert();
    registry.seal(DIGEST, "mine now");

    SealRegistry.Record memory record = registry.recordOf(DIGEST);
    assertEq(record.sealer, alice);
    assertEq(record.sealedAt, sealedAt);
  }

  // --- guards ----------------------------------------------------------------------------------

  /// Zero is both an uninitialised `bytes32` and the mapping's empty value. Sealing it would mean
  /// every unsealed lookup collided with one caller's record.
  function test_RevertsOnZeroDigest() public {
    vm.expectRevert(SealRegistry.EmptyDigest.selector);
    vm.prank(alice);
    registry.seal(bytes32(0), "nothing");

    assertFalse(registry.isSealed(bytes32(0)));
  }

  function test_RevertsOnOverlongLabel() public {
    uint256 max = registry.MAX_LABEL_BYTES();
    string memory tooLong = string(new bytes(max + 1));

    vm.expectRevert(
      abi.encodeWithSelector(SealRegistry.LabelTooLong.selector, max + 1, max)
    );
    vm.prank(alice);
    registry.seal(DIGEST, tooLong);
  }

  function test_AcceptsALabelExactlyAtTheLimit() public {
    uint256 max = registry.MAX_LABEL_BYTES();
    vm.prank(alice);
    registry.seal(DIGEST, string(new bytes(max)));

    assertTrue(registry.isSealed(DIGEST));
  }

  // --- reads on a miss -------------------------------------------------------------------------

  /// "Not sealed" is an ordinary answer to a verification query. A revert here would make an
  /// unsealed file indistinguishable from an unreachable node.
  function test_ReadsOfAnUnsealedDigestReturnZeroes() public view {
    SealRegistry.Record memory record = registry.recordOf(keccak256("never sealed"));
    assertEq(record.sealer, address(0));
    assertEq(record.sealedAt, 0);
    assertFalse(registry.isSealed(keccak256("never sealed")));
  }

  // --- gas -------------------------------------------------------------------------------------

  /// Mainnet BOT has no faucet, so a regression that doubles the cost of the only transaction this
  /// app makes is a regression a user pays for. One storage slot from zero is ~22.1k; the rest is
  /// calldata, the log and the base cost. The ceiling is loose enough not to be brittle and tight
  /// enough to catch a second `SSTORE`.
  function test_SealFitsInOneStorageSlot() public {
    vm.prank(alice);
    uint256 before = gasleft();
    registry.seal(DIGEST, "contract.pdf");
    uint256 used = before - gasleft();

    emit log_named_uint("seal() gas", used);
    assertLt(used, 55_000, "seal() got more expensive - did Record stop fitting in one slot?");
  }

  // --- properties ------------------------------------------------------------------------------

  function testFuzz_SealsAnyNonZeroDigest(bytes32 digest, address sealer) public {
    vm.assume(digest != bytes32(0));
    vm.assume(sealer != address(0));

    vm.prank(sealer);
    registry.seal(digest, "");

    SealRegistry.Record memory record = registry.recordOf(digest);
    assertEq(record.sealer, sealer);
    assertEq(record.sealedAt, uint64(block.timestamp));
  }

  function testFuzz_NeverSealsTwice(bytes32 digest, address first, address second) public {
    vm.assume(digest != bytes32(0));

    vm.prank(first);
    registry.seal(digest, "");
    address recorded = registry.recordOf(digest).sealer;

    vm.prank(second);
    vm.expectRevert();
    registry.seal(digest, "");

    assertEq(registry.recordOf(digest).sealer, recorded);
  }

  /// @dev Drops the 4-byte error selector so the rest can be `abi.decode`d.
  function stripSelector(bytes memory reason) internal pure returns (bytes memory out) {
    out = new bytes(reason.length - 4);
    for (uint256 i = 0; i < out.length; i++) {
      out[i] = reason[i + 4];
    }
  }
}
