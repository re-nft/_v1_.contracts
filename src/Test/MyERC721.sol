// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol";

contract MyERC721 is IERC721Metadata, ERC721Enumerable {
    event NewFace(address indexed owner, uint256 indexed tokenId, string tokenURI);
    uint256 private counter = 0;
    string[] private tokenUris = [
        "https://nft.service.cometh.io/3000013",
        "https://nft.service.cometh.io/3000015",
        "https://nft.service.cometh.io/6000327",
        "https://nft.service.cometh.io/6000328",
        "https://nft.service.cometh.io/6000329",
        "https://rope.lol/api/RMU/51",
        "https://rope.lol/api/RMU/52",
        "https://api.bccg.digital/api/bccg/9",
        "https://api.bccg.digital/api/bccg/11",
        "https://api.bccg.digital/api/bccg/1"
    ];

    constructor() ERC721("721", "721") {
        this;
    }

    function award() public returns (uint256) {
        counter++;
        _mint(msg.sender, counter);
        return counter;
    }

    function tokenURI(uint256 _tokenId) public view override(ERC721, IERC721Metadata) returns (string memory) {
        require(_exists(_tokenId), "ERC721Metadata: URI query for nonexistent token");
        string memory uri = tokenUris[_tokenId];
        return uri;
    }
}
