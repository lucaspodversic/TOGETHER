// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

// EN: Foundry tests for the soulbound badges. / ES: Tests de Foundry de las insignias soulbound.
import {Test} from "forge-std/Test.sol";
import {PaloozaBadges} from "../src/PaloozaBadges.sol";

contract PaloozaBadgesTest is Test {
    PaloozaBadges badges;
    address owner = address(0xA11CE);
    address minter = address(0xB0B);
    address player = address(0xCAFE);

    function setUp() public {
        badges = new PaloozaBadges(owner);
        vm.startPrank(owner);
        badges.setMinter(minter, true);
        badges.registerBadge(1, "ipfs://first_game");
        vm.stopPrank();
    }

    // EN: Happy path mint. / ES: Minteo feliz.
    // EN: Test —  mint.
    // ES: Prueba —  mint (ver nombre de la función).
    function test_mint() public {
        vm.prank(minter);
        badges.mint(player, 1);
        assertEq(badges.balanceOf(player, 1), 1);
        assertTrue(badges.locked(1));
    }

    // EN: Only one per id. / ES: Solo una por id.
    // EN: Test —  no double mint.
    // ES: Prueba —  no double mint (ver nombre de la función).
    function test_noDoubleMint() public {
        vm.startPrank(minter);
        badges.mint(player, 1);
        vm.expectRevert(abi.encodeWithSelector(PaloozaBadges.AlreadyHolds.selector, player, 1));
        badges.mint(player, 1);
        vm.stopPrank();
    }

    // EN: Test —  only minter.
    // ES: Prueba —  only minter (ver nombre de la función).
    function test_onlyMinter() public {
        vm.expectRevert(PaloozaBadges.NotMinter.selector);
        badges.mint(player, 1);
    }

    // EN: Test —  unknown badge.
    // ES: Prueba —  unknown badge (ver nombre de la función).
    function test_unknownBadge() public {
        vm.prank(minter);
        vm.expectRevert(abi.encodeWithSelector(PaloozaBadges.UnknownBadge.selector, 99));
        badges.mint(player, 99);
    }

    // EN: Test —  paused.
    // ES: Prueba —  paused (ver nombre de la función).
    function test_paused() public {
        vm.prank(owner);
        badges.setPaused(true);
        vm.prank(minter);
        vm.expectRevert(PaloozaBadges.IsPaused.selector);
        badges.mint(player, 1);
    }

    // EN: Soulbound: every transfer path reverts. / ES: Soulbound: toda transferencia revierte.
    // EN: Test —  soulbound.
    // ES: Prueba —  soulbound (ver nombre de la función).
    function test_soulbound() public {
        vm.prank(minter);
        badges.mint(player, 1);
        vm.startPrank(player);
        vm.expectRevert(PaloozaBadges.Soulbound.selector);
        badges.safeTransferFrom(player, address(1), 1, 1, "");
        vm.expectRevert(PaloozaBadges.Soulbound.selector);
        badges.setApprovalForAll(address(1), true);
        uint256[] memory a = new uint256[](1);
        vm.expectRevert(PaloozaBadges.Soulbound.selector);
        badges.safeBatchTransferFrom(player, address(1), a, a, "");
        vm.stopPrank();
        assertFalse(badges.isApprovedForAll(player, address(1)));
    }

    // EN: Test —  burn own.
    // ES: Prueba —  burn own (ver nombre de la función).
    function test_burnOwn() public {
        vm.prank(minter);
        badges.mint(player, 1);
        vm.prank(player);
        badges.burn(1);
        assertEq(badges.balanceOf(player, 1), 0);
        vm.prank(player);
        vm.expectRevert(PaloozaBadges.NotHolder.selector);
        badges.burn(1);
    }

    // EN: Test —  only owner admin.
    // ES: Prueba —  only owner admin (ver nombre de la función).
    function test_onlyOwnerAdmin() public {
        vm.expectRevert(PaloozaBadges.NotOwner.selector);
        badges.setMinter(address(2), true);
        vm.expectRevert(PaloozaBadges.NotOwner.selector);
        badges.registerBadge(2, "x");
    }

    // EN: Test —  revoke minter.
    // ES: Prueba —  revoke minter (ver nombre de la función).
    function test_revokeMinter() public {
        vm.prank(owner);
        badges.setMinter(minter, false);
        vm.prank(minter);
        vm.expectRevert(PaloozaBadges.NotMinter.selector);
        badges.mint(player, 1);
    }

    // EN: Test —  transfer ownership.
    // ES: Prueba —  transfer ownership (ver nombre de la función).
    function test_transferOwnership() public {
        vm.prank(owner);
        badges.transferOwnership(address(0xD00D));
        assertEq(badges.owner(), address(0xD00D));
        vm.prank(owner);
        vm.expectRevert(PaloozaBadges.NotOwner.selector);
        badges.setPaused(true);
    }

    // EN: Test —  interfaces.
    // ES: Prueba —  interfaces (ver nombre de la función).
    function test_interfaces() public view {
        assertTrue(badges.supportsInterface(0xd9b67a26));
        assertFalse(badges.supportsInterface(0xffffffff));
        assertEq(badges.uri(1), "ipfs://first_game");
    }

    // EN: Fuzz: any non-minter is rejected. / ES: Fuzz: cualquier no-minter es rechazado.
    // EN: Test — fuzz non minter.
    // ES: Prueba — fuzz non minter (ver nombre de la función).
    function testFuzz_nonMinter(address who) public {
        vm.assume(who != minter);
        vm.prank(who);
        vm.expectRevert(PaloozaBadges.NotMinter.selector);
        badges.mint(player, 1);
    }
}
