// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// T for Token. D1 for decimals 1
contract TD1 is ERC20 {
    constructor() ERC20("TD1", "TD1") {
        _mint(
            0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266,
            1000000000000000000000000000000000
        );
    }

    function decimals() public view virtual override returns (uint8) {
        return 1;
    }
}
