// SPDX-License-Identifier: MIT
pragma solidity =0.8.6;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract E721B is Ownable, ERC721Enumerable {
    uint256 private counter = 0;
    using Strings for uint256;

    // Optional mapping for token URIs
    mapping(uint256 => string) private _tokenURIs;

    // Base URI
    string private _baseURIextended;

    constructor() ERC721("E721B", "E721B") {
        _tokenURIs[1] = "https://api.bccg.digital/api/bccg/1";
        _tokenURIs[2] = "https://api.bccg.digital/api/bccg/2";
        _tokenURIs[3] = "https://api.bccg.digital/api/bccg/3";
        _tokenURIs[4] = "https://api.bccg.digital/api/bccg/4";
        _tokenURIs[5] = "https://api.bccg.digital/api/bccg/5";
        _tokenURIs[6] = "https://api.bccg.digital/api/bccg/6";
        _tokenURIs[7] = "https://api.bccg.digital/api/bccg/7";
        _tokenURIs[8] = "https://api.bccg.digital/api/bccg/8";
        _tokenURIs[9] = "https://api.bccg.digital/api/bccg/9";
        _tokenURIs[10] = "https://api.bccg.digital/api/bccg/10";
    }

    function setBaseURI(string memory baseURI_) external onlyOwner() {
        _baseURIextended = baseURI_;
    }

    function _setTokenURI(uint256 tokenId, string memory _tokenURI)
        internal
        virtual
    {
        require(
            _exists(tokenId),
            "ERC721Metadata: URI set of nonexistent token"
        );
        _tokenURIs[tokenId] = _tokenURI;
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseURIextended;
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override
        returns (string memory)
    {
        require(
            _exists(tokenId),
            "ERC721Metadata: URI query for nonexistent token"
        );
        string memory _tokenURI = _tokenURIs[(tokenId % 10) + 1];
        return _tokenURI;
    }

    function award() public returns (uint256) {
        counter++;
        _mint(msg.sender, counter);
        return counter;
    }

    // to stay consistent with erc20s
    function faucet() public {
        counter++;
        _mint(msg.sender, counter);
    }
}
