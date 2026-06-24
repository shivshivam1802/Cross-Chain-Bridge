import { ethers } from "ethers";
import { query } from "../config/db";

const BRIDGE_ABI = [
  "event BridgeSent(bytes32 indexed messageId, address indexed sender, address indexed receiver, uint64 destinationChainSelector, address token, uint256 amount, uint256 platformFee, uint256 ccipFee)",
  "event BridgeReceived(bytes32 indexed messageId, address indexed receiver, uint64 sourceChainSelector, address token, uint256 amount)"
];

interface Network {
  chain_id: string;
  name: string;
  ccip_selector: string;
  rpc_url: string;
  bridge_address: string;
}

export class BridgeIndexer {
  private providers: Map<string, ethers.JsonRpcProvider> = new Map();
  private contracts: Map<string, ethers.Contract> = new Map();
  private selectorToChainId: Map<string, string> = new Map();

  async start() {
    console.log("Starting Bridge Indexer Service...");

    try {
      // 1. Fetch active networks
      const networksResult = await query("SELECT chain_id, name, ccip_selector, rpc_url, bridge_address FROM networks WHERE is_active = true");
      const networks: Network[] = networksResult.rows;

      if (networks.length === 0) {
        console.warn("No active networks configured in the database.");
        return;
      }

      // Build chain selector map
      for (const net of networks) {
        this.selectorToChainId.set(net.ccip_selector, net.chain_id);
      }

      // 2. Setup providers and listeners
      for (const net of networks) {
        if (net.bridge_address === ethers.ZeroAddress) {
          console.warn(`Skipping network ${net.name} - bridge address is 0x0`);
          continue;
        }

        try {
          console.log(`Connecting to ${net.name} RPC: ${net.rpc_url}`);
          const provider = new ethers.JsonRpcProvider(net.rpc_url);
          this.providers.set(net.chain_id, provider);

          const contract = new ethers.Contract(net.bridge_address, BRIDGE_ABI, provider);
          this.contracts.set(net.chain_id, contract);

          // Start active listeners
          this.listenToEvents(net.chain_id, contract, net.name);

          // Historical block catch-up (scan last 100 blocks on start)
          this.catchUpHistoricalEvents(net.chain_id, contract, provider, net.name);

        } catch (err) {
          console.error(`Error connecting to network ${net.name}:`, err);
        }
      }
    } catch (err) {
      console.error("Failed to start indexer:", err);
    }
  }

  private listenToEvents(chainId: string, contract: ethers.Contract, networkName: string) {
    console.log(`Setting up listeners on ${networkName}...`);

    contract.on("BridgeSent", async (messageId, sender, receiver, destinationChainSelector, token, amount, platformFee, ccipFee, event) => {
      try {
        const txHash = event.log.transactionHash;
        const blockNumber = event.log.blockNumber;
        console.log(`[${networkName}] BridgeSent Event detected. TxHash: ${txHash}, MessageId: ${messageId}`);
        await this.handleBridgeSent(chainId, messageId, sender, receiver, destinationChainSelector.toString(), token, amount.toString(), (platformFee + ccipFee).toString(), txHash, blockNumber);
      } catch (err) {
        console.error(`Error handling BridgeSent on ${networkName}:`, err);
      }
    });

    contract.on("BridgeReceived", async (messageId, receiver, sourceChainSelector, token, amount, event) => {
      try {
        const txHash = event.log.transactionHash;
        const blockNumber = event.log.blockNumber;
        console.log(`[${networkName}] BridgeReceived Event detected. TxHash: ${txHash}, MessageId: ${messageId}`);
        await this.handleBridgeReceived(chainId, messageId, receiver, sourceChainSelector.toString(), token, amount.toString(), txHash, blockNumber);
      } catch (err) {
        console.error(`Error handling BridgeReceived on ${networkName}:`, err);
      }
    });
  }

  private async catchUpHistoricalEvents(chainId: string, contract: ethers.Contract, provider: ethers.JsonRpcProvider, networkName: string) {
    try {
      const currentBlock = await provider.getBlockNumber();
      const startBlock = Math.max(0, currentBlock - 100); // scan last 100 blocks
      console.log(`[${networkName}] Catching up historical events from block ${startBlock} to ${currentBlock}...`);

      const sentFilter = contract.filters.BridgeSent();
      const receivedFilter = contract.filters.BridgeReceived();

      const sentLogs = await contract.queryFilter(sentFilter, startBlock, currentBlock);
      for (const log of sentLogs) {
        if ("args" in log && log.args) {
          const [messageId, sender, receiver, destinationChainSelector, token, amount, platformFee, ccipFee] = log.args;
          await this.handleBridgeSent(chainId, messageId, sender, receiver, destinationChainSelector.toString(), token, amount.toString(), (platformFee + ccipFee).toString(), log.transactionHash, log.blockNumber);
        }
      }

      const receivedLogs = await contract.queryFilter(receivedFilter, startBlock, currentBlock);
      for (const log of receivedLogs) {
        if ("args" in log && log.args) {
          const [messageId, receiver, sourceChainSelector, token, amount] = log.args;
          await this.handleBridgeReceived(chainId, messageId, receiver, sourceChainSelector.toString(), token, amount.toString(), log.transactionHash, log.blockNumber);
        }
      }
      console.log(`[${networkName}] Catch-up complete.`);
    } catch (err) {
      console.error(`[${networkName}] Catch-up failed:`, err);
    }
  }

  private async handleBridgeSent(
    sourceChainId: string,
    messageId: string,
    sender: string,
    receiver: string,
    destSelector: string,
    token: string,
    amount: string,
    fee: string,
    txHash: string,
    blockNumber: number
  ) {
    const destChainId = this.selectorToChainId.get(destSelector) || null;

    // Check if tx already indexed (e.g. from listener vs catch-up)
    const existing = await query("SELECT id, status FROM transactions WHERE message_id = $1", [messageId]);

    if (existing.rowCount && existing.rowCount > 0) {
      // Just update source transaction details if not already present
      await query(
        `UPDATE transactions 
         SET sender = $1, receiver = $2, source_chain_id = $3, dest_chain_id = COALESCE(dest_chain_id, $4), 
             token_address = $5, amount = $6, fee_amount = $7, source_tx_hash = $8, updated_at = NOW() 
         WHERE message_id = $9`,
        [sender, receiver, sourceChainId, destChainId, token, amount, fee, txHash, messageId]
      );
    } else {
      // Insert new transaction
      await query(
        `INSERT INTO transactions (message_id, sender, receiver, source_chain_id, dest_chain_id, token_address, amount, fee_amount, status, source_tx_hash, block_number)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING', $9, $10)
         ON CONFLICT (message_id) DO NOTHING`,
        [messageId, sender, receiver, sourceChainId, destChainId, token, amount, fee, txHash, blockNumber]
      );
    }
  }

  private async handleBridgeReceived(
    destChainId: string,
    messageId: string,
    receiver: string,
    srcSelector: string,
    token: string,
    amount: string,
    txHash: string,
    blockNumber: number
  ) {
    const sourceChainId = this.selectorToChainId.get(srcSelector) || null;

    const existing = await query("SELECT id, status FROM transactions WHERE message_id = $1", [messageId]);

    if (existing.rowCount && existing.rowCount > 0) {
      // Update existing transaction status to completed
      await query(
        `UPDATE transactions 
         SET status = 'COMPLETED', dest_tx_hash = $1, updated_at = NOW() 
         WHERE message_id = $2`,
        [txHash, messageId]
      );
    } else {
      // If we caught the receive event before the send event (lag/indexing order)
      await query(
        `INSERT INTO transactions (message_id, sender, receiver, source_chain_id, dest_chain_id, token_address, amount, status, dest_tx_hash, block_number)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'COMPLETED', $8, $9)
         ON CONFLICT (message_id) DO NOTHING`,
        [messageId, "0x0000000000000000000000000000000000000000", receiver, sourceChainId, destChainId, token, amount, txHash, blockNumber]
      );
    }
  }
}
