// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

// EN: Local/Sepolia deploy script. Refuses other chains. Key comes from env (never hardcoded).
// ES: Script de deploy local/Sepolia. Rechaza otras cadenas. La clave viene del env (nunca hardcodeada).
import {Script} from "forge-std/Script.sol";
import {PaloozaBadges} from "../src/PaloozaBadges.sol";

contract DeployLocal is Script {
    function run() external returns (PaloozaBadges badges) {
        // EN: Only anvil (31337) or Sepolia (11155111). / ES: Solo anvil (31337) o Sepolia (11155111).
        require(block.chainid == 31337 || block.chainid == 11155111, "unsupported chain");
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(pk);
        vm.startBroadcast(pk);
        badges = new PaloozaBadges(deployer);
        badges.setMinter(deployer, true);
        // EN: Register the 6 achievement badges (ids 1..6). / ES: Registrar las 6 insignias (ids 1..6).
        string[6] memory ids = ["first_game", "explorer", "memory_master", "lightning", "tile_1000", "dedicated"];
        for (uint256 i = 0; i < ids.length; i++) badges.registerBadge(i + 1, string.concat("palooza://badge/", ids[i]));
        vm.stopBroadcast();
    }
}
