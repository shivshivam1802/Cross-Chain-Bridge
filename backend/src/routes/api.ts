import { Router } from "express";
import { getNetworks, getTokens, getTransactions, getTransactionByHash } from "../controllers/bridgeController";
import { getDashboardStats } from "../controllers/statsController";
import { addToken, configureNetwork } from "../controllers/adminController";

const router = Router();

// Bridge User Queries
router.get("/networks", getNetworks);
router.get("/tokens", getTokens);
router.get("/transactions", getTransactions);
router.get("/transactions/:hash", getTransactionByHash);

// Dashboard Statistics
router.get("/stats", getDashboardStats);

// Secured Administrative Routes
router.post("/admin/token", addToken);
router.post("/admin/network", configureNetwork);

export default router;
