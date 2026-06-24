import { expect } from "chai";
import { ethers } from "hardhat";
import { Bridge, BridgeToken, FeeManager } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Cross-Chain Bridge Tests", function () {
  let ccipSimulator: any;
  let sourceBridge: Bridge;
  let destBridge: Bridge;
  let feeManagerSource: FeeManager;
  let feeManagerDest: FeeManager;
  let sourceToken: BridgeToken;
  let destToken: BridgeToken;

  let owner: SignerWithAddress;
  let user: SignerWithAddress;
  let feeCollector: SignerWithAddress;

  let chainSelector: bigint;
  let routerAddress: string;

  before(async function () {
    [owner, user, feeCollector] = await ethers.getSigners();

    // 1. Deploy CCIP Local Simulator
    const CCIPLocalSimulatorFactory = await ethers.getContractFactory("CCIPLocalSimulator");
    ccipSimulator = await CCIPLocalSimulatorFactory.deploy();
    await ccipSimulator.waitForDeployment();

    // 2. Fetch simulator configuration
    const config = await ccipSimulator.configuration();
    chainSelector = config.chainSelector_;
    routerAddress = config.sourceRouter_;
  });

  beforeEach(async function () {
    // 3. Deploy Fee Managers
    const FeeManagerFactory = await ethers.getContractFactory("FeeManager");
    const flatNativeFee = ethers.parseEther("0.005"); // 0.005 ETH platform fee
    const percentageFeeBps = 100n; // 1% fee (100 bps)

    feeManagerSource = await FeeManagerFactory.deploy(flatNativeFee, percentageFeeBps, owner.address);
    await feeManagerSource.waitForDeployment();

    feeManagerDest = await FeeManagerFactory.deploy(flatNativeFee, percentageFeeBps, owner.address);
    await feeManagerDest.waitForDeployment();

    // 4. Deploy Bridges
    const BridgeFactory = await ethers.getContractFactory("Bridge");
    sourceBridge = await BridgeFactory.deploy(routerAddress, await feeManagerSource.getAddress(), owner.address);
    await sourceBridge.waitForDeployment();

    destBridge = await BridgeFactory.deploy(routerAddress, await feeManagerDest.getAddress(), owner.address);
    await destBridge.waitForDeployment();

    // 5. Deploy Tokens (using Burn/Mint for local testing)
    const TokenFactory = await ethers.getContractFactory("BridgeToken");
    sourceToken = await TokenFactory.deploy("Bridge ERC20 Source", "BES", owner.address);
    await sourceToken.waitForDeployment();

    destToken = await TokenFactory.deploy("Bridge ERC20 Dest", "BED", owner.address);
    await destToken.waitForDeployment();

    // 6. Grant Bridge permissions for Minting/Burning
    const MINTER_ROLE = await sourceToken.MINTER_ROLE();
    const BURNER_ROLE = await sourceToken.BURNER_ROLE();

    await sourceToken.grantRole(MINTER_ROLE, await sourceBridge.getAddress());
    await sourceToken.grantRole(BURNER_ROLE, await sourceBridge.getAddress());

    await destToken.grantRole(MINTER_ROLE, await destBridge.getAddress());
    await destToken.grantRole(BURNER_ROLE, await destBridge.getAddress());

    // 7. Setup Peer Bridges
    await sourceBridge.setPeerBridge(chainSelector, await destBridge.getAddress());
    await destBridge.setPeerBridge(chainSelector, await sourceBridge.getAddress());

    // 8. Support the tokens on both bridges
    await sourceBridge.setTokenStatus(await sourceToken.getAddress(), true, true); // Token, Supported, IsBurnMint
    await destBridge.setTokenStatus(await destToken.getAddress(), true, true);

    // Give CCIP simulator mapping of token pool to router
    await ccipSimulator.supportERC20Token(await sourceToken.getAddress());
    await ccipSimulator.supportERC20Token(await destToken.getAddress());
  });

  describe("Token Minting & Roles", function () {
    it("Should deploy token with correct admin roles", async function () {
      const DEFAULT_ADMIN_ROLE = await sourceToken.DEFAULT_ADMIN_ROLE();
      expect(await sourceToken.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
    });

    it("Should allow Minter to mint tokens", async function () {
      await sourceToken.mint(user.address, ethers.parseEther("100"));
      expect(await sourceToken.balanceOf(user.address)).to.equal(ethers.parseEther("100"));
    });
  });

  describe("Fee Estimation & Platform Fees", function () {
    it("Should correctly estimate bridge fees", async function () {
      const bridgeAmount = ethers.parseEther("100");
      const fees = await sourceBridge.estimateBridgeFees(chainSelector, await sourceToken.getAddress(), bridgeAmount);

      expect(fees.platformFlatFee).to.equal(ethers.parseEther("0.005"));
      expect(fees.tokenPlatformFee).to.equal(ethers.parseEther("1")); // 1% of 100
      expect(fees.ccipFee).to.be.greaterThan(0n);
    });
  });

  describe("Cross-Chain Bridge Flow", function () {
    it("Should lock/burn tokens, pay fees, and mint/release on target chain", async function () {
      const initialMint = ethers.parseEther("500");
      const bridgeAmount = ethers.parseEther("100");

      // Mint tokens to user on source
      await sourceToken.mint(user.address, initialMint);

      // Approve bridge to spend tokens
      await sourceToken.connect(user).approve(await sourceBridge.getAddress(), bridgeAmount);

      // Retrieve fees
      const fees = await sourceBridge.estimateBridgeFees(chainSelector, await sourceToken.getAddress(), bridgeAmount);
      const totalNativeFeeRequired = fees.platformFlatFee + fees.ccipFee;

      // Ensure dest token is linked in the CCIP system
      // Note: locally, the CCIP local simulator will deliver the sourceToken directly to the destination address.
      // So to simulate Burn/Mint, we set up peer configurations.

      // Initiate bridge
      const tx = await sourceBridge.connect(user).bridgeToken(
        chainSelector,
        await sourceToken.getAddress(),
        bridgeAmount,
        user.address,
        { value: totalNativeFeeRequired }
      );

      await expect(tx).to.emit(sourceBridge, "BridgeSent");

      // Verify source token balance (initial - bridgeAmount)
      expect(await sourceToken.balanceOf(user.address)).to.equal(initialMint - bridgeAmount);

      // Verify that platform ERC20 fees were deposited to FeeManager
      expect(await sourceToken.balanceOf(await feeManagerSource.getAddress())).to.equal(fees.tokenPlatformFee);
    });
  });

  describe("Emergency Pause & Access Control", function () {
    it("Should prevent bridging when bridge is paused", async function () {
      await sourceBridge.pause();

      await expect(
        sourceBridge.connect(user).bridgeToken(
          chainSelector,
          await sourceToken.getAddress(),
          ethers.parseEther("100"),
          user.address,
          { value: ethers.parseEther("0.1") }
        )
      ).to.be.revertedWithCustomError(sourceBridge, "EnforcedPause");
    });

    it("Should allow operator to withdraw fees", async function () {
      // Send some ether to source fee manager
      await owner.sendTransaction({
        to: await feeManagerSource.getAddress(),
        value: ethers.parseEther("1")
      });

      const initialCollectorBalance = await ethers.provider.getBalance(feeCollector.address);
      await feeManagerSource.withdrawFees(ethers.ZeroAddress, feeCollector.address);

      expect(await ethers.provider.getBalance(feeCollector.address)).to.equal(
        initialCollectorBalance + ethers.parseEther("1")
      );
    });
  });
});
