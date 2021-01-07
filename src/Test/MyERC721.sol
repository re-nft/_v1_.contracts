// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "openzeppelin-solidity/contracts/token/ERC721/ERC721.sol";

contract MyERC721 is ERC721 {
    event NewFace(address indexed owner, uint256 indexed tokenId, string tokenURI);
    uint256 private tokenId;
    string[] private tokenUris = ["", "", "", "", "", "", "", "", "", ""];

    constructor() ERC721("GANFACE", "GF") {}

    function award() public returns (uint256) {
        tokenId++;
        _mint(msg.sender, tokenId);
        _setTokenURI(tokenId, tokenUris[tokenId - 1]);
        emit NewFace(msg.sender, tokenId, tokenUris[tokenId - 1]);
        return tokenId;
    }
}
