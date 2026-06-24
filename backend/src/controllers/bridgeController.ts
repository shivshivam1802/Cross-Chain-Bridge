import { Request, Response } from "express";
import { query } from "../config/db";

export const getNetworks = async (req: Request, res: Response) => {
  try {
    const result = await query("SELECT chain_id as chainId, name, ccip_selector as ccipSelector, rpc_url as rpcUrl, bridge_address as bridgeAddress FROM networks WHERE is_active = true");
    res.json({ success: true, data: result.rows });
  } catch (err: any) {
    console.error("Error fetching networks:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getTokens = async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT t.id, t.token_address as tokenAddress, t.symbol, t.name, t.decimals, t.chain_id as chainId, t.is_burn_mint as isBurnMint
       FROM tokens t
       JOIN networks n ON t.chain_id = n.chain_id
       WHERE t.is_active = true AND n.is_active = true`
    );
    res.json({ success: true, data: result.rows });
  } catch (err: any) {
    console.error("Error fetching tokens:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getTransactions = async (req: Request, res: Response) => {
  try {
    const wallet = req.query.wallet as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    let queryText = `
      SELECT t.id, t.message_id as messageId, t.sender, t.receiver, 
             t.source_chain_id as sourceChainId, t.dest_chain_id as destChainId, 
             t.token_address as tokenAddress, t.amount, t.fee_amount as feeAmount, 
             t.status, t.source_tx_hash as sourceTxHash, t.dest_tx_hash as destTxHash, 
             t.block_number as blockNumber, t.created_at as createdAt, t.updated_at as updatedAt
      FROM transactions t
    `;
    const queryParams: any[] = [];

    if (wallet) {
      queryText += " WHERE LOWER(t.sender) = LOWER($1) OR LOWER(t.receiver) = LOWER($1)";
      queryParams.push(wallet);
    }

    queryText += ` ORDER BY t.created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(limit, offset);

    const result = await query(queryText, queryParams);

    // Get count for pagination
    let countQueryText = "SELECT COUNT(*) FROM transactions";
    const countParams: any[] = [];
    if (wallet) {
      countQueryText += " WHERE LOWER(sender) = LOWER($1) OR LOWER(receiver) = LOWER($1)";
      countParams.push(wallet);
    }
    const countResult = await query(countQueryText, countParams);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err: any) {
    console.error("Error fetching transactions:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getTransactionByHash = async (req: Request, res: Response) => {
  try {
    const hash = req.params.hash;
    const result = await query(
      `SELECT id, message_id as messageId, sender, receiver, 
              source_chain_id as sourceChainId, dest_chain_id as destChainId, 
              token_address as tokenAddress, amount, fee_amount as feeAmount, 
              status, source_tx_hash as sourceTxHash, dest_tx_hash as destTxHash, 
              block_number as blockNumber, created_at as createdAt, updated_at as updatedAt
       FROM transactions 
       WHERE LOWER(source_tx_hash) = LOWER($1) OR LOWER(dest_tx_hash) = LOWER($1) OR LOWER(message_id) = LOWER($1)`,
      [hash]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Transaction not found" });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err: any) {
    console.error("Error fetching transaction details:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
