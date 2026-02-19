// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
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
    uint8 public immutable nairaDecimals;
    uint8 public immutable usdcDecimals;

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
        nairaDecimals = IERC20Metadata(_naira).decimals();
        usdcDecimals = IERC20Metadata(_usdc).decimals();
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
        uint256 pending = pendingNaira[user];
        require(pending > 0, "No pending deposit");

        // If caller passes 0 or too large amount, process full pending backlog.
        uint256 amountToProcess =
            (nairaAmount == 0 || nairaAmount > pending) ? pending : nairaAmount;
        pendingNaira[user] = pending - amountToProcess;

        // Decimals-safe conversion:
        // usdcAmount = (nairaAmount / NAIRA_PER_USDC) adjusted from NAIRA decimals to USDC decimals.
        uint256 usdcAmount = (amountToProcess * (10 ** usdcDecimals)) /
            (NAIRA_PER_USDC * (10 ** nairaDecimals));
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
