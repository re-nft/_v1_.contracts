// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Faucet {
    function requestToken(address _token) public {
        IERC20 token = IERC20(_token);
        token.transfer(msg.sender, 1000 ether);
    }
}
