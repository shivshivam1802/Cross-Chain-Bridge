"use client";

import React, { createContext, useContext, ReactNode } from "react";
import { useWeb3, Web3State } from "../hooks/useWeb3";
import { ethers } from "ethers";

interface Web3ContextType {
  state: Web3State;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  switchNetwork: (targetChainId: number) => Promise<boolean>;
  getTokenBalance: (tokenAddress: string, walletAddress: string) => Promise<string>;
  getTokenAllowance: (tokenAddress: string, ownerAddress: string, spenderAddress: string) => Promise<string>;
  approveToken: (tokenAddress: string, spenderAddress: string, amount: string) => Promise<ethers.TransactionResponse | null>;
  executeBridge: (bridgeAddress: string, destChainSelector: string, tokenAddress: string, amount: string, receiver: string, totalNativeFee: string) => Promise<ethers.TransactionResponse | null>;
  estimateFees: (bridgeAddress: string, destChainSelector: string, tokenAddress: string, amount: string) => Promise<{ platformFlatFee: string; ccipFee: string; tokenPlatformFee: string } | null>;
}

const Web3Context = createContext<Web3ContextType | undefined>(undefined);

export const Web3Provider = ({ children }: { children: ReactNode }) => {
  const web3 = useWeb3();

  return (
    <Web3Context.Provider value={web3}>
      {children}
    </Web3Context.Provider>
  );
};

export const useWeb3Context = () => {
  const context = useContext(Web3Context);
  if (!context) {
    throw new Error("useWeb3Context must be used within a Web3Provider");
  }
  return context;
};
