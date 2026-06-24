"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useWeb3Context } from "../context/Web3Context";
import { NETWORKS, TOKENS, TokenConfig } from "../lib/constants";
import { ArrowRightLeft, ShieldCheck, ArrowRight, Loader2, Sparkles, CheckCircle2, RefreshCw } from "lucide-react";

export default function BridgePage() {
  const { state, connectWallet, switchNetwork, getTokenBalance, getTokenAllowance, approveToken, executeBridge, estimateFees } = useWeb3Context();

  // Inputs
  const [sourceChainId, setSourceChainId] = useState<number>(11155111);
  const [destChainId, setDestChainId] = useState<number>(80002);
  const [selectedToken, setSelectedToken] = useState<TokenConfig>(TOKENS[0]);
  const [amount, setAmount] = useState<string>("");
  const [receiverAddress, setReceiverAddress] = useState<string>("");

  // Live Balances & Allowances
  const [userBalance, setUserBalance] = useState<string>("0.0");
  const [allowance, setAllowance] = useState<string>("0.0");

  // Fee Estimates
  const [estimatedFees, setEstimatedFees] = useState<{ platformFlatFee: string; ccipFee: string; tokenPlatformFee: string } | null>(null);
  const [isEstimating, setIsEstimating] = useState<boolean>(false);

  // Transaction States
  const [isApproving, setIsApproving] = useState<boolean>(false);
  const [isBridging, setIsBridging] = useState<boolean>(false);
  const [bridgeTxHash, setBridgeTxHash] = useState<string | null>(null);
  const [bridgeStatus, setBridgeStatus] = useState<"IDLE" | "APPROVING" | "SUBMITTING" | "ROUTING" | "COMPLETED" | "FAILED">("IDLE");
  const [statusMessage, setStatusMessage] = useState<string>("");

  const sourceConfig = NETWORKS[sourceChainId];
  const destConfig = NETWORKS[destChainId];
  const tokenAddressOnSource = selectedToken.addresses[sourceChainId];

  // Helper to fetch user balances and allowances
  const fetchBalancesAndAllowances = useCallback(async () => {
    if (!state.address || !tokenAddressOnSource) return;

    try {
      const bal = await getTokenBalance(tokenAddressOnSource, state.address);
      setUserBalance(bal);

      const allow = await getTokenAllowance(tokenAddressOnSource, state.address, sourceConfig.bridgeAddress);
      setAllowance(allow);
    } catch (err) {
      console.error("Error fetching balance/allowance:", err);
    }
  }, [state.address, tokenAddressOnSource, sourceConfig, getTokenBalance, getTokenAllowance]);

  // Load balances when chain/token changes
  useEffect(() => {
    if (state.isConnected && state.chainId === sourceChainId) {
      fetchBalancesAndAllowances();
    } else {
      setUserBalance("0.0");
      setAllowance("0.0");
    }
  }, [state.isConnected, state.chainId, sourceChainId, selectedToken, fetchBalancesAndAllowances]);

  // Default receiver address to user wallet address
  useEffect(() => {
    if (state.address && !receiverAddress) {
      setReceiverAddress(state.address);
    }
  }, [state.address, receiverAddress]);

  // Estimate fees when amount changes
  useEffect(() => {
    const triggerFeeEstimation = async () => {
      if (!amount || isNaN(Number(amount)) || Number(amount) <= 0 || !destConfig.ccipSelector) {
        setEstimatedFees(null);
        return;
      }

      setIsEstimating(true);
      try {
        const fees = await estimateFees(
          sourceConfig.bridgeAddress,
          destConfig.ccipSelector,
          tokenAddressOnSource,
          amount
        );
        setEstimatedFees(fees);
      } catch (err) {
        console.error("Fee estimation error:", err);
        setEstimatedFees(null);
      } finally {
        setIsEstimating(false);
      }
    };

    const timer = setTimeout(triggerFeeEstimation, 600);
    return () => clearTimeout(timer);
  }, [amount, sourceChainId, destChainId, tokenAddressOnSource, sourceConfig, destConfig, estimateFees]);

  // Handle Chain Swap
  const handleSwapChains = () => {
    setSourceChainId(destChainId);
    setDestChainId(sourceChainId);
  };

  // Poll backend for cross-chain transaction completions
  useEffect(() => {
    if (bridgeStatus !== "ROUTING" || !bridgeTxHash) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api"}/transactions/${bridgeTxHash}`);
        const result = await res.json();
        
        if (result.success && result.data) {
          const tx = result.data;
          if (tx.status === "COMPLETED") {
            setBridgeStatus("COMPLETED");
            setStatusMessage("Transaction delivered successfully to the target chain!");
            clearInterval(interval);
            fetchBalancesAndAllowances();
          } else if (tx.status === "FAILED") {
            setBridgeStatus("FAILED");
            setStatusMessage("Cross-chain transaction failed.");
            clearInterval(interval);
          }
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [bridgeStatus, bridgeTxHash, fetchBalancesAndAllowances]);

  // Handle Approval Action
  const handleApprove = async () => {
    if (!state.isConnected) return;
    if (state.chainId !== sourceChainId) {
      await switchNetwork(sourceChainId);
      return;
    }

    setIsApproving(true);
    setBridgeStatus("APPROVING");
    setStatusMessage("Requesting token allowance approval in wallet...");

    try {
      const tx = await approveToken(tokenAddressOnSource, sourceConfig.bridgeAddress, amount);
      if (tx) {
        setStatusMessage("Confirming approval transaction on-chain...");
        await tx.wait();
        setStatusMessage("Token allowance approved!");
        setBridgeStatus("IDLE");
        fetchBalancesAndAllowances();
      }
    } catch (err: any) {
      console.error(err);
      setStatusMessage("Approval rejected or failed.");
      setBridgeStatus("IDLE");
    } finally {
      setIsApproving(false);
    }
  };

  // Handle Bridge execution
  const handleBridge = async () => {
    if (!state.isConnected) return;
    if (state.chainId !== sourceChainId) {
      await switchNetwork(sourceChainId);
      return;
    }

    if (!estimatedFees) {
      setStatusMessage("Wait for fee estimation to complete.");
      return;
    }

    setIsBridging(true);
    setBridgeStatus("SUBMITTING");
    setStatusMessage("Requesting bridging transaction signature in wallet...");

    try {
      const totalNativeFee = (
        Number(estimatedFees.platformFlatFee) + Number(estimatedFees.ccipFee)
      ).toFixed(18);

      const tx = await executeBridge(
        sourceConfig.bridgeAddress,
        destConfig.ccipSelector,
        tokenAddressOnSource,
        amount,
        receiverAddress,
        totalNativeFee
      );

      if (tx) {
        setStatusMessage("Broadcasting bridge request to blockchain...");
        setBridgeTxHash(tx.hash);
        await tx.wait();

        setBridgeStatus("ROUTING");
        setStatusMessage("Routing via Chainlink CCIP. Tracking delivery status... (May take 2-4 minutes)");
      }
    } catch (err: any) {
      console.error(err);
      setStatusMessage("Bridging request rejected or failed.");
      setBridgeStatus("IDLE");
    } finally {
      setIsBridging(false);
    }
  };

  const needsApproval = Number(allowance) < Number(amount);

  return (
    <div className="mx-auto flex max-w-4xl flex-col items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
      {/* Page Title */}
      <div className="mb-10 text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-violet-950/40 border border-violet-500/20 text-violet-400">
          <Sparkles className="h-5 w-5" />
        </div>
        <h1 className="bg-gradient-to-r from-violet-300 via-indigo-300 to-emerald-300 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent sm:text-4xl">
          Secure Multi-Chain Bridge
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Transfer ERC-20 tokens safely across Ethereum, Polygon, and BNB chain via Chainlink CCIP.
        </p>
      </div>

      <div className="grid w-full gap-8 md:grid-cols-5">
        {/* Bridge Panel */}
        <div className="glass-panel p-6 shadow-2xl md:col-span-3">
          <div className="space-y-5">
            {/* Source / Dest Chain selection */}
            <div className="grid grid-cols-7 items-center gap-3">
              <div className="col-span-3">
                <label className="text-xs text-slate-400 block mb-1.5 font-semibold">From Chain</label>
                <select
                  value={sourceChainId}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    setSourceChainId(id);
                    if (destChainId === id) setDestChainId(id === 11155111 ? 80002 : 11155111);
                  }}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-violet-500"
                >
                  {Object.values(NETWORKS).map((net) => (
                    <option key={net.chainId} value={net.chainId}>{net.name}</option>
                  ))}
                </select>
              </div>

              <div className="col-span-1 flex justify-center pt-5">
                <button
                  onClick={handleSwapChains}
                  className="rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-800 p-2 text-violet-400 transition transform hover:rotate-180"
                >
                  <ArrowRightLeft className="h-4 w-4" />
                </button>
              </div>

              <div className="col-span-3">
                <label className="text-xs text-slate-400 block mb-1.5 font-semibold">To Chain</label>
                <select
                  value={destChainId}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    setDestChainId(id);
                    if (sourceChainId === id) setSourceChainId(id === 11155111 ? 80002 : 11155111);
                  }}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-violet-500"
                >
                  {Object.values(NETWORKS).map((net) => (
                    <option key={net.chainId} value={net.chainId}>{net.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Token & Amount */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs text-slate-400 font-semibold">Amount to Transfer</label>
                {state.isConnected && (
                  <button
                    onClick={() => setAmount(userBalance)}
                    className="text-[10px] text-violet-400 hover:text-violet-300 font-semibold"
                  >
                    Max: {Number(userBalance).toFixed(4)} {selectedToken.symbol}
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <div className="w-1/3 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 flex items-center justify-between text-xs font-bold text-slate-200">
                  <span>{selectedToken.symbol}</span>
                </div>
                <input
                  type="number"
                  placeholder="0.0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-2/3 bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-sm font-semibold text-right focus:outline-none focus:border-violet-500"
                />
              </div>
            </div>

            {/* Receiver Address */}
            <div>
              <label className="text-xs text-slate-400 block mb-1.5 font-semibold">Recipient Address (Target Chain)</label>
              <input
                type="text"
                placeholder="0x..."
                value={receiverAddress}
                onChange={(e) => setReceiverAddress(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-xs font-semibold focus:outline-none focus:border-violet-500"
              />
            </div>

            {/* Gas summary */}
            {estimatedFees && (
              <div className="rounded-lg bg-slate-900/60 p-4 border border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Bridge Platform Fee:</span>
                  <span className="text-slate-200 font-semibold">{estimatedFees.platformFlatFee} ETH</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">CCIP Network Fee:</span>
                  <span className="text-slate-200 font-semibold">{Number(estimatedFees.ccipFee).toFixed(6)} ETH</span>
                </div>
                <div className="flex justify-between border-t border-slate-800/80 pt-2 font-bold">
                  <span className="text-slate-400">Total Native Fee:</span>
                  <span className="text-violet-400 font-glow">
                    {(Number(estimatedFees.platformFlatFee) + Number(estimatedFees.ccipFee)).toFixed(6)} ETH
                  </span>
                </div>
              </div>
            )}

            {/* Buttons */}
            {!state.isConnected ? (
              <button
                onClick={connectWallet}
                className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 py-3 text-xs font-bold text-white shadow-lg transition duration-300 hover:from-violet-500 hover:to-indigo-500"
              >
                Connect Wallet to Bridge
              </button>
            ) : state.chainId !== sourceChainId ? (
              <button
                onClick={() => switchNetwork(sourceChainId)}
                className="w-full rounded-xl bg-amber-600 hover:bg-amber-500 py-3 text-xs font-bold text-white shadow-lg transition"
              >
                Switch Network to {sourceConfig?.name}
              </button>
            ) : needsApproval ? (
              <button
                onClick={handleApprove}
                disabled={isApproving || !amount || Number(amount) <= 0}
                className="w-full rounded-xl bg-violet-600 hover:bg-violet-500 py-3 text-xs font-bold text-white shadow-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isApproving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Approve {selectedToken.symbol} Bridge Spender
              </button>
            ) : (
              <button
                onClick={handleBridge}
                disabled={isBridging || !amount || Number(amount) <= 0}
                className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 py-3 text-xs font-bold text-white shadow-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isBridging ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Bridge Tokens Now
              </button>
            )}
          </div>
        </div>

        {/* Info / Tracker Stepper Panel */}
        <div className="md:col-span-2 flex flex-col gap-4">
          {/* Security Features */}
          <div className="glass-panel p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-violet-400" />
              Security Architecture
            </h3>
            <ul className="space-y-2 text-[11px] text-slate-300">
              <li className="flex gap-2">
                <span className="text-violet-400">•</span>
                <span>Role-based OpenZeppelin access controls.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-violet-400">•</span>
                <span>Fully Pausable bridge mechanism.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-violet-400">•</span>
                <span>Chainlink CCIP decentralization logic.</span>
              </li>
            </ul>
          </div>

          {/* Stepper Status Tracker */}
          <div className="glass-panel p-5 flex-1 flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-400" />
                Live Status Monitor
              </h3>
              
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold border ${
                    bridgeStatus === "APPROVING" ? "bg-violet-950 border-violet-500 text-violet-400 animate-pulse" :
                    (bridgeStatus === "SUBMITTING" || bridgeStatus === "ROUTING" || bridgeStatus === "COMPLETED") ? "bg-emerald-950 border-emerald-500 text-emerald-400" :
                    "bg-slate-900 border-slate-800 text-slate-500"
                  }`}>
                    { (bridgeStatus === "SUBMITTING" || bridgeStatus === "ROUTING" || bridgeStatus === "COMPLETED") ? "✓" : "1" }
                  </div>
                  <span className={`text-xs ${bridgeStatus === "APPROVING" ? "text-slate-100 font-bold" : "text-slate-400"}`}>Approve Allowance</span>
                </div>

                <div className="flex items-center gap-3">
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold border ${
                    bridgeStatus === "SUBMITTING" ? "bg-violet-950 border-violet-500 text-violet-400 animate-pulse" :
                    (bridgeStatus === "ROUTING" || bridgeStatus === "COMPLETED") ? "bg-emerald-950 border-emerald-500 text-emerald-400" :
                    "bg-slate-900 border-slate-800 text-slate-500"
                  }`}>
                    { (bridgeStatus === "ROUTING" || bridgeStatus === "COMPLETED") ? "✓" : "2" }
                  </div>
                  <span className={`text-xs ${bridgeStatus === "SUBMITTING" ? "text-slate-100 font-bold" : "text-slate-400"}`}>Submit Source Transaction</span>
                </div>

                <div className="flex items-center gap-3">
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold border ${
                    bridgeStatus === "ROUTING" ? "bg-violet-950 border-violet-500 text-violet-400 animate-pulse" :
                    bridgeStatus === "COMPLETED" ? "bg-emerald-950 border-emerald-500 text-emerald-400" :
                    "bg-slate-900 border-slate-800 text-slate-500"
                  }`}>
                    { bridgeStatus === "COMPLETED" ? "✓" : "3" }
                  </div>
                  <span className={`text-xs ${bridgeStatus === "ROUTING" ? "text-slate-100 font-bold" : "text-slate-400"}`}>Route via Chainlink CCIP</span>
                </div>

                <div className="flex items-center gap-3">
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold border ${
                    bridgeStatus === "COMPLETED" ? "bg-emerald-950 border-emerald-500 text-emerald-400" :
                    "bg-slate-900 border-slate-800 text-slate-500"
                  }`}>
                    4
                  </div>
                  <span className={`text-xs ${bridgeStatus === "COMPLETED" ? "text-slate-100 font-bold" : "text-slate-400"}`}>Tokens Delivered</span>
                </div>
              </div>
            </div>

            {statusMessage && (
              <div className="mt-6 rounded-lg bg-slate-900/60 p-3.5 border border-slate-800 text-[11px] text-slate-300 flex items-center gap-2">
                { (bridgeStatus === "ROUTING" || bridgeStatus === "APPROVING" || bridgeStatus === "SUBMITTING") ? (
                  <Loader2 className="h-4 w-4 animate-spin text-violet-400 shrink-0" />
                ) : bridgeStatus === "COMPLETED" ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                ) : null }
                <span>{statusMessage}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
