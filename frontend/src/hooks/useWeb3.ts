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
}

export const useWeb3 = () => {
  const [state, setState] = useState<Web3State>({
    provider: null,
    signer: null,
    address: null,
    chainId: null,
    isConnected: false,
    isConnecting: false,
    error: null
  });

  const connectWallet = useCallback(async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      setState(prev => ({ ...prev, error: "Please install MetaMask or another supported Web3 wallet." }));
      return;
    }

    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      // Request accounts
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
        error: null
      });
    } catch (err: any) {
      console.error("Wallet connection error:", err);
      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: err.message || "Failed to connect wallet"
      }));
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
      error: null
    });
  }, []);

  // Listen to account and network changes
  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return;

    const handleAccountsChanged = async (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnectWallet();
      } else if (state.provider) {
        const signer = await state.provider.getSigner();
        setState(prev => ({ ...prev, address: accounts[0], signer }));
      }
    };

    const handleChainChanged = (hexChainId: string) => {
      const chainId = parseInt(hexChainId, 16);
      setState(prev => ({ ...prev, chainId }));
      // Reload is standard to clear old states
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
  }, [state.provider, disconnectWallet]);

  // Request MetaMask network switch
  const switchNetwork = async (targetChainId: number): Promise<boolean> => {
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
      // If network is not added to Metamask, try to add it
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
    if (!state.signer) return null;
    try {
      const contract = new ethers.Contract(bridgeAddress, BRIDGE_ABI, state.signer);
      const parsedAmount = ethers.parseUnits(amount, 18);
      const parsedFee = ethers.parseEther(totalNativeFee);

      // Call bridge contract
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
    estimateFees
  };
};
