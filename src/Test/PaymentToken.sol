// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

contract PaymentToken is ERC20 {
    constructor() ERC20("DAI", "DAI") {
        _mint(address(msg.sender), 1000000000000000000000000000000000);
    }
}
