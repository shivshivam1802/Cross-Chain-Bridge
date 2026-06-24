export interface NetworkConfig {
  name: string;
  chainId: number;
  ccipSelector: string;
  rpcUrl: string;
  bridgeAddress: string;
  feeManagerAddress: string;
  explorerUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

export const NETWORKS: { [chainId: number]: NetworkConfig } = {
  11155111: {
    name: "Ethereum Sepolia",
    chainId: 11155111,
    ccipSelector: "16015286601757825753",
    rpcUrl: "https://ethereum-sepolia-rpc.publicnode.com",
    bridgeAddress: "0x098679F1722421376A96C25B49dF4b93B1271101", // Example address (updated upon deploy)
    feeManagerAddress: "0x2Ffe68C1C8dfb9E1Db7776Fa610a72A4E0De5f8B",
    explorerUrl: "https://sepolia.etherscan.io",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }
  },
  80002: {
    name: "Polygon Amoy",
    chainId: 80002,
    ccipSelector: "1628171139167062214",
    rpcUrl: "https://rpc-amoy.polygon.technology",
    bridgeAddress: "0xa2F680D1b6fC3A7A5D275A0f4b9B127D9A4E0DE5",
    feeManagerAddress: "0x6E4C68c1E8dFb9E1Db7776Fa610a72A4E0De5f8B",
    explorerUrl: "https://amoy.polygonscan.com",
    nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 }
  },
  97: {
    name: "BNB Chain Testnet",
    chainId: 97,
    ccipSelector: "13264668187771770619",
    rpcUrl: "https://bsc-testnet-rpc.publicnode.com",
    bridgeAddress: "0xeE6C68c1E8dFb9E1Db7776Fa610a72A4E0De5f8B",
    feeManagerAddress: "0x9E4C68c1E8dFb9E1Db7776Fa610a72A4E0De5f8B",
    explorerUrl: "https://testnet.bscscan.com",
    nativeCurrency: { name: "BNB", symbol: "tBNB", decimals: 18 }
  },
  31337: {
    name: "Hardhat Local",
    chainId: 31337,
    ccipSelector: "0",
    rpcUrl: "http://127.0.0.1:8545",
    bridgeAddress: "0x5FbDB2315678afecb367f032d93F642f64180aa3", // Default Hardhat Deployments
    feeManagerAddress: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
    explorerUrl: "#",
    nativeCurrency: { name: "Test ETH", symbol: "tETH", decimals: 18 }
  }
};

export interface TokenConfig {
  symbol: string;
  name: string;
  decimals: number;
  addresses: { [chainId: number]: string };
  isBurnMint: boolean;
}

export const TOKENS: TokenConfig[] = [
  {
    symbol: "CCT",
    name: "Cross-Chain Token",
    decimals: 18,
    addresses: {
      11155111: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
      80002: "0xDc64a17db16601664791a00f94628461230e7049",
      97: "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
      31337: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"
    },
    isBurnMint: true
  }
];

export const BRIDGE_ABI = [
  "function bridgeToken(uint64 destinationChainSelector, address token, uint256 amount, address receiver) external payable returns (bytes32 messageId)",
  "function estimateBridgeFees(uint64 destinationChainSelector, address token, uint256 amount) external view returns (uint256 platformFlatFee, uint256 ccipFee, uint256 tokenPlatformFee)",
  "function feeManager() external view returns (address)",
  "function peerBridges(uint64 selector) external view returns (address)",
  "function supportedTokens(address token) external view returns (bool)",
  "function tokenBridgeModel(address token) external view returns (bool)",
  "function paused() external view returns (bool)",
  "function pause() external",
  "function unpause() external",
  "function setPeerBridge(uint64 chainSelector, address peerAddress) external",
  "function setTokenStatus(address token, bool supported, bool isBurnMint) external",
  "event BridgeSent(bytes32 indexed messageId, address indexed sender, address indexed receiver, uint64 destinationChainSelector, address token, uint256 amount, uint256 platformFee, uint256 ccipFee)",
  "event BridgeReceived(bytes32 indexed messageId, address indexed receiver, uint64 sourceChainSelector, address token, uint256 amount)"
];

export const TOKEN_ABI = [
  "function name() external view returns (string)",
  "function symbol() external view returns (string)",
  "function decimals() external view returns (uint8)",
  "function balanceOf(address account) external view returns (uint256)",
  "function transfer(address recipient, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function mint(address to, uint256 amount) external",
  "function burnFromAddress(address from, uint256 amount) external"
];

export const FEE_MANAGER_ABI = [
  "function flatNativeFee() external view returns (uint256)",
  "function percentageFeeBps() external view returns (uint256)",
  "function calculateTokenFee(uint256 amount) external view returns (uint256)",
  "function setFlatNativeFee(uint256 _newFee) external",
  "function setPercentageFeeBps(uint256 _newBps) external",
  "function withdrawFees(address token, address payable to) external"
];
