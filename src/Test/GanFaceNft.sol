// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "openzeppelin-solidity/contracts/token/ERC721/ERC721.sol";
import "openzeppelin-solidity/contracts/utils/ReentrancyGuard.sol";
import "openzeppelin-solidity/contracts/utils/Counters.sol";

contract GanFaceNft is ERC721, ReentrancyGuard {
    using Counters for Counters.Counter;
    Counters.Counter private __tokenIds;

    event NewFace(address indexed owner, uint256 indexed tokenId, string tokenURI);

    constructor() ERC721("GANFACE", "GF") {}

    function awardGanFace(string memory _tokenURI) public nonReentrant returns (uint256) {
        __tokenIds.increment();

        uint256 newItemId = __tokenIds.current();
        _mint(msg.sender, newItemId);
        _setTokenURI(newItemId, _tokenURI);

        emit NewFace(msg.sender, newItemId, _tokenURI);

        return newItemId;
    }
}
