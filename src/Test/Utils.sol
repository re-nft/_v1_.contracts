//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Utils {
    /// @dev for tests only. this must be exact replica of the one in
    /// ReNft.sol

    function _unpackPrice(bytes4 _price, uint256 _scale) external pure returns (uint256) {
        uint16 whole = uint16(bytes2(_price));
        uint16 decimal = uint16(bytes2(_price << 16));
        uint256 decimalScale = _scale / 10000;
        if (whole > 9999) {
            whole = 9999;
        }
        uint256 w = whole * _scale;
        if (decimal > 9999) {
            decimal = 9999;
        }
        uint256 d = decimal * decimalScale;
        uint256 price = w + d;
        require(price >= w, "invalid price");
        if (price == 0) {
            price = decimalScale;
        }
        return price;
    }
}
