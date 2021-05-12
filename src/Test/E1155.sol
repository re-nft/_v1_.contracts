// SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

contract E1155 is ERC1155 {
    uint256 private tokenId;
    uint256 public constant GOLD = 1000;
    uint256 public constant SILVER = 1001;
    uint256 public constant THORS_HAMMER = 1002;
    uint256 public constant SWORD = 1003;
    uint256 public constant SHIELD = 1004;

    constructor() ERC1155("https://api.bccg.digital/api/bccg/") {
        _mint(0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266, GOLD, 1, "");
        _mint(0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266, SILVER, 10, "");
        _mint(0x70997970C51812dc3A010C7d01b50e0d17dc79C8, THORS_HAMMER, 20, "");
        _mint(0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC, SWORD, 1, "");
        _mint(0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC, SHIELD, 20, "");
    }

    function award() public returns (uint256) {
        tokenId++;
        _mint(msg.sender, tokenId, 1, "");
        return tokenId;
    }
}
