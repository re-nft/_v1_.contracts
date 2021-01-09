// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0 <0.8.0;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Resolver is Ownable {
    mapping(uint8 => IERC20) private addresses;
    enum PaymentToken {
        SENTINEL, // 0
        ETH, // 1
        DAI, // 2
        USDC, // 3
        USDT, // 4
        TUSD // ...
    }

    function getPaymentToken(uint8 _pt) public view returns (IERC20) {
        return addresses[_pt];
    }

    function setPaymentToken(uint8 _pt, IERC20 _v) public onlyOwner {
        addresses[_pt] = _v;
    }
}
