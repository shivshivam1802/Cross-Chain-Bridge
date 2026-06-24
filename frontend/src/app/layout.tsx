import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Web3Provider } from "../context/Web3Context";
import { Header } from "../components/Header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AetherBridge | Chainlink CCIP Bridge Portal",
  description: "Secure, decentralized cross-chain bridge enabling instant token transfers between Ethereum, Polygon, and BNB Chain using Chainlink CCIP.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#030014]">
        <Web3Provider>
          <Header />
          <main className="flex-1 flex flex-col">
            {children}
          </main>
        </Web3Provider>
      </body>
    </html>
  );
}
