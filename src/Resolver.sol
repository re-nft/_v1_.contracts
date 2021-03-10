// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Resolver {
    address private admin;
    mapping(uint8 => address) private addresses;

    enum PaymentToken {
        ETH, // 0
        WETH, // 1
        DAI, // 2
        USDC, // 3
        USDT, // 4
        TUSD // 5
    }

    constructor(address _admin) {
        admin = _admin;
    }

    /**
     * @dev util function to avoid guessing getter name if addresses was public
     */
    function getPaymentToken(uint8 _pt) public view returns (address) {
        return addresses[_pt];
    }

    /**
     * @dev Gives us the ability to set new payment tokens down the line
     */
    function setPaymentToken(uint8 _pt, address _v) public {
        require(_pt != 0, "");
        require(addresses[_pt] == address(0), "cannot reset the address");

        addresses[_pt] = _v;
    }
}
