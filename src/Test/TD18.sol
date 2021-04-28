// SPDX-License-Identifier: MIT
pragma solidity ^0.8.3;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TD18 is ERC20 {
    constructor() ERC20("TD18", "TD18") {
        _mint(
            0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266,
            1000000000000000000000000000000000
        );
    }
}
