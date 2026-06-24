"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWeb3Context } from "../context/Web3Context";
import { NETWORKS } from "../lib/constants";
import { Wallet, ChevronDown, CheckCircle2, X, AlertCircle, Loader2, Activity, ShieldCheck } from "lucide-react";

export const Header = () => {
  const pathname = usePathname();
  const {
    state,
    connectWallet,
    disconnectWallet,
    switchNetwork,
    isModalOpen,
    setIsModalOpen,
    modalView,
    setModalView,
    selectedWalletName,
    setSelectedWalletName
  } = useWeb3Context();

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

  const handleOpenModal = () => {
    setModalView("SELECT");
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleSelectMetaMask = async () => {
    setModalView("CONNECTING");
    setSelectedWalletName("MetaMask");
    try {
      await connectWallet("MetaMask");
    } catch (err) {
      setModalView("SELECT");
    }
  };

  const handleSelectWalletConnect = () => {
    setModalView("QR_CODE");
    setSelectedWalletName("WalletConnect");
    
    // Simulate QR code scan success after 4 seconds
    setTimeout(async () => {
      try {
        await connectWallet("WalletConnect");
      } catch (err) {
        setModalView("SELECT");
      }
    }, 4000);
  };

  const handleSelectCoinbase = () => {
    setModalView("CONNECTING");
    setSelectedWalletName("Coinbase Wallet");
    
    // Simulate connection
    setTimeout(async () => {
      try {
        await connectWallet("Coinbase");
      } catch (err) {
        setModalView("SELECT");
      }
    }, 2000);
  };

  const handleSelectSandbox = async () => {
    setModalView("CONNECTING");
    setSelectedWalletName("Sandbox Wallet");
    try {
      await connectWallet("MockSandbox");
    } catch (err) {
      setModalView("SELECT");
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/5 bg-slate-950/60 backdrop-blur-md">
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

              {/* Wallet Status / Trigger Modal */}
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
                  onClick={handleOpenModal}
                  disabled={state.isConnecting}
                  className="flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-5.5 py-2.2 text-xs font-bold text-white shadow-lg shadow-violet-900/20 transition duration-300 hover:-translate-y-0.5 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50"
                >
                  <Wallet className="h-4 w-4" />
                  Connect Wallet
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Wallet Selection Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0d0a25] p-6 shadow-2xl relative">
            {/* Close Button */}
            <button
              onClick={handleCloseModal}
              className="absolute right-4 top-4 rounded-full p-1.5 text-slate-400 hover:bg-white/5 hover:text-white transition"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Modal Content depending on state */}
            {modalView === "SELECT" && (
              <div className="space-y-5">
                <div className="text-center">
                  <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">Connect a Wallet</h3>
                  <p className="text-[11px] text-slate-400 mt-1">Select your preferred wallet connection to use AetherBridge</p>
                </div>

                <div className="space-y-2.5">
                  {/* MetaMask */}
                  <button
                    onClick={handleSelectMetaMask}
                    className="flex w-full items-center justify-between rounded-xl border border-white/5 bg-white/5 p-3 text-xs font-bold text-slate-200 transition hover:bg-white/10 hover:border-violet-500/30 text-left"
                  >
                    <div className="flex items-center gap-3">
                      {/* MetaMask Fox SVG */}
                      <svg className="h-6 w-6" viewBox="0 0 32 32" fill="none">
                        <path d="M30 16c0 7.732-6.268 14-14 14S2 23.732 2 16 8.268 2 16 2s14 6.268 14 14z" fill="#E2761B"/>
                        <path d="M16 5.5l-6.5 6.5h13L16 5.5z" fill="#E4761B"/>
                        <path d="M16 26.5l6.5-6.5h-13l6.5 6.5z" fill="#E4761B"/>
                        <path d="M16 5.5L8 14.5l8 3.5 8-3.5-8-9z" fill="#F6851B"/>
                        <path d="M16 26.5l8-9-8-3.5-8 3.5 8 9z" fill="#F6851B"/>
                      </svg>
                      <span>MetaMask</span>
                    </div>
                    <span className="text-[10px] text-violet-400 font-semibold uppercase">Popular</span>
                  </button>

                  {/* WalletConnect */}
                  <button
                    onClick={handleSelectWalletConnect}
                    className="flex w-full items-center justify-between rounded-xl border border-white/5 bg-white/5 p-3 text-xs font-bold text-slate-200 transition hover:bg-white/10 hover:border-violet-500/30 text-left"
                  >
                    <div className="flex items-center gap-3">
                      {/* WalletConnect SVG Logo */}
                      <svg className="h-6 w-6" viewBox="0 0 32 32" fill="none">
                        <path d="M8.5 11.5a7.5 7.5 0 0115 0c0 2.5-1.5 4.5-4 5.5l-3.5-3.5-3.5 3.5c-2.5-1-4-3-4-5.5z" fill="#3B99FC"/>
                        <path d="M16 19.5l3.5-3.5 3.5 3.5-3.5 3.5L16 19.5z" fill="#3B99FC"/>
                      </svg>
                      <span>WalletConnect</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">QR Scan</span>
                  </button>

                  {/* Coinbase Wallet */}
                  <button
                    onClick={handleSelectCoinbase}
                    className="flex w-full items-center justify-between rounded-xl border border-white/5 bg-white/5 p-3 text-xs font-bold text-slate-200 transition hover:bg-white/10 hover:border-violet-500/30 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-6 w-6 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white">
                        C
                      </div>
                      <span>Coinbase Wallet</span>
                    </div>
                  </button>

                  {/* Sandbox Wallet (Dev Mode) */}
                  <button
                    onClick={handleSelectSandbox}
                    className="flex w-full items-center justify-between rounded-xl border border-violet-500/30 bg-violet-950/20 p-3 text-xs font-bold text-slate-200 transition hover:bg-violet-950/30 hover:border-violet-500/50 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <ShieldCheck className="h-6 w-6 text-violet-400" />
                      <div>
                        <span className="block text-slate-200">Sandbox Wallet</span>
                        <span className="block text-[9px] text-slate-400 font-normal">Instant connection for testing</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-emerald-400 font-semibold uppercase">Dev Mode</span>
                  </button>
                </div>
              </div>
            )}

            {/* Connecting State */}
            {modalView === "CONNECTING" && (
              <div className="py-6 flex flex-col items-center justify-center space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
                <div className="text-center">
                  <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">Connecting...</h3>
                  <p className="text-[11px] text-slate-400 mt-1">Confirm the connection request in your {selectedWalletName} extension.</p>
                </div>
              </div>
            )}

            {/* WalletConnect QR Code view */}
            {modalView === "QR_CODE" && (
              <div className="space-y-5 flex flex-col items-center">
                <div className="text-center">
                  <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">Scan QR Code</h3>
                  <p className="text-[11px] text-slate-400 mt-1">Scan this code with a WalletConnect-compatible wallet app.</p>
                </div>

                {/* Decorative mock QR Code using SVG */}
                <div className="relative p-3 bg-white rounded-xl border border-slate-800">
                  <svg className="h-36 w-36 text-slate-950" viewBox="0 0 100 100" fill="currentColor">
                    {/* QR Finder patterns */}
                    <rect x="5" y="5" width="25" height="25" fill="none" stroke="currentColor" strokeWidth="6" />
                    <rect x="10" y="10" width="15" height="15" />
                    <rect x="70" y="5" width="25" height="25" fill="none" stroke="currentColor" strokeWidth="6" />
                    <rect x="75" y="10" width="15" height="15" />
                    <rect x="5" y="70" width="25" height="25" fill="none" stroke="currentColor" strokeWidth="6" />
                    <rect x="10" y="75" width="15" height="15" />
                    
                    {/* Simulated random QR data bits */}
                    <rect x="40" y="5" width="6" height="6" />
                    <rect x="50" y="12" width="6" height="12" />
                    <rect x="40" y="30" width="12" height="6" />
                    <rect x="10" y="45" width="6" height="6" />
                    <rect x="25" y="40" width="12" height="12" />
                    <rect x="45" y="50" width="6" height="6" />
                    <rect x="5" y="60" width="6" height="6" />
                    <rect x="55" y="70" width="12" height="6" />
                    <rect x="70" y="50" width="6" height="12" />
                    <rect x="85" y="45" width="12" height="6" />
                    <rect x="80" y="75" width="6" height="6" />
                    <rect x="90" y="90" width="6" height="6" />
                  </svg>
                  
                  {/* Subtle pulsing scanner glow */}
                  <div className="absolute inset-0 bg-violet-500/10 rounded-xl pointer-events-none animate-pulse" />
                </div>

                <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-400 bg-slate-900/60 px-3 py-1.5 rounded-full border border-slate-800">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-400" />
                  <span>Waiting for scan signature...</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
