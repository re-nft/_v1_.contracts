// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0 <0.8.0;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MyERC20 is ERC20 {
    constructor() ERC20("MyERC20", "E20") {
        _mint(address(msg.sender), 1000000000000000000000000000000000);
    }
}
