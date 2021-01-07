// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "openzeppelin-solidity/contracts/token/ERC721/ERC721.sol";

contract MyERC721 is ERC721 {
    event NewFace(address indexed owner, uint256 indexed tokenId, string tokenURI);
    uint256 tokenId;
    constructor() ERC721("GANFACE", "GF") {}
    function award(string memory _tokenURI) public returns (uint256) {
        tokenId++;
        _mint(msg.sender, tokenId);
        _setTokenURI(tokenId, _tokenURI);
        emit NewFace(msg.sender, tokenId, _tokenURI);
        return tokenId;
    }
}
