-- Networks Table
CREATE TABLE IF NOT EXISTS networks (
    chain_id BIGINT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    ccip_selector BIGINT NOT NULL UNIQUE,
    rpc_url VARCHAR(255) NOT NULL,
    bridge_address VARCHAR(42) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

-- Supported Tokens Table
CREATE TABLE IF NOT EXISTS tokens (
    id SERIAL PRIMARY KEY,
    token_address VARCHAR(42) NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    name VARCHAR(50) NOT NULL,
    decimals INT NOT NULL DEFAULT 18,
    chain_id BIGINT REFERENCES networks(chain_id) ON DELETE CASCADE,
    is_burn_mint BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE (token_address, chain_id)
);

-- Cross-Chain Bridge Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id VARCHAR(66) UNIQUE, -- CCIP Message ID (bytes32 hex representation)
    sender VARCHAR(42) NOT NULL,
    receiver VARCHAR(42) NOT NULL,
    source_chain_id BIGINT REFERENCES networks(chain_id),
    dest_chain_id BIGINT REFERENCES networks(chain_id),
    token_address VARCHAR(42) NOT NULL,
    amount NUMERIC(78, 0) NOT NULL, -- Handles uint256 precision
    fee_amount NUMERIC(78, 0) DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING, COMPLETED, FAILED
    source_tx_hash VARCHAR(66) NOT NULL,
    dest_tx_hash VARCHAR(66),
    block_number BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_transactions_sender ON transactions(sender);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_message_id ON transactions(message_id);

-- Seed Initial Data
INSERT INTO networks (chain_id, name, ccip_selector, rpc_url, bridge_address) VALUES
(11155111, 'Ethereum Sepolia', 16015286601757825753, 'http://localhost:8545', '0x0000000000000000000000000000000000000000')
ON CONFLICT (chain_id) DO NOTHING;

INSERT INTO networks (chain_id, name, ccip_selector, rpc_url, bridge_address) VALUES
(80002, 'Polygon Amoy', 1628171139167062214, 'http://localhost:8545', '0x0000000000000000000000000000000000000000')
ON CONFLICT (chain_id) DO NOTHING;

INSERT INTO networks (chain_id, name, ccip_selector, rpc_url, bridge_address) VALUES
(97, 'BNB Chain Testnet', 13264668187771770619, 'http://localhost:8545', '0x0000000000000000000000000000000000000000')
ON CONFLICT (chain_id) DO NOTHING;
