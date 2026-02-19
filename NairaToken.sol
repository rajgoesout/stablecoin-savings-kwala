// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/*
OpenZeppelin v5 imports
*/
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract NairaToken is ERC20, ERC20Permit, Ownable {

    constructor()
        ERC20("Demo Naira", "NAIRA")
        ERC20Permit("Demo Naira")
        Ownable(msg.sender)
    {
        // Mint 1,000,000 NAIRA to deployer for demo
        _mint(msg.sender, 1_000_000 * 10 ** decimals());
    }

    /*
        Optional faucet function for demo
        So African community users can test easily
    */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    // Keep NAIRA decimals aligned with USDC for the demo conversion logic.
    function decimals() public pure override returns (uint8) {
        return 6;
    }
}
