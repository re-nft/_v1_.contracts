// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0 <0.8.0;
import "@openzeppelin/contracts/access/Ownable.sol";

contract Resolver is Ownable {
    mapping(uint8 => address) private addresses;
    enum PaymentToken {
        SENTINEL, // 0
        ETH, // 1
        DAI, // 2
        USDC, // 3
        USDT, // 4
        TUSD // ...
    }
    function getPaymentToken(uint8 _pt) public view returns (address) {
        return addresses[_pt];
    }
    function setPaymentToken(uint8 _pt, address _v) public onlyOwner {
        if (_pt == 1) {
            require(_v == address(0), "eth sentinel");
        }
        addresses[_pt] = _v;
    }
}
