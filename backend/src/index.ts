import express from "express";
import cors from "cors";
import * as dotenv from "dotenv";
import apiRouter from "./routes/api";
import { BridgeIndexer } from "./services/indexer";

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Mount APIs
app.use("/api", apiRouter);

// Basic health check
app.get("/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date() });
});

// Start Indexer Service in Background
const indexer = new BridgeIndexer();

app.listen(port, () => {
  console.log(`Backend server running on port ${port}`);
  
  indexer.start()
    .then(() => console.log("Indexer service initialized."))
    .catch((err) => console.error("Indexer failed to initialize:", err));
});
