// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Script, console2} from "forge-std/Script.sol";
import {SealRegistry} from "../src/SealRegistry.sol";

/// @notice Deploys SealRegistry and prints the two env lines the frontend needs.
/// @dev Bohr testnet first:
///   forge script script/Deploy.s.sol --rpc-url bohr --broadcast
/// Mainnet only once the full flow passes on testnet. Mainnet BOT has no faucet, so pass the key
/// on the command line rather than leaving it in a file:
///   DEPLOYER_PRIVATE_KEY=0x... forge script script/Deploy.s.sol --rpc-url botchain --broadcast
contract Deploy is Script {
  function run() external {
    uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

    vm.startBroadcast(deployerKey);
    SealRegistry registry = new SealRegistry();
    vm.stopBroadcast();

    console2.log("chain id        ", block.chainid);
    console2.log("SealRegistry    ", address(registry));
    console2.log("");
    console2.log("Add to .env.local:");
    console2.log(
      string.concat(
        "NEXT_PUBLIC_CONTRACT_", vm.toString(block.chainid), "=", vm.toString(address(registry))
      )
    );
    // One block earlier than the deployment, so an off-by-one at the boundary cannot drop the
    // first Sealed log. Walking a ~0.75s-block chain from genesis instead is a hung tab, not a
    // slow scan, which is why the frontend refuses to treat a deployment without this as ready.
    //
    // Floored at 1, not 0. Zero is exactly what the frontend reads as "no deploy block
    // configured", so on a chain whose head is block 1 — a fresh local node — printing 0 would
    // hand over a value that makes the app report itself undeployed. Mainnet is 27M blocks in and
    // will never hit this; a local node hits it every time.
    uint256 startBlock = block.number > 1 ? block.number - 1 : 1;
    console2.log(
      string.concat(
        "NEXT_PUBLIC_DEPLOY_BLOCK_", vm.toString(block.chainid), "=", vm.toString(startBlock)
      )
    );
  }
}
