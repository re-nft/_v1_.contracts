// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract USDT is ERC20 {
    constructor() ERC20("USDT", "USDT") {
        _mint(
            0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266,
            1000000000000000000000000000000000
        );
    }
    function decimals() public view virtual override returns (uint8) {
        return 6;
    }
}
