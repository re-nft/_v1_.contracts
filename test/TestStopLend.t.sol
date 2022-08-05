// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "@src/interfaces/IReNFT.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract TestStopLend is Test {

    // Lend Transaction: https://etherscan.io/tx/0xcd81283b04be331224d91bf935785a7bdd310306e03d0b638b5d4943b24b49ab

    IReNft public escrow;
    address public user;
    IERC721 public nft;
    uint256 public tokenId;
    uint256 public lendingId;
    uint256 public mainnetFork;
    uint256 public constant startingBlock = 12875508;

    function setUp() public {
        escrow = IReNft(address(0x94D8f036a0fbC216Bb532D33bDF6564157Af0cD7));
        vm.label(address(escrow), "escrow");

        user = address(0xac4A7e225c846bf3c5D5b0d6E95d182D2e7CBfaC);
        vm.label(user, "user");

        nft = IERC721(address(0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85));
        vm.label(address(nft), "nft");

        tokenId = uint256(38149111538455630346495174474432757253228782613965714864841314234254558761306);
        lendingId = uint256(377);

        mainnetFork = vm.createFork("https://eth-mainnet.g.alchemy.com/v2/gzW_AM5KAcNAtA2ARgydw8UVe5PER458", startingBlock);

        vm.selectFork(mainnetFork);
    }

    /**
     * Contract should actually be the "owner"
     * search here by tokenId
     * https://etherscan.io/tokenholdings?a=0x94D8f036a0fbC216Bb532D33bDF6564157Af0cD7
     */
    function testUserIsOwnerOfNFT() public {
        assertEq(nft.ownerOf(tokenId), user);

        // there should be no one approved to move nft
        assertEq(nft.getApproved(tokenId), address(0));
    }

    /**
     * This is reverting with --> "ReNFT::zero address"
     * should not happen!!!
     */
    function testStopLendingAsUser() public {
        address[] memory nfts = new address[](1);
        nfts[0] = address(nft);

        uint256[] memory tokenIds = new uint256[](1);
        tokenIds[0] = tokenId;

        uint256[] memory lendingIds = new uint256[](1);
        lendingIds[0] = lendingId;

        vm.prank(user, user);
        escrow.stopLending(nfts, tokenIds, lendingIds);
    }

    /**
    * lendingRenting mapping is stored in 7th memory slot of escrow contract
    * the individual entries are stored at keccak256(key, slot)
    */
    function testLendingRentingDataIsNull() public {
        bytes32 lrKey = keccak256(
                        abi.encodePacked(
                            address(nft),
                            tokenId,
                            lendingId
                        )
                    );

        bytes32 mappingKeyLocation = keccak256(abi.encode(lrKey, uint256(7)));

        bytes32 lrData = vm.load(address(escrow), mappingKeyLocation);

        assertEq(lrData, bytes32(0));
    }
}
