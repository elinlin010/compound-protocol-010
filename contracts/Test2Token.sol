pragma solidity ^0.5.16;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";

contract Test2Token is ERC20, ERC20Detailed {
    constructor(uint256 initialSupply) ERC20Detailed("Test2Token", "T2T", 18) public {
        _mint(msg.sender, initialSupply);
    }
}