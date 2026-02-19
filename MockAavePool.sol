// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/*
    Minimal mock for demo/testing.
    - Keeps the same supply(...) function signature as Aave Pool.
    - Applies mock yield at ~1% per minute (simple interest).
    - Exposes read helpers for frontend position/yield/APR display.
*/
contract MockAavePool {
    using SafeERC20 for IERC20;

    uint256 public constant BPS = 10_000;
    uint256 public constant RATE_BPS_PER_MINUTE = 100; // 1.00% / minute
    uint256 public constant SECONDS_PER_MINUTE = 60;

    // 1%/minute simple APR = 0.01 * 60 * 24 * 365 = 5256.00 = 525,600%
    uint256 public constant APR_BPS = 52_560_000;

    struct Position {
        uint256 principal;      // includes realized mock yield after accrual
        uint64 lastAccruedAt;   // timestamp of last accrual
    }

    // asset => user => position
    mapping(address => mapping(address => Position)) private positions;

    event Supplied(
        address indexed caller,
        address indexed asset,
        address indexed onBehalfOf,
        uint256 amount,
        uint16 referralCode
    );

    function supply(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16 referralCode
    ) external {
        require(asset != address(0), "Invalid asset");
        require(onBehalfOf != address(0), "Invalid user");
        require(amount > 0, "Invalid amount");

        _accrue(asset, onBehalfOf);

        // Mimics Aave pull model: pool pulls token from caller.
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);

        Position storage p = positions[asset][onBehalfOf];
        p.principal += amount;

        emit Supplied(msg.sender, asset, onBehalfOf, amount, referralCode);
    }

    function getBalance(address asset, address user) external view returns (uint256) {
        return _previewBalance(asset, user);
    }

    function getYield(address asset, address user) external view returns (uint256) {
        Position memory p = positions[asset][user];
        uint256 current = _previewBalance(asset, user);
        if (current <= p.principal) return 0;
        return current - p.principal;
    }

    function getPosition(address asset, address user)
        external
        view
        returns (
            uint256 principal,
            uint256 currentBalance,
            uint256 currentYield,
            uint64 lastAccruedAt
        )
    {
        Position memory p = positions[asset][user];
        currentBalance = _previewBalance(asset, user);
        currentYield = currentBalance > p.principal ? currentBalance - p.principal : 0;
        return (p.principal, currentBalance, currentYield, p.lastAccruedAt);
    }

    function getMockAprBps() external pure returns (uint256) {
        return APR_BPS;
    }

    function getMockAprPercentX100() external pure returns (uint256) {
        // 525600.00% => 52560000 in x100 representation.
        return APR_BPS;
    }

    function _accrue(address asset, address user) internal {
        Position storage p = positions[asset][user];

        if (p.lastAccruedAt == 0) {
            p.lastAccruedAt = uint64(block.timestamp);
            return;
        }

        if (p.principal == 0) {
            p.lastAccruedAt = uint64(block.timestamp);
            return;
        }

        uint256 elapsedMinutes = (block.timestamp - uint256(p.lastAccruedAt)) / SECONDS_PER_MINUTE;
        if (elapsedMinutes == 0) return;

        uint256 accrued = (p.principal * RATE_BPS_PER_MINUTE * elapsedMinutes) / BPS;
        p.principal += accrued;
        p.lastAccruedAt += uint64(elapsedMinutes * SECONDS_PER_MINUTE);
    }

    function _previewBalance(address asset, address user) internal view returns (uint256) {
        Position memory p = positions[asset][user];
        if (p.principal == 0 || p.lastAccruedAt == 0) return p.principal;

        uint256 elapsedMinutes = (block.timestamp - uint256(p.lastAccruedAt)) / SECONDS_PER_MINUTE;
        if (elapsedMinutes == 0) return p.principal;

        uint256 accrued = (p.principal * RATE_BPS_PER_MINUTE * elapsedMinutes) / BPS;
        return p.principal + accrued;
    }
}
