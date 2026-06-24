"use client";

import React, { useState, useEffect } from "react";
import { NETWORKS } from "../lib/constants";
import { BarChart3, TrendingUp, CheckCircle, Clock, RefreshCw, Layers } from "lucide-react";

interface DashboardStats {
  statusCounts: {
    pending: number;
    completed: number;
    failed: number;
    total: number;
  };
  tokenVolume: Array<{
    symbol: string;
    volume: string;
    txCount: number;
  }>;
  dailyStats: Array<{
    date: string;
    txCount: number;
    volume: string;
  }>;
  routeStats: Array<{
    sourcenetwork: string;
    destnetwork: string;
    txcount: string;
  }>;
}

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
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchStatsAndHistory = async () => {
    setLoading(true);
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
    try {
      // Fetch stats
      const statsRes = await fetch(`${backendUrl}/stats`);
      const statsResult = await statsRes.json();
      if (statsResult.success) {
        setStats(statsResult.data);
      }

      // Fetch transaction history
      const txRes = await fetch(`${backendUrl}/transactions?limit=6`);
      const txResult = await txRes.json();
      if (txResult.success) {
        setTransactions(txResult.data);
      }
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatsAndHistory();
  }, []);

  const formatWeiToEth = (wei: string) => {
    const etherValue = Number(wei) / 1e18;
    return etherValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  };

  const getChainName = (chainIdStr: string) => {
    const id = Number(chainIdStr);
    return NETWORKS[id]?.name || `Chain ${id}`;
  };

  // Calculate stats parameters
  const totalVolumeWei = stats?.tokenVolume.reduce((acc, current) => acc + BigInt(current.volume), 0n) || 0n;
  const totalVolumeEth = Number(totalVolumeWei) / 1e18;
  const successRate = stats?.statusCounts.total 
    ? ((stats.statusCounts.completed / stats.statusCounts.total) * 100).toFixed(1)
    : "100.0";

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-glow text-white">System Analytics</h1>
          <p className="text-xs text-slate-400 mt-1">Real-time statistics and historical volume tracking.</p>
        </div>
        <button
          onClick={fetchStatsAndHistory}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-850 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh Stats
        </button>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Total volume */}
        <div className="glass-panel p-5 space-y-2 relative overflow-hidden">
          <div className="absolute right-3 top-3 text-slate-700">
            <TrendingUp className="h-6 w-6" />
          </div>
          <p className="text-xs font-semibold text-slate-400">Total Volume Bridged</p>
          <p className="text-2xl font-bold bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent text-glow">
            {totalVolumeEth.toFixed(2)} CCT
          </p>
          <p className="text-[10px] text-slate-500">Across all supported tokens</p>
        </div>

        {/* Success Rate */}
        <div className="glass-panel p-5 space-y-2 relative overflow-hidden">
          <div className="absolute right-3 top-3 text-slate-700">
            <CheckCircle className="h-6 w-6" />
          </div>
          <p className="text-xs font-semibold text-slate-400">Transaction Success Rate</p>
          <p className="text-2xl font-bold text-emerald-400 text-glow-green">
            {successRate}%
          </p>
          <p className="text-[10px] text-slate-500">
            {stats?.statusCounts.completed || 0} of {stats?.statusCounts.total || 0} txs succeeded
          </p>
        </div>

        {/* Pending transactions */}
        <div className="glass-panel p-5 space-y-2 relative overflow-hidden">
          <div className="absolute right-3 top-3 text-slate-700">
            <Clock className="h-6 w-6" />
          </div>
          <p className="text-xs font-semibold text-slate-400">Pending Transactions</p>
          <p className="text-2xl font-bold text-amber-400">
            {stats?.statusCounts.pending || 0}
          </p>
          <p className="text-[10px] text-slate-500">Actively routing via CCIP</p>
        </div>

        {/* Active networks */}
        <div className="glass-panel p-5 space-y-2 relative overflow-hidden">
          <div className="absolute right-3 top-3 text-slate-700">
            <Layers className="h-6 w-6" />
          </div>
          <p className="text-xs font-semibold text-slate-400">Registered Bridges</p>
          <p className="text-2xl font-bold text-violet-400">
            3 Chains
          </p>
          <p className="text-[10px] text-slate-500">ETH Sepolia, Polygon Amoy, BSC Testnet</p>
        </div>
      </div>

      <div className="grid w-full gap-8 lg:grid-cols-3">
        {/* SVG Daily Chart */}
        <div className="glass-panel p-6 lg:col-span-2 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-violet-400" />
            7-Day Transfer Volume Trend
          </h3>

          <div className="h-64 w-full flex items-end justify-between pt-6 border-b border-l border-slate-800/80 px-4 relative">
            {stats && stats.dailyStats.length > 0 ? (
              stats.dailyStats.map((day, idx) => {
                const maxVal = Math.max(...stats.dailyStats.map(d => Number(d.volume) / 1e18), 1);
                const currentVal = Number(day.volume) / 1e18;
                const percentage = (currentVal / maxVal) * 80 + 10; // offset between 10% and 90%

                return (
                  <div key={day.date} className="flex flex-col items-center flex-1 space-y-2">
                    {/* Tooltip */}
                    <div className="text-[9px] font-bold text-violet-300 opacity-0 hover:opacity-100 transition absolute -top-2 bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5">
                      {currentVal.toFixed(2)} CCT
                    </div>
                    {/* Bar */}
                    <div
                      style={{ height: `${percentage}%` }}
                      className="w-8 sm:w-12 bg-gradient-to-t from-violet-600/80 to-indigo-500/80 rounded-t-md hover:from-violet-500 hover:to-indigo-400 transition"
                    />
                    {/* Label */}
                    <span className="text-[9px] text-slate-500 font-semibold uppercase">{day.date.slice(5)}</span>
                  </div>
                );
              })
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-slate-500 font-semibold">
                No recent transactions detected
              </div>
            )}
          </div>
        </div>

        {/* Popular Routes */}
        <div className="glass-panel p-6 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Layers className="h-4 w-4 text-emerald-400" />
            Popular Bridges
          </h3>

          <div className="space-y-4">
            {stats && stats.routeStats.length > 0 ? (
              stats.routeStats.map((route, idx) => (
                <div key={idx} className="flex items-center justify-between border-b border-slate-800/40 pb-2.5 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold text-slate-200">{route.sourcenetwork}</span>
                    <span className="text-slate-500">→</span>
                    <span className="font-semibold text-slate-200">{route.destnetwork}</span>
                  </div>
                  <span className="text-xs font-bold text-violet-400 bg-violet-950/40 px-2 py-0.5 rounded-full border border-violet-950">
                    {route.txcount} Tx{Number(route.txcount) > 1 ? "s" : ""}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-xs text-slate-500 font-semibold py-8 text-center">
                No active routes calculated yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Transaction Feed */}
      <div className="glass-panel p-6 space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
          Recent Network Activity
        </h3>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                <th className="py-3 px-4">Message ID / Tx Hash</th>
                <th className="py-3 px-4">From</th>
                <th className="py-3 px-4">To</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {transactions.length > 0 ? (
                transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-900/30 transition">
                    <td className="py-3.5 px-4 font-mono text-slate-300">
                      <span className="text-violet-400">{tx.messageId ? `${tx.messageId.slice(0, 10)}...` : `${tx.sourceTxHash.slice(0, 10)}...`}</span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">{getChainName(tx.sourceChainId)}</td>
                    <td className="py-3.5 px-4 text-slate-300">{getChainName(tx.destChainId)}</td>
                    <td className="py-3.5 px-4 text-slate-100 font-semibold">{formatWeiToEth(tx.amount)} CCT</td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        tx.status === "COMPLETED" ? "bg-emerald-950 text-emerald-400 border border-emerald-950" :
                        tx.status === "PENDING" ? "bg-amber-950 text-amber-400 border border-amber-950" :
                        "bg-rose-950 text-rose-400 border border-rose-950"
                      }`}>
                        {tx.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right text-slate-400">
                      {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 font-semibold">
                    No transactions indexed yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
