"use client";
import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { NETWORKS, TOKENS, BRIDGE_ABI, TOKEN_ABI, NetworkConfig } from "../lib/constants";

export interface Web3State {
  provider: ethers.BrowserProvider | null;
  signer: ethers.JsonRpcSigner | null;
  address: string | null;
  chainId: number | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  isMockWallet?: boolean;
}

export const useWeb3 = () => {
  const [state, setState] = useState<Web3State>({
    provider: null,
    signer: null,
    address: null,
    chainId: null,
    isConnected: false,
    isConnecting: false,
    error: null,
    isMockWallet: false
  });

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalView, setModalView] = useState<"SELECT" | "QR_CODE" | "CONNECTING">("SELECT");
  const [selectedWalletName, setSelectedWalletName] = useState<string>("");

  const connectWallet = useCallback(async (walletType?: string) => {
    // If no walletType is specified, open the selection modal
    if (!walletType) {
      setModalView("SELECT");
      setIsModalOpen(true);
      return;
    }

    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    if (walletType === "MockSandbox") {
      // Simulate connection delay
      await new Promise(resolve => setTimeout(resolve, 600));
      setState({
        provider: null,
        signer: null,
        address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        chainId: 11155111, // Sepolia initially
        isConnected: true,
        isConnecting: false,
        error: null,
        isMockWallet: true
      });
      setIsModalOpen(false);
      return;
    }

    if (typeof window === "undefined" || !window.ethereum) {
      setState(prev => ({ ...prev, isConnecting: false, error: "Please install MetaMask or another supported Web3 wallet." }));
      setIsModalOpen(false);
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const network = await provider.getNetwork();
      const chainId = Number(network.chainId);

      setState({
        provider,
        signer,
        address: accounts[0],
        chainId,
        isConnected: true,
        isConnecting: false,
        error: null,
        isMockWallet: false
      });
      setIsModalOpen(false);
    } catch (err: any) {
      console.error("Wallet connection error:", err);
      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: err.message || "Failed to connect wallet"
      }));
      setIsModalOpen(false);
    }
  }, []);

  const disconnectWallet = useCallback(() => {
    setState({
      provider: null,
      signer: null,
      address: null,
      chainId: null,
      isConnected: false,
      isConnecting: false,
      error: null,
      isMockWallet: false
    });
  }, []);

  // Listen to account and network changes
  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return;

    const handleAccountsChanged = async (accounts: string[]) => {
      if (state.isMockWallet) return;
      if (accounts.length === 0) {
        disconnectWallet();
      } else if (state.provider) {
        const signer = await state.provider.getSigner();
        setState(prev => ({ ...prev, address: accounts[0], signer }));
      }
    };

    const handleChainChanged = (hexChainId: string) => {
      if (state.isMockWallet) return;
      const chainId = parseInt(hexChainId, 16);
      setState(prev => ({ ...prev, chainId }));
      window.location.reload();
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      if (window.ethereum?.removeListener) {
        window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
        window.ethereum.removeListener("chainChanged", handleChainChanged);
      }
    };
  }, [state.provider, state.isMockWallet, disconnectWallet]);

  // Request network switch
  const switchNetwork = async (targetChainId: number): Promise<boolean> => {
    if (state.isMockWallet) {
      setState(prev => ({ ...prev, chainId: targetChainId }));
      return true;
    }

    if (!window.ethereum || !state.provider) return false;
    const targetNetwork = NETWORKS[targetChainId];
    if (!targetNetwork) return false;

    const hexChainId = "0x" + targetChainId.toString(16);

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: hexChainId }]
      });
      return true;
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: hexChainId,
                chainName: targetNetwork.name,
                rpcUrls: [targetNetwork.rpcUrl],
                nativeCurrency: targetNetwork.nativeCurrency,
                blockExplorerUrls: [targetNetwork.explorerUrl]
              }
            ]
          });
          return true;
        } catch (addError) {
          console.error("Failed to add network to wallet", addError);
          return false;
        }
      }
      console.error("Failed to switch network", switchError);
      return false;
    }
  };

  // Check Token balance
  const getTokenBalance = async (tokenAddress: string, walletAddress: string): Promise<string> => {
    if (state.isMockWallet) {
      const balanceKey = `mock_balance_${walletAddress}_${tokenAddress}`;
      let bal = localStorage.getItem(balanceKey);
      if (bal === null) {
        bal = "500.0";
        localStorage.setItem(balanceKey, bal);
      }
      return bal;
    }

    if (!state.provider) return "0";
    try {
      const contract = new ethers.Contract(tokenAddress, TOKEN_ABI, state.provider);
      const balance = await contract.balanceOf(walletAddress);
      return ethers.formatUnits(balance, 18);
    } catch (err) {
      console.error("Error fetching balance:", err);
      return "0";
    }
  };

  // Check Token allowance
  const getTokenAllowance = async (
    tokenAddress: string,
    ownerAddress: string,
    spenderAddress: string
  ): Promise<string> => {
    if (state.isMockWallet) {
      const allowanceKey = `mock_allowance_${ownerAddress}_${spenderAddress}_${tokenAddress}`;
      return localStorage.getItem(allowanceKey) || "0.0";
    }

    if (!state.provider) return "0";
    try {
      const contract = new ethers.Contract(tokenAddress, TOKEN_ABI, state.provider);
      const allowance = await contract.allowance(ownerAddress, spenderAddress);
      return ethers.formatUnits(allowance, 18);
    } catch (err) {
      console.error("Error fetching allowance:", err);
      return "0";
    }
  };

  // Approve Token bridge spender
  const approveToken = async (
    tokenAddress: string,
    spenderAddress: string,
    amount: string
  ): Promise<ethers.TransactionResponse | null> => {
    if (state.isMockWallet) {
      const allowanceKey = `mock_allowance_${state.address}_${spenderAddress}_${tokenAddress}`;
      localStorage.setItem(allowanceKey, amount);
      return {
        hash: "0xmockapprove" + Math.random().toString(36).substring(2, 15),
        wait: async () => {
          await new Promise(resolve => setTimeout(resolve, 800));
          return { status: 1 };
        }
      } as any;
    }

    if (!state.signer) return null;
    try {
      const contract = new ethers.Contract(tokenAddress, TOKEN_ABI, state.signer);
      const parsedAmount = ethers.parseUnits(amount, 18);
      const tx = await contract.approve(spenderAddress, parsedAmount);
      return tx;
    } catch (err) {
      console.error("Token approval failed:", err);
      throw err;
    }
  };

  // Bridge Token transfer
  const executeBridge = async (
    bridgeAddress: string,
    destChainSelector: string,
    tokenAddress: string,
    amount: string,
    receiver: string,
    totalNativeFee: string
  ): Promise<ethers.TransactionResponse | null> => {
    if (state.isMockWallet) {
      const balanceKey = `mock_balance_${state.address}_${tokenAddress}`;
      const currentBal = Number(localStorage.getItem(balanceKey) || "500.0");
      const newBal = Math.max(0, currentBal - Number(amount));
      localStorage.setItem(balanceKey, newBal.toFixed(4));

      let destChainId = 80002;
      if (destChainSelector === "16015286601757825753") destChainId = 11155111;
      else if (destChainSelector === "13264668187771770619") destChainId = 97;
      else if (destChainSelector === "0") destChainId = 31337;

      const sourceTxHash = "0xmocktx" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const messageId = "0xmockmsg" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

      const newTx = {
        id: "mock-" + Math.random().toString(36).substring(2, 9),
        messageId,
        sender: state.address || "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        receiver: receiver,
        sourceChainId: (state.chainId || 11155111).toString(),
        destChainId: destChainId.toString(),
        tokenAddress: tokenAddress,
        amount: ethers.parseUnits(amount, 18).toString(), // Store as string of wei to match db format
        feeAmount: ethers.parseEther(totalNativeFee).toString(),
        status: "ROUTING",
        sourceTxHash,
        destTxHash: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const mockTxs = JSON.parse(localStorage.getItem("mock_transactions") || "[]");
      mockTxs.unshift(newTx);
      localStorage.setItem("mock_transactions", JSON.stringify(mockTxs));

      return {
        hash: sourceTxHash,
        wait: async () => {
          await new Promise(resolve => setTimeout(resolve, 800));
          return { status: 1 };
        }
      } as any;
    }

    if (!state.signer) return null;
    try {
      const contract = new ethers.Contract(bridgeAddress, BRIDGE_ABI, state.signer);
      const parsedAmount = ethers.parseUnits(amount, 18);
      const parsedFee = ethers.parseEther(totalNativeFee);

      const tx = await contract.bridgeToken(
        destChainSelector,
        tokenAddress,
        parsedAmount,
        receiver,
        { value: parsedFee }
      );
      return tx;
    } catch (err) {
      console.error("Bridge transaction execution failed:", err);
      throw err;
    }
  };

  // Estimate bridge fees
  const estimateFees = async (
    bridgeAddress: string,
    destChainSelector: string,
    tokenAddress: string,
    amount: string
  ): Promise<{ platformFlatFee: string; ccipFee: string; tokenPlatformFee: string } | null> => {
    if (state.isMockWallet) {
      return {
        platformFlatFee: "0.0015",
        ccipFee: "0.0020",
        tokenPlatformFee: "0.0"
      };
    }

    if (!state.provider) return null;
    try {
      const contract = new ethers.Contract(bridgeAddress, BRIDGE_ABI, state.provider);
      const parsedAmount = ethers.parseUnits(amount, 18);
      const fees = await contract.estimateBridgeFees(destChainSelector, tokenAddress, parsedAmount);
      return {
        platformFlatFee: ethers.formatEther(fees.platformFlatFee),
        ccipFee: ethers.formatEther(fees.ccipFee),
        tokenPlatformFee: ethers.formatUnits(fees.tokenPlatformFee, 18)
      };
    } catch (err) {
      console.error("Failed to estimate bridge fees:", err);
      return null;
    }
  };

  return {
    state,
    connectWallet,
    disconnectWallet,
    switchNetwork,
    getTokenBalance,
    getTokenAllowance,
    approveToken,
    executeBridge,
    estimateFees,
    isModalOpen,
    setIsModalOpen,
    modalView,
    setModalView,
    selectedWalletName,
    setSelectedWalletName
  };
};
