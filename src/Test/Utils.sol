//SPDX-License-Identifier: MIT
pragma solidity =0.8.6;

contract Utils {
    /// @dev for tests only. this must be exact replica of the one in
    /// ReNft.sol
    function unpackPrice(bytes4 _price, uint256 _scale)
        public
        pure
        returns (uint256)
    {
        ensureIsUnpackablePrice(_price, _scale);

        // whole := if _price is 0x00120034, then whole is uint16(0x0012)
        // decimal := uin16(0x0034)
        // we only support dp4 precision for decimals. i.e. you can only have
        // numerals after the decimal place ABCD.wxyz. e.g. 1.8271
        // 1.8271 represents amount in the default scale of the payment token
        // i.e. if .decimals() of the ERC20 is 6, then 1.8271 * (10 ** 6)
        uint16 whole = uint16(bytes2(_price));
        uint16 decimal = uint16(bytes2(_price << 16));
        uint256 decimalScale = _scale / 10000;

        if (whole > 9999) {
            whole = 9999;
        }
        if (decimal > 9999) {
            decimal = 9999;
        }

        uint256 w = whole * _scale;
        uint256 d = decimal * decimalScale;
        uint256 price = w + d;

        return price;
    }

    function ensureIsUnpackablePrice(bytes4 _price, uint256 _scale)
        private
        pure
    {
        require(uint32(_price) > 0, "invalid price");
        require(_scale >= 10000, "invalid scale");
    }
}
