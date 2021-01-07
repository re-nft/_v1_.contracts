// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/access/Ownable.sol";

contract Resolver is Ownable {
    mapping(uint8 => IERC20) private addresses;

    enum PaymentToken {
        DAI, // 0
        USDC, // 1
        USDT, // 2
        TUSD // ...
    }

    function getPaymentToken(uint8 _pt) public view returns (IERC20) {
        return addresses[_pt];
    }

    function setPaymentToken(uint8 _pt, IERC20 _v) public onlyOwner {
        addresses[_pt] = _v;
    }
}
