import { Request, Response } from "express";
import { ethers } from "ethers";
import { query } from "../config/db";

// Cryptographic verification helper
const verifyAdminSignature = (
  message: string,
  signature: string,
  expectedAdmin: string
): boolean => {
  try {
    const recoveredAddress = ethers.verifyMessage(message, signature);
    return recoveredAddress.toLowerCase() === expectedAdmin.toLowerCase();
  } catch (err) {
    console.error("Signature recovery failed:", err);
    return false;
  }
};

export const addToken = async (req: Request, res: Response) => {
  const { tokenAddress, symbol, name, decimals, chainId, isBurnMint, message, signature } = req.body;

  if (!tokenAddress || !symbol || !name || !chainId || !message || !signature) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  const adminAddress = process.env.ADMIN_ADDRESS;
  if (!adminAddress) {
    return res.status(500).json({ success: false, message: "Server not configured with admin address" });
  }

  // 1. Verify EIP-191 signature
  const isAuthorized = verifyAdminSignature(message, signature, adminAddress);
  if (!isAuthorized) {
    return res.status(401).json({ success: false, message: "Unauthorized: Invalid admin signature" });
  }

  try {
    // 2. Add or update token in db
    await query(
      `INSERT INTO tokens (token_address, symbol, name, decimals, chain_id, is_burn_mint, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       ON CONFLICT (token_address, chain_id) 
       DO UPDATE SET symbol = $2, name = $3, decimals = $4, is_burn_mint = $5, is_active = true`,
      [tokenAddress.toLowerCase(), symbol, name, decimals || 18, chainId, isBurnMint || false]
    );

    res.json({ success: true, message: `Token ${symbol} successfully configured on chain ${chainId}` });
  } catch (err: any) {
    console.error("Error adding token:", err);
    res.status(500).json({ success: false, message: "Database error" });
  }
};

export const configureNetwork = async (req: Request, res: Response) => {
  const { chainId, name, ccipSelector, rpcUrl, bridgeAddress, isActive, message, signature } = req.body;

  if (!chainId || !name || !ccipSelector || !rpcUrl || !bridgeAddress || !message || !signature) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  const adminAddress = process.env.ADMIN_ADDRESS;
  if (!adminAddress) {
    return res.status(500).json({ success: false, message: "Server not configured with admin address" });
  }

  const isAuthorized = verifyAdminSignature(message, signature, adminAddress);
  if (!isAuthorized) {
    return res.status(401).json({ success: false, message: "Unauthorized: Invalid admin signature" });
  }

  try {
    await query(
      `INSERT INTO networks (chain_id, name, ccip_selector, rpc_url, bridge_address, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (chain_id) 
       DO UPDATE SET name = $2, ccip_selector = $3, rpc_url = $4, bridge_address = $5, is_active = $6`,
      [chainId, name, ccipSelector, rpcUrl, bridgeAddress.toLowerCase(), isActive !== false]
    );

    res.json({ success: true, message: `Network ${name} configured successfully` });
  } catch (err: any) {
    console.error("Error configuring network:", err);
    res.status(500).json({ success: false, message: "Database error" });
  }
};
