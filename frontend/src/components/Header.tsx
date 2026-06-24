"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWeb3Context } from "../context/Web3Context";
import { NETWORKS } from "../lib/constants";
import { Wallet, ChevronDown, CheckCircle2, AlertTriangle, Activity } from "lucide-react";

export const Header = () => {
  const pathname = usePathname();
  const { state, connectWallet, disconnectWallet, switchNetwork } = useWeb3Context();

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const navItems = [
    { label: "Bridge", href: "/" },
    { label: "Dashboard", href: "/dashboard" },
    { label: "Explorer", href: "/explorer" },
    { label: "Admin", href: "/admin" }
  ];

  const currentNetwork = state.chainId ? NETWORKS[state.chainId] : null;

  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-slate-950/60 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <Activity className="h-6 w-6 text-violet-500 animate-pulse" />
              <span className="bg-gradient-to-r from-violet-400 via-indigo-400 to-emerald-400 bg-clip-text text-xl font-bold tracking-wider text-transparent text-glow">
                AetherBridge
              </span>
            </Link>

            {/* Nav Items */}
            <nav className="hidden md:flex items-center gap-6">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`text-sm font-medium transition-all ${
                      isActive
                        ? "text-violet-400 text-glow"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Web3 Connections */}
          <div className="flex items-center gap-3">
            {/* Active Network Indicator */}
            {state.isConnected && currentNetwork && (
              <div className="relative group">
                <button className="flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-950/30 px-3.5 py-1.5 text-xs font-semibold text-violet-300 transition hover:bg-violet-950/50">
                  <span className="h-2 w-2 rounded-full bg-violet-400 animate-pulse" />
                  {currentNetwork.name}
                  <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                </button>

                {/* Dropdown to switch network */}
                <div className="absolute right-0 mt-2 hidden group-hover:block w-48 rounded-lg border border-slate-800 bg-slate-950 p-1.5 shadow-2xl">
                  {Object.values(NETWORKS).map((net) => (
                    <button
                      key={net.chainId}
                      onClick={() => switchNetwork(net.chainId)}
                      className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-xs transition hover:bg-slate-900 ${
                        state.chainId === net.chainId
                          ? "text-violet-400 font-bold"
                          : "text-slate-300"
                      }`}
                    >
                      {net.name}
                      {state.chainId === net.chainId && <CheckCircle2 className="h-3.5 w-3.5 text-violet-400" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Wallet Connect Button */}
            {state.isConnected && state.address ? (
              <button
                onClick={disconnectWallet}
                className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/60 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-850 hover:border-slate-700"
              >
                <Wallet className="h-4 w-4 text-violet-400" />
                {truncateAddress(state.address)}
              </button>
            ) : (
              <button
                onClick={connectWallet}
                disabled={state.isConnecting}
                className="flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-5.5 py-2.2 text-xs font-bold text-white shadow-lg shadow-violet-900/20 transition duration-300 hover:-translate-y-0.5 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50"
              >
                <Wallet className="h-4 w-4" />
                {state.isConnecting ? "Connecting..." : "Connect Wallet"}
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
