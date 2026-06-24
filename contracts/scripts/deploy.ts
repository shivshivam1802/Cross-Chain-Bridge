import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // 1. Deploy Fee Manager
  // Flat fee: 0.005 ETH, Percentage fee: 100 BPS (1%)
  const flatFee = ethers.parseEther("0.005");
  const pctFeeBps = 100n; // 1%

  const FeeManagerFactory = await ethers.getContractFactory("FeeManager");
  const feeManager = await FeeManagerFactory.deploy(flatFee, pctFeeBps, deployer.address);
  await feeManager.waitForDeployment();
  const feeManagerAddress = await feeManager.getAddress();
  console.log("FeeManager deployed to:", feeManagerAddress);

  // 2. Fetch mock CCIP router address (or deploy a mock router if local)
  // For local networks we can deploy a mock CCIP router or use zero address
  // Let's deploy a mock router if we are on a mock local network
  let routerAddress = ethers.ZeroAddress;
  
  // If we are deploying to Hardhat local, we can deploy a Mock Router
  const CCIPLocalSimulatorFactory = await ethers.getContractFactory("CCIPLocalSimulatorMock");
  const simulator = await CCIPLocalSimulatorFactory.deploy();
  await simulator.waitForDeployment();
  const config = await simulator.configuration();
  routerAddress = config.sourceRouter_;
  console.log("CCIP Simulator Router deployed to:", routerAddress);

  // 3. Deploy Bridge
  const BridgeFactory = await ethers.getContractFactory("Bridge");
  const bridge = await BridgeFactory.deploy(routerAddress, feeManagerAddress, deployer.address);
  await bridge.waitForDeployment();
  const bridgeAddress = await bridge.getAddress();
  console.log("Bridge deployed to:", bridgeAddress);

  // 4. Deploy BridgeToken
  const TokenFactory = await ethers.getContractFactory("BridgeToken");
  const token = await TokenFactory.deploy("Cross-Chain Token", "CCT", deployer.address);
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log("BridgeToken (CCT) deployed to:", tokenAddress);

  // 5. Configure Bridge permissions
  const MINTER_ROLE = await token.MINTER_ROLE();
  const BURNER_ROLE = await token.BURNER_ROLE();
  await token.grantRole(MINTER_ROLE, bridgeAddress);
  await token.grantRole(BURNER_ROLE, bridgeAddress);
  console.log("Granted MINTER and BURNER roles to Bridge contract.");

  // 6. Support token on Bridge
  await bridge.setTokenStatus(tokenAddress, true, true);
  console.log("Registered CCT token in Bridge contract configuration.");
  
  console.log("\n--- Deployment Complete ---");
  console.log(`Bridge Address: ${bridgeAddress}`);
  console.log(`Token Address: ${tokenAddress}`);
  console.log(`FeeManager Address: ${feeManagerAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
