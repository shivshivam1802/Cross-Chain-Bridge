// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title FeeManager
 * @dev Manages bridge fees, including flat native fees and percentage-based token fees.
 */
contract FeeManager is AccessControl {
    using SafeERC20 for IERC20;

    bytes32 public constant FEE_CONFIGURATOR_ROLE = keccak256("FEE_CONFIGURATOR_ROLE");
    bytes32 public constant WITHDRAWER_ROLE = keccak256("WITHDRAWER_ROLE");

    uint256 public flatNativeFee; // Fee in wei (e.g. 0.005 ETH)
    uint256 public percentageFeeBps; // Fee in basis points (1 bps = 0.01%, 100 bps = 1%)
    uint256 public constant MAX_BPS = 10000;

    event FlatNativeFeeUpdated(uint256 oldFee, uint256 newFee);
    event PercentageFeeBpsUpdated(uint256 oldBps, uint256 newBps);
    event FeesWithdrawn(address indexed token, address indexed to, uint256 amount);

    constructor(
        uint256 _flatNativeFee,
        uint256 _percentageFeeBps,
        address admin
    ) {
        require(_percentageFeeBps <= 1000, "Fee too high (max 10%)");
        flatNativeFee = _flatNativeFee;
        percentageFeeBps = _percentageFeeBps;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(FEE_CONFIGURATOR_ROLE, admin);
        _grantRole(WITHDRAWER_ROLE, admin);
    }

    /**
     * @dev Calculates the percentage fee for a given transfer amount.
     */
    function calculateTokenFee(uint256 amount) public view returns (uint256) {
        return (amount * percentageFeeBps) / MAX_BPS;
    }

    /**
     * @dev Sets the flat native gas fee. Only callable by FEE_CONFIGURATOR_ROLE.
     */
    function setFlatNativeFee(uint256 _newFee) external onlyRole(FEE_CONFIGURATOR_ROLE) {
        emit FlatNativeFeeUpdated(flatNativeFee, _newFee);
        flatNativeFee = _newFee;
    }

    /**
     * @dev Sets the percentage fee in basis points. Only callable by FEE_CONFIGURATOR_ROLE.
     */
    function setPercentageFeeBps(uint256 _newBps) external onlyRole(FEE_CONFIGURATOR_ROLE) {
        require(_newBps <= 1000, "Fee too high (max 10%)");
        emit PercentageFeeBpsUpdated(percentageFeeBps, _newBps);
        percentageFeeBps = _newBps;
    }

    /**
     * @dev Withdraws collected native gas fees or ERC-20 token fees. Only callable by WITHDRAWER_ROLE.
     */
    function withdrawFees(address token, address payable to) external onlyRole(WITHDRAWER_ROLE) {
        require(to != address(0), "Zero address receiver");
        uint256 amount;
        if (token == address(0)) {
            amount = address(this).balance;
            require(amount > 0, "No native balance");
            (bool success, ) = to.call{value: amount}("");
            require(success, "Native transfer failed");
        } else {
            amount = IERC20(token).balanceOf(address(this));
            require(amount > 0, "No token balance");
            IERC20(token).safeTransfer(to, amount);
        }
        emit FeesWithdrawn(token, to, amount);
    }

    // Allow contract to receive native gas
    receive() external payable {}
}
