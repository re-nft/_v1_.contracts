//SPDX-License-Identifier: MIT
pragma solidity >=0.7.0 <0.8.0;

contract Utils {
    /// @dev for tests only. this must be exact replica of the one in
    /// RentNft.sol
    function _unpackPrice(bytes4 _price, uint256 _scale) external pure returns (uint256) {
        uint16 whole = uint16(bytes2(_price));
        uint16 decimal = uint16(bytes2(_price << 16));
        uint256 w = whole * _scale;
        // reason this is not more is:
        // can't express 0.7 or 0.8 if allow 1 to 65535
        // if 0 to 9999 then you can
        if (decimal > 9999) {
            decimal = 9999;
        }
        // scaling appropriately the decimal
        // appropriately means by: _scale / (10 * (5 - num digits in decimal))
        uint16 remainder = decimal;
        uint8 decimals = 0;
        while (remainder != 0) {
            remainder = remainder / 10;
            decimals++;
        }
        require(_scale > decimals, "invalid");
        uint256 d = (decimal * _scale) / decimals;
        uint256 price = w + d;
        require(price >= w, "invalid price");
        return price;
    }
}
