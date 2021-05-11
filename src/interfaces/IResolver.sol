// SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

interface IResolver {
    enum PaymentToken {
        SENTINEL, // 0 <- marks non-existence, nil of the payment tokens
        WETH, // 1
        DAI, // 2
        USDC, // 3
        USDT, // 4
        TUSD // 5
    }

    /**
     * @dev util function to avoid guessing getter name if addresses was public
     */
    function getPaymentToken(uint8 _pt) external view returns (address);

    /**
     * @dev Gives us the ability to set new payment tokens down the line
     */
    function setPaymentToken(uint8 _pt, address _v) external;
}
