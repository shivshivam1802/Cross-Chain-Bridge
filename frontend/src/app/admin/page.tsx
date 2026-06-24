"use client";

import React, { useState } from "react";
import { useWeb3Context } from "../../context/Web3Context";
import { NETWORKS, FEE_MANAGER_ABI, BRIDGE_ABI } from "../../lib/constants";
import { ethers } from "ethers";
import { Lock, Unlock, Percent, Landmark, ShieldCheck, Layers, Loader2, Sparkles } from "lucide-react";

export default function AdminPage() {
  const { state, switchNetwork } = useWeb3Context();

  // Status message
  const [adminStatus, setAdminStatus] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  // Form inputs for Fee Modification
  const [flatFeeInput, setFlatFeeInput] = useState<string>("");
  const [pctFeeInput, setPctFeeInput] = useState<string>("");

  // Form inputs for Peer configuration
  const [targetSelector, setTargetSelector] = useState<string>("");
  const [peerBridgeAddress, setPeerBridgeAddress] = useState<string>("");

  // Form inputs for DB Token Registration
  const [tokenAddress, setTokenAddress] = useState<string>("");
  const [tokenSymbol, setTokenSymbol] = useState<string>("");
  const [tokenName, setTokenName] = useState<string>("");
  const [tokenDecimals, setTokenDecimals] = useState<string>("18");
  const [tokenChainId, setTokenChainId] = useState<string>("11155111");
  const [isBurnMint, setIsBurnMint] = useState<boolean>(false);

  // Helper to get contracts
  const getContracts = async (chainId: number) => {
    if (state.isMockWallet) {
      const fakeWaitTx = () => ({
        wait: async () => {
          await new Promise(resolve => setTimeout(resolve, 800));
          return { status: 1 };
        }
      });
      return {
        bridge: {
          pause: async () => fakeWaitTx(),
          unpause: async () => fakeWaitTx(),
          setPeerBridge: async () => fakeWaitTx(),
          setTokenStatus: async () => fakeWaitTx(),
        },
        feeManager: {
          setFlatNativeFee: async () => fakeWaitTx(),
          setPercentageFeeBps: async () => fakeWaitTx(),
        }
      } as any;
    }

    if (!state.signer) throw new Error("Wallet not connected");
    const netConfig = NETWORKS[chainId];
    if (!netConfig) throw new Error("Invalid network");

    const bridge = new ethers.Contract(netConfig.bridgeAddress, BRIDGE_ABI, state.signer);
    const feeManager = new ethers.Contract(netConfig.feeManagerAddress, FEE_MANAGER_ABI, state.signer);
    return { bridge, feeManager };
  };

  const handlePause = async (pause: boolean) => {
    if (!state.isConnected || !state.chainId) return;
    setLoading(true);
    setAdminStatus(`Requesting ${pause ? "pause" : "unpause"} on chain ${state.chainId}...`);

    try {
      const { bridge } = await getContracts(state.chainId);
      const tx = pause ? await bridge.pause() : await bridge.unpause();
      setAdminStatus("Broadcasting transaction...");
      await tx.wait();
      setAdminStatus(`Bridge successfully ${pause ? "paused" : "unpaused"}!`);
    } catch (err: any) {
      console.error(err);
      setAdminStatus(`Failed to update status: ${err.reason || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateFees = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!state.isConnected || !state.chainId) return;
    setLoading(true);
    setAdminStatus("Requesting fee update transaction...");

    try {
      const { feeManager } = await getContracts(state.chainId);

      if (flatFeeInput) {
        const flatFeeWei = ethers.parseEther(flatFeeInput);
        setAdminStatus("Setting flat fee...");
        const tx = await feeManager.setFlatNativeFee(flatFeeWei);
        await tx.wait();
      }

      if (pctFeeInput) {
        const bps = Math.round(Number(pctFeeInput) * 100); // 1% = 100 bps
        setAdminStatus("Setting percentage fee...");
        const tx = await feeManager.setPercentageFeeBps(bps);
        await tx.wait();
      }

      setAdminStatus("Fees successfully configured on-chain!");
      setFlatFeeInput("");
      setPctFeeInput("");
    } catch (err: any) {
      console.error(err);
      setAdminStatus(`Failed to update fees: ${err.reason || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleConfigurePeer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!state.isConnected || !state.chainId || !targetSelector || !peerBridgeAddress) return;
    setLoading(true);
    setAdminStatus(`Mapping peer bridge ${peerBridgeAddress} on chain ${state.chainId}...`);

    try {
      const { bridge } = await getContracts(state.chainId);
      const tx = await bridge.setPeerBridge(targetSelector, peerBridgeAddress);
      setAdminStatus("Broadcasting mapping transaction...");
      await tx.wait();
      setAdminStatus("Peer bridge selector successfully configured on-chain!");
      setTargetSelector("");
      setPeerBridgeAddress("");
    } catch (err: any) {
      console.error(err);
      setAdminStatus(`Failed configuring peer bridge: ${err.reason || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterTokenInDb = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!state.signer && !state.isMockWallet) || !tokenAddress || !tokenSymbol || !tokenName) return;

    setLoading(true);
    setAdminStatus("Generating EIP-191 signature verification message...");

    try {
      if (state.isMockWallet) {
        await new Promise(resolve => setTimeout(resolve, 800));
        setAdminStatus("Submitting signed request to database (Sandbox Mode)...");
        await new Promise(resolve => setTimeout(resolve, 800));
        setAdminStatus("Token registered successfully in database (Simulated)!");
        setTokenAddress("");
        setTokenSymbol("");
        setTokenName("");
        setLoading(false);
        return;
      }

      const timestamp = Math.floor(Date.now() / 1000);
      const message = `Bridge Admin Action: Add Token ${tokenAddress.toLowerCase()} on Chain ${tokenChainId} at Timestamp ${timestamp}`;
      const signature = await state.signer!.signMessage(message);

      setAdminStatus("Submitting signed request to backend API...");

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api"}/admin/token`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            tokenAddress,
            symbol: tokenSymbol,
            name: tokenName,
            decimals: Number(tokenDecimals),
            chainId: Number(tokenChainId),
            isBurnMint,
            message,
            signature
          })
        }
      );

      const result = await response.json();
      if (result.success) {
        setAdminStatus("Token registered successfully in database!");
        setTokenAddress("");
        setTokenSymbol("");
        setTokenName("");
      } else {
        setAdminStatus(`Database registration failed: ${result.message}`);
      }
    } catch (err: any) {
      console.error(err);
      setAdminStatus(`Registration failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8 space-y-8">
      {/* Title */}
      <div className="text-center max-w-xl mx-auto space-y-2">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-violet-950/40 border border-violet-500/20 text-violet-400">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-glow text-white">Bridge Governance</h1>
        <p className="text-xs text-slate-400">Manage bridge smart contract configurations and supported database tokens.</p>
      </div>

      {adminStatus && (
        <div className="max-w-xl mx-auto p-4 rounded-xl border border-violet-850 bg-violet-950/30 text-xs text-violet-300 font-semibold text-center flex items-center justify-center gap-2">
          {loading && <Loader2 className="h-4 w-4 animate-spin text-violet-400" />}
          <span>{adminStatus}</span>
        </div>
      )}

      {!state.isConnected ? (
        <div className="max-w-md mx-auto p-8 rounded-xl border border-slate-800 bg-slate-900/40 text-center space-y-3">
          <p className="text-xs text-slate-400">Connect the bridge admin wallet to access governance panels.</p>
        </div>
      ) : (
        <div className="grid w-full gap-8 md:grid-cols-2">
          {/* Contracts Controls Panel */}
          <div className="space-y-6">
            {/* Pausable */}
            <div className="glass-panel p-6 space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Landmark className="h-4 w-4 text-violet-400" />
                Emergency Circuit Breaker
              </h3>
              <div className="flex gap-4">
                <button
                  onClick={() => handlePause(true)}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-rose-600/80 hover:bg-rose-500 py-3 text-xs font-bold text-white shadow-lg transition"
                >
                  <Lock className="h-4 w-4" /> Pause Bridge
                </button>
                <button
                  onClick={() => handlePause(false)}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600/80 hover:bg-emerald-500 py-3 text-xs font-bold text-white shadow-lg transition"
                >
                  <Unlock className="h-4 w-4" /> Unpause Bridge
                </button>
              </div>
            </div>

            {/* Fee Configurations */}
            <div className="glass-panel p-6 space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Percent className="h-4 w-4 text-violet-400" />
                Update Bridge Fees
              </h3>
              <form onSubmit={handleUpdateFees} className="space-y-4 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1">Flat Native Fee (ETH)</label>
                  <input
                    type="number"
                    step="0.0001"
                    placeholder="e.g. 0.005"
                    value={flatFeeInput}
                    onChange={(e) => setFlatFeeInput(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2 font-semibold text-slate-200 focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Percentage Fee (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 0.5"
                    value={pctFeeInput}
                    onChange={(e) => setPctFeeInput(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2 font-semibold text-slate-200 focus:outline-none focus:border-violet-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || (!flatFeeInput && !pctFeeInput)}
                  className="w-full rounded-lg bg-violet-600 hover:bg-violet-500 py-2.5 font-bold text-white transition disabled:opacity-50"
                >
                  Submit Fee Configurations
                </button>
              </form>
            </div>

            {/* Peer Mapping */}
            <div className="glass-panel p-6 space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Layers className="h-4 w-4 text-violet-400" />
                Map Peer Bridges
              </h3>
              <form onSubmit={handleConfigurePeer} className="space-y-4 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1">CCIP Chain Selector</label>
                  <input
                    type="text"
                    placeholder="e.g. 1628171139167062214"
                    value={targetSelector}
                    onChange={(e) => setTargetSelector(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2 font-semibold text-slate-200 focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Peer Bridge Address</label>
                  <input
                    type="text"
                    placeholder="0x..."
                    value={peerBridgeAddress}
                    onChange={(e) => setPeerBridgeAddress(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2 font-semibold text-slate-200 focus:outline-none focus:border-violet-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !targetSelector || !peerBridgeAddress}
                  className="w-full rounded-lg bg-violet-600 hover:bg-violet-500 py-2.5 font-bold text-white transition disabled:opacity-50"
                >
                  Map Peer Link Selector
                </button>
              </form>
            </div>
          </div>

          {/* Database Admin Actions */}
          <div className="space-y-6">
            <div className="glass-panel p-6 space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-400" />
                Register Supported Tokens (DB)
              </h3>
              <form onSubmit={handleRegisterTokenInDb} className="space-y-4 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1">Token ERC20 Address</label>
                  <input
                    type="text"
                    placeholder="0x..."
                    value={tokenAddress}
                    onChange={(e) => setTokenAddress(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2 font-semibold text-slate-200 focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 block mb-1">Token Symbol</label>
                    <input
                      type="text"
                      placeholder="e.g. CCT"
                      value={tokenSymbol}
                      onChange={(e) => setTokenSymbol(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2 font-semibold text-slate-200 focus:outline-none focus:border-violet-500"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Token Decimals</label>
                    <input
                      type="number"
                      value={tokenDecimals}
                      onChange={(e) => setTokenDecimals(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2 font-semibold text-slate-200 focus:outline-none focus:border-violet-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Token Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Cross-Chain Token"
                    value={tokenName}
                    onChange={(e) => setTokenName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2 font-semibold text-slate-200 focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 block mb-1">Deploy Chain ID</label>
                    <select
                      value={tokenChainId}
                      onChange={(e) => setTokenChainId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2 font-semibold text-slate-200 focus:outline-none focus:border-violet-500"
                    >
                      {Object.values(NETWORKS).map((net) => (
                        <option key={net.chainId} value={net.chainId}>{net.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2 pt-5 pl-2">
                    <input
                      type="checkbox"
                      id="burnMintCheckbox"
                      checked={isBurnMint}
                      onChange={(e) => setIsBurnMint(e.target.checked)}
                      className="h-4 w-4 bg-slate-900 border border-slate-800 accent-violet-600 rounded focus:ring-violet-500"
                    />
                    <label htmlFor="burnMintCheckbox" className="text-slate-400 select-none">Mint/Burn Token</label>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading || !tokenAddress || !tokenSymbol || !tokenName}
                  className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 py-2.5 font-bold text-white transition disabled:opacity-50"
                >
                  Authorize and Register Token
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
