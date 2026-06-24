"use client";

import React, { useState, useEffect } from "react";
import { NETWORKS } from "../../lib/constants";
import { Search, Loader2, ArrowRight, CheckCircle, Clock, XCircle, ExternalLink, Calendar } from "lucide-react";

interface Transaction {
  id: string;
  messageId: string;
  sender: string;
  receiver: string;
  sourceChainId: string;
  destChainId: string;
  tokenAddress: string;
  amount: string;
  feeAmount: string;
  status: string;
  sourceTxHash: string;
  destTxHash: string;
  createdAt: string;
  updatedAt: string;
}

export default function ExplorerPage() {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchedTx, setSearchedTx] = useState<Transaction | null>(null);
  const [searchedUserTxs, setSearchedUserTxs] = useState<Transaction[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

  const fetchRecentTransactions = async () => {
    try {
      let backendTxs: Transaction[] = [];
      try {
        const res = await fetch(`${backendUrl}/transactions?limit=10`);
        const result = await res.json();
        if (result.success) {
          backendTxs = result.data;
        }
      } catch (err) {
        console.error("Failed to fetch recent transactions from backend:", err);
      }

      const mockTxs = JSON.parse(localStorage.getItem("mock_transactions") || "[]");
      setRecentTransactions([...mockTxs, ...backendTxs].slice(0, 10));
    } catch (err) {
      console.error("Failed to fetch recent transactions:", err);
    }
  };

  useEffect(() => {
    fetchRecentTransactions();
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError(null);
    setSearchedTx(null);
    setSearchedUserTxs([]);

    try {
      const queryVal = searchQuery.trim();
      // Check if it looks like a wallet address
      if (queryVal.startsWith("0x") && queryVal.length === 42) {
        const mockTxs = JSON.parse(localStorage.getItem("mock_transactions") || "[]");
        const matchingMockTxs = mockTxs.filter(
          (tx: any) =>
            tx.sender.toLowerCase() === queryVal.toLowerCase() ||
            tx.receiver.toLowerCase() === queryVal.toLowerCase()
        );

        let backendTxs: Transaction[] = [];
        try {
          const res = await fetch(`${backendUrl}/transactions?wallet=${queryVal}`);
          const result = await res.json();
          if (result.success) {
            backendTxs = result.data;
          }
        } catch (err) {
          console.error("Backend wallet search failed:", err);
        }

        const combined = [...matchingMockTxs, ...backendTxs];
        if (combined.length > 0) {
          setSearchedUserTxs(combined);
        } else {
          setError("No transactions found for this wallet address.");
        }
      } else {
        // Query as transaction hash or message ID
        const mockTxs = JSON.parse(localStorage.getItem("mock_transactions") || "[]");
        const matchingMockTx = mockTxs.find(
          (tx: any) =>
            tx.sourceTxHash.toLowerCase() === queryVal.toLowerCase() ||
            tx.destTxHash.toLowerCase() === queryVal.toLowerCase() ||
            tx.messageId.toLowerCase() === queryVal.toLowerCase()
        );

        if (matchingMockTx) {
          setSearchedTx(matchingMockTx);
        } else {
          try {
            const res = await fetch(`${backendUrl}/transactions/${queryVal}`);
            const result = await res.json();
            if (result.success && result.data) {
              setSearchedTx(result.data);
            } else {
              setError("Transaction hash or CCIP Message ID not found.");
            }
          } catch (err) {
            console.error("Backend tx search failed:", err);
            setError("Transaction not found. Make sure the backend is active.");
          }
        }
      }
    } catch (err) {
      console.error("Search failed:", err);
      setError("An error occurred during search.");
    } finally {
      setLoading(false);
    }
  };

  const getChainName = (chainId: string) => {
    return NETWORKS[Number(chainId)]?.name || `Chain ${chainId}`;
  };

  const formatWeiToEth = (wei: string) => {
    return (Number(wei) / 1e18).toFixed(4);
  };

  const getExplorerTxUrl = (chainId: string, txHash: string) => {
    const explorer = NETWORKS[Number(chainId)]?.explorerUrl;
    if (!explorer || explorer === "#") return "#";
    return `${explorer}/tx/${txHash}`;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 space-y-10">
      {/* Title */}
      <div className="text-center max-w-xl mx-auto space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-glow text-white">Cross-Chain Explorer</h1>
        <p className="text-xs text-slate-400">Search and track cross-chain messages, transactions, and addresses in real-time.</p>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="max-w-2xl mx-auto flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by Wallet Address, Source/Dest Tx Hash, or CCIP Message ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-11 pr-4 py-3.5 text-xs font-semibold focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20 text-slate-200"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="bg-violet-600 hover:bg-violet-500 text-white rounded-xl px-6 font-bold text-xs flex items-center justify-center gap-1.5 transition disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
        </button>
      </form>

      {/* Error State */}
      {error && (
        <div className="max-w-2xl mx-auto p-4 rounded-xl border border-rose-950 bg-rose-950/20 text-xs text-rose-400 font-semibold text-center">
          {error}
        </div>
      )}

      {/* Search Result - Single Tx */}
      {searchedTx && (
        <div className="max-w-3xl mx-auto glass-panel p-6 space-y-6">
          <div className="flex justify-between items-start border-b border-slate-800/40 pb-4">
            <div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                searchedTx.status === "COMPLETED" ? "bg-emerald-950 text-emerald-400 border border-emerald-950" :
                searchedTx.status === "PENDING" ? "bg-amber-950 text-amber-400 border border-amber-950 animate-pulse" :
                "bg-rose-950 text-rose-400 border border-rose-950"
              }`}>
                {searchedTx.status}
              </span>
              <h3 className="text-sm font-bold text-slate-200 mt-2 font-mono break-all">{searchedTx.messageId || "Bridging request pending..."}</h3>
              <p className="text-[10px] text-slate-500 mt-0.5">CCIP MESSAGE ID</p>
            </div>
            <div className="text-right text-[10px] text-slate-400 font-semibold">
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(searchedTx.createdAt).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Visual Link Stepper */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 py-4 px-6 bg-slate-950/40 rounded-xl border border-slate-900">
            <div className="flex flex-col items-center gap-1.5 text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Source</span>
              <span className="text-xs font-semibold text-slate-200">{getChainName(searchedTx.sourceChainId)}</span>
            </div>
            <div className="flex items-center flex-1 w-full md:w-auto relative">
              <div className="h-0.5 bg-slate-800 w-full" />
              <div className={`absolute left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[10px] font-bold border border-violet-950 bg-violet-950/50 text-violet-300 ${
                searchedTx.status === "PENDING" ? "animate-pulse" : ""
              }`}>
                CCIP ROUTING
              </div>
            </div>
            <div className="flex flex-col items-center gap-1.5 text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Destination</span>
              <span className="text-xs font-semibold text-slate-200">{getChainName(searchedTx.destChainId)}</span>
            </div>
          </div>

          {/* Details Table */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-3">
              <div className="flex justify-between border-b border-slate-900 pb-2">
                <span className="text-slate-500 font-semibold">Sender Wallet</span>
                <span className="font-mono text-slate-300 break-all select-all">{searchedTx.sender}</span>
              </div>
              <div className="flex justify-between border-b border-slate-900 pb-2">
                <span className="text-slate-500 font-semibold">Receiver Wallet</span>
                <span className="font-mono text-slate-300 break-all select-all">{searchedTx.receiver}</span>
              </div>
              <div className="flex justify-between border-b border-slate-900 pb-2">
                <span className="text-slate-500 font-semibold">Tokens Bridged</span>
                <span className="text-slate-200 font-bold">{formatWeiToEth(searchedTx.amount)} CCT</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between border-b border-slate-900 pb-2 items-center">
                <span className="text-slate-500 font-semibold">Source Tx Hash</span>
                <a
                  href={getExplorerTxUrl(searchedTx.sourceChainId, searchedTx.sourceTxHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-violet-400 hover:text-violet-300 flex items-center gap-1 text-[11px]"
                >
                  {searchedTx.sourceTxHash.slice(0, 12)}...
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              {searchedTx.destTxHash && (
                <div className="flex justify-between border-b border-slate-900 pb-2 items-center">
                  <span className="text-slate-500 font-semibold">Destination Tx Hash</span>
                  <a
                    href={getExplorerTxUrl(searchedTx.destChainId, searchedTx.destTxHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-violet-400 hover:text-violet-300 flex items-center gap-1 text-[11px]"
                  >
                    {searchedTx.destTxHash.slice(0, 12)}...
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
              <div className="flex justify-between border-b border-slate-900 pb-2">
                <span className="text-slate-500 font-semibold">Platform + CCIP Fees</span>
                <span className="text-slate-300">{formatWeiToEth(searchedTx.feeAmount)} ETH</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search Result - Wallet Address Transactions */}
      {searchedUserTxs.length > 0 && (
        <div className="glass-panel p-6 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
            Transactions for wallet {searchQuery.slice(0, 8)}...{searchQuery.slice(-6)}
          </h2>
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Message ID</th>
                  <th className="py-3 px-4">From Chain</th>
                  <th className="py-3 px-4">To Chain</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {searchedUserTxs.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-900/30">
                    <td className="py-3.5 px-4 font-mono text-violet-400 select-all">{tx.messageId ? `${tx.messageId.slice(0, 12)}...` : "PENDING..."}</td>
                    <td className="py-3.5 px-4 text-slate-300">{getChainName(tx.sourceChainId)}</td>
                    <td className="py-3.5 px-4 text-slate-300">{getChainName(tx.destChainId)}</td>
                    <td className="py-3.5 px-4 text-slate-100 font-semibold">{formatWeiToEth(tx.amount)} CCT</td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        tx.status === "COMPLETED" ? "bg-emerald-950 text-emerald-400" :
                        tx.status === "PENDING" ? "bg-amber-950 text-amber-400" :
                        "bg-rose-950 text-rose-400"
                      }`}>
                        {tx.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right text-slate-400">
                      {new Date(tx.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Default recent transactions list */}
      {!searchedTx && searchedUserTxs.length === 0 && (
        <div className="glass-panel p-6 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Recent Global Transactions</h2>
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Message ID</th>
                  <th className="py-3 px-4">Source Chain</th>
                  <th className="py-3 px-4">Destination Chain</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {recentTransactions.length > 0 ? (
                  recentTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-900/30 transition">
                      <td className="py-3.5 px-4 font-mono text-violet-400">{tx.messageId ? `${tx.messageId.slice(0, 12)}...` : `${tx.sourceTxHash.slice(0, 12)}...`}</td>
                      <td className="py-3.5 px-4 text-slate-300">{getChainName(tx.sourceChainId)}</td>
                      <td className="py-3.5 px-4 text-slate-300">{getChainName(tx.destChainId)}</td>
                      <td className="py-3.5 px-4 text-slate-100 font-semibold">{formatWeiToEth(tx.amount)} CCT</td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          tx.status === "COMPLETED" ? "bg-emerald-950 text-emerald-400" :
                          tx.status === "PENDING" ? "bg-amber-950 text-amber-400" :
                          "bg-rose-950 text-rose-400"
                        }`}>
                          {tx.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right text-slate-400">
                        {new Date(tx.createdAt).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500 font-semibold">
                      No bridge transactions detected.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
