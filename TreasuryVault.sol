// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IAavePool {
    function supply(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16 referralCode
    ) external;
}

contract TreasuryVault is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable naira;
    IERC20 public immutable usdc;
    IAavePool public immutable aavePool;

    // Hardcoded demo conversion: 1 USDC = 1,350 NAIRA.
    // This assumes NAIRA token uses 6 decimals (same as USDC).
    uint256 public constant NAIRA_PER_USDC = 1350;
    mapping(address => uint256) public pendingNaira;

    event FundsReceived(address indexed user, uint256 nairaAmount);
    event FundsSwapped(address indexed user, uint256 usdcAmount);
    event FundsSupplied(address indexed user, uint256 usdcAmount);

    constructor(
        address _naira,
        address _usdc,
        address _aavePool
    ) Ownable(msg.sender) {
        naira = IERC20(_naira);
        usdc = IERC20(_usdc);
        aavePool = IAavePool(_aavePool);
    }

    /*
        Step 1: User deposits NAIRA
    */
    function deposit(uint256 amount) external {
        require(amount > 0, "Invalid amount");

        // Transfer NAIRA from user to contract
        naira.safeTransferFrom(msg.sender, address(this), amount);
        pendingNaira[msg.sender] += amount;

        emit FundsReceived(msg.sender, amount);
    }

    /*
        Step 2+3: backend caller executes conversion + Aave supply.

        SECURITY NOTE: callable by anyone for demo purposes only.
        In production, this must be restricted to an authorized role/signer.
    */
    function convertAndSupply(address user, uint256 nairaAmount) external {
        require(user != address(0), "Invalid user");
        require(nairaAmount > 0, "Invalid amount");
        require(pendingNaira[user] >= nairaAmount, "Amount exceeds pending deposit");
        pendingNaira[user] -= nairaAmount;

        // With both tokens at 6 decimals, divide only by FX rate.
        uint256 usdcAmount = nairaAmount / NAIRA_PER_USDC;
        require(usdcAmount > 0, "Amount too small");

        require(
            usdc.balanceOf(address(this)) >= usdcAmount,
            "Insufficient USDC liquidity"
        );

        emit FundsSwapped(user, usdcAmount);

        // Handle non-standard ERC20 approve behavior.
        usdc.forceApprove(address(aavePool), usdcAmount);

        // Supply to Aave V3 on behalf of user.
        aavePool.supply(address(usdc), usdcAmount, user, 0);

        emit FundsSupplied(user, usdcAmount);
    }

    /*
        Owner can preload USDC liquidity for swap simulation
    */
    function depositUSDC(uint256 amount) external {
        usdc.safeTransferFrom(msg.sender, address(this), amount);
    }
}
