// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@chainlink/contracts-ccip/contracts/interfaces/IRouterClient.sol";
import "@chainlink/contracts-ccip/contracts/applications/CCIPReceiver.sol";
import "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./FeeManager.sol";
import "./BridgeToken.sol";

/**
 * @title Bridge
 * @dev Main Bridge contract using Chainlink CCIP.
 */
contract Bridge is CCIPReceiver, AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    FeeManager public feeManager;

    // CCIP chain selector => target Bridge contract address
    mapping(uint64 => address) public peerBridges;

    // Supported tokens mapping (tokenAddress => isSupported)
    mapping(address => bool) public supportedTokens;

    // Token bridging model: false = Lock/Release, true = Burn/Mint
    mapping(address => bool) public tokenBridgeModel;

    event BridgeSent(
        bytes32 indexed messageId,
        address indexed sender,
        address indexed receiver,
        uint64 destinationChainSelector,
        address token,
        uint256 amount,
        uint256 platformFee,
        uint256 ccipFee
    );

    event BridgeReceived(
        bytes32 indexed messageId,
        address indexed receiver,
        uint64 sourceChainSelector,
        address token,
        uint256 amount
    );

    event PeerBridgeSet(uint64 indexed chainSelector, address indexed peerAddress);
    event TokenStatusSet(address indexed token, bool supported, bool isBurnMint);
    event FeeManagerUpdated(address indexed oldFeeManager, address indexed newFeeManager);

    constructor(
        address _router,
        address _feeManager,
        address admin
    ) CCIPReceiver(_router) {
        require(_feeManager != address(0), "Zero fee manager address");
        feeManager = FeeManager(payable(_feeManager));

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    /**
     * @dev Sets target bridge contracts on peer chains.
     */
    function setPeerBridge(uint64 chainSelector, address peerAddress) external onlyRole(DEFAULT_ADMIN_ROLE) {
        peerBridges[chainSelector] = peerAddress;
        emit PeerBridgeSet(chainSelector, peerAddress);
    }

    /**
     * @dev Configures supported tokens and bridging model (lock/release or burn/mint).
     */
    function setTokenStatus(
        address token,
        bool supported,
        bool isBurnMint
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        supportedTokens[token] = supported;
        tokenBridgeModel[token] = isBurnMint;
        emit TokenStatusSet(token, supported, isBurnMint);
    }

    /**
     * @dev Updates the FeeManager contract address.
     */
    function setFeeManager(address _feeManager) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_feeManager != address(0), "Zero fee manager address");
        emit FeeManagerUpdated(address(feeManager), _feeManager);
        feeManager = FeeManager(payable(_feeManager));
    }

    /**
     * @dev Pauses bridging transactions.
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @dev Unpauses bridging transactions.
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /**
     * @dev Estimates total native gas fee required for bridge transaction.
     * Returns: (platformFlatFee, ccipFee, tokenPlatformFee)
     */
    function estimateBridgeFees(
        uint64 destinationChainSelector,
        address token,
        uint256 amount
    ) public view returns (uint256 platformFlatFee, uint256 ccipFee, uint256 tokenPlatformFee) {
        address targetBridge = peerBridges[destinationChainSelector];
        if (targetBridge == address(0)) return (0, 0, 0);

        platformFlatFee = feeManager.flatNativeFee();
        tokenPlatformFee = feeManager.calculateTokenFee(amount);

        // Construct empty message for fee estimation
        Client.EVMTokenAmount[] memory tokenAmounts = new Client.EVMTokenAmount[](1);
        tokenAmounts[0] = Client.EVMTokenAmount({
            token: token,
            amount: amount - tokenPlatformFee
        });

        Client.EVM2AnyMessage memory message = Client.EVM2AnyMessage({
            receiver: abi.encode(targetBridge),
            data: abi.encode(msg.sender),
            tokenAmounts: tokenAmounts,
            extraArgs: Client._argsToBytes(
                Client.EVMExtraArgsV1({gasLimit: 200000})
            ),
            feeToken: address(0) // Pay CCIP fee in native gas
        });

        ccipFee = IRouterClient(getRouter()).getFee(destinationChainSelector, message);
    }

    /**
     * @dev Initiates cross-chain bridging of tokens.
     */
    function bridgeToken(
        uint64 destinationChainSelector,
        address token,
        uint256 amount,
        address receiver
    ) external payable whenNotPaused nonReentrant returns (bytes32 messageId) {
        require(supportedTokens[token], "Token not supported");
        require(peerBridges[destinationChainSelector] != address(0), "Target chain bridge not configured");
        require(receiver != address(0), "Zero address receiver");
        require(amount > 0, "Amount must be greater than 0");

        (uint256 platformFlatFee, uint256 ccipFee, uint256 tokenPlatformFee) = estimateBridgeFees(
            destinationChainSelector,
            token,
            amount
        );

        require(msg.value >= platformFlatFee + ccipFee, "Insufficient native gas for fees");

        // Transfer tokens from user to Bridge
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        // Pay token platform fee to FeeManager
        if (tokenPlatformFee > 0) {
            IERC20(token).safeTransfer(address(feeManager), tokenPlatformFee);
        }

        uint256 remainingAmount = amount - tokenPlatformFee;

        // Approve CCIP router to withdraw remaining token
        IERC20(token).approve(getRouter(), remainingAmount);

        // Construct CCIP message
        Client.EVMTokenAmount[] memory tokenAmounts = new Client.EVMTokenAmount[](1);
        tokenAmounts[0] = Client.EVMTokenAmount({
            token: token,
            amount: remainingAmount
        });

        Client.EVM2AnyMessage memory message = Client.EVM2AnyMessage({
            receiver: abi.encode(peerBridges[destinationChainSelector]),
            data: abi.encode(receiver),
            tokenAmounts: tokenAmounts,
            extraArgs: Client._argsToBytes(
                Client.EVMExtraArgsV1({gasLimit: 200000})
            ),
            feeToken: address(0) // Paid in native gas
        });

        // Pay platform native fee to FeeManager
        if (platformFlatFee > 0) {
            (bool success, ) = address(feeManager).call{value: platformFlatFee}("");
            require(success, "Platform fee transfer failed");
        }

        // Send CCIP Message
        messageId = IRouterClient(getRouter()).ccipSend{value: ccipFee}(
            destinationChainSelector,
            message
        );

        // Refund any excess native gas to sender
        uint256 spentGas = platformFlatFee + ccipFee;
        if (msg.value > spentGas) {
            (bool success, ) = msg.sender.call{value: msg.value - spentGas}("");
            require(success, "Refund failed");
        }

        emit BridgeSent(
            messageId,
            msg.sender,
            receiver,
            destinationChainSelector,
            token,
            remainingAmount,
            platformFlatFee,
            ccipFee
        );
    }

    /**
     * @dev Internal CCIP Receiver hook to process bridging in.
     */
    function _ccipReceive(Client.Any2EVMMessage memory message) internal override {
        // Decode peer sender address and verify
        address peerBridge = abi.decode(message.sender, (address));
        require(peerBridges[message.sourceChainSelector] == peerBridge, "Unauthorized sender contract");

        // Decode recipient address from payload
        address receiver = abi.decode(message.data, (address));

        // Process incoming tokens
        uint256 length = message.destTokenAmounts.length;
        for (uint256 i = 0; i < length; i++) {
            address token = message.destTokenAmounts[i].token;
            uint256 amount = message.destTokenAmounts[i].amount;

            // Release tokens to recipient
            IERC20(token).safeTransfer(receiver, amount);

            emit BridgeReceived(message.messageId, receiver, message.sourceChainSelector, token, amount);
        }
    }

    /**
     * @dev Overrides supportsInterface to resolve conflict between CCIPReceiver and AccessControl.
     */
    function supportsInterface(bytes4 interfaceId)
        public
        pure
        override(CCIPReceiver, AccessControl)
        returns (bool)
    {
        return
            interfaceId == type(IAny2EVMMessageReceiver).interfaceId ||
            interfaceId == 0x7965db0b || // IAccessControl interface ID
            interfaceId == 0x01ffc9a7;   // IERC165 interface ID
    }

    // Allow contract to receive native gas
    receive() external payable {}
}
