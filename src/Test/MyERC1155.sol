// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0 <0.8.0;
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

contract MyERC1155 is ERC1155 {
    //uint256 public constant GOLD = 0;
    //uint256 public constant SILVER = 1;
    // uint256 public constant THORS_HAMMER = 2;
    // uint256 public constant SWORD = 3;
    // uint256 public constant SHIELD = 4;
    uint256 private tokenId;

    // these strings are no longer stores on-chain
    // the only that matters in erc1155 is the base url
    // string[] public constant URIS = [
    //     "https://nft.service.cometh.io/3000013",
    //     "https://nft.service.cometh.io/3000015",
    //     "https://nft.service.cometh.io/6000327",
    //     "https://nft.service.cometh.io/6000328",
    //     "https://nft.service.cometh.io/6000329",
    //     "https://rope.lol/api/RMU/51",
    //     "https://rope.lol/api/RMU/52",
    //     "https://api.bccg.digital/api/bccg/9",
    //     "https://api.bccg.digital/api/bccg/11",
    //     "https://api.bccg.digital/api/bccg/1"
    // ];

    constructor() public ERC1155("https://game.example/api/item/") {
        // _mint(msg.sender, GOLD, 10**18, "");
        // _mint(msg.sender, SILVER, 10**27, "");
        // _mint(msg.sender, THORS_HAMMER, 1, "");
        // _mint(msg.sender, SWORD, 10**9, "");
        // _mint(msg.sender, SHIELD, 10**9, "");
    }

    function award() public returns (uint256) {
        tokenId++;
        _mint(msg.sender, tokenId, 1, "");
        return tokenId;
    }
}
