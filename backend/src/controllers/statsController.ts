import { Request, Response } from "express";
import { query } from "../config/db";

export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    // 1. Get status counts
    const statusCountsResult = await query(
      "SELECT status, COUNT(*) as count FROM transactions GROUP BY status"
    );
    const statusCounts = statusCountsResult.rows.reduce(
      (acc: any, row: any) => {
        acc[row.status.toLowerCase()] = parseInt(row.count);
        acc.total += parseInt(row.count);
        return acc;
      },
      { pending: 0, completed: 0, failed: 0, total: 0 }
    );

    // 2. Get volume by token
    const tokenVolumeResult = await query(`
      SELECT COALESCE(t.symbol, 'UNKNOWN') as symbol, SUM(CAST(tx.amount AS NUMERIC)) as volume, COUNT(tx.id) as txCount
      FROM transactions tx
      LEFT JOIN tokens t ON LOWER(tx.token_address) = LOWER(t.token_address) AND tx.source_chain_id = t.chain_id
      WHERE tx.status = 'COMPLETED'
      GROUP BY t.symbol
    `);

    // 3. Get daily transaction volume for the last 7 days
    const dailyVolumeResult = await query(`
      SELECT DATE_TRUNC('day', created_at) as date, COUNT(*) as txCount, SUM(CAST(amount AS NUMERIC)) as volume
      FROM transactions
      WHERE created_at >= NOW() - INTERVAL '7 days' AND status = 'COMPLETED'
      GROUP BY DATE_TRUNC('day', created_at)
      ORDER BY date ASC
    `);

    const dailyStats = dailyVolumeResult.rows.map((row: any) => ({
      date: row.date.toISOString().split("T")[0],
      txCount: parseInt(row.txcount),
      volume: row.volume ? row.volume.toString() : "0",
    }));

    // 4. Get active routes
    const routeStatsResult = await query(`
      SELECT n1.name as sourceNetwork, n2.name as destNetwork, COUNT(tx.id) as txCount
      FROM transactions tx
      JOIN networks n1 ON tx.source_chain_id = n1.chain_id
      JOIN networks n2 ON tx.dest_chain_id = n2.chain_id
      GROUP BY n1.name, n2.name
      ORDER BY txCount DESC
      LIMIT 5
    `);

    res.json({
      success: true,
      data: {
        statusCounts,
        tokenVolume: tokenVolumeResult.rows.map((row: any) => ({
          symbol: row.symbol,
          volume: row.volume ? row.volume.toString() : "0",
          txCount: parseInt(row.txcount),
        })),
        dailyStats,
        routeStats: routeStatsResult.rows,
      },
    });
  } catch (err: any) {
    console.error("Error fetching stats:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
