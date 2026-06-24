# Cross-Chain Bridge DApp

A production-ready Cross-Chain Bridge DApp enabling ERC-20 token transfers across **Ethereum**, **Polygon**, and **BNB Chain** using **Chainlink CCIP** (Cross-Chain Interoperability Protocol).

## Tech Stack
- **Frontend**: Next.js 15, TypeScript, Tailwind CSS, Radix & Lucide Icons
- **Backend**: Node.js, Express, TypeScript, PostgreSQL
- **Smart Contracts**: Solidity, Hardhat, Chainlink CCIP local simulator
- **Deployment**: Docker, Docker Compose

## Repository Structure
- `contracts/` - Smart contracts, Hardhat config, unit tests using Chainlink local simulator.
- `backend/` - Node/Express backend APIs, PostgreSQL database migrations, and indexer.
- `frontend/` - Next.js 15 web UI portal, dashboard, explorer, and admin panel.

---

## Getting Started

### Prerequisites
- Node.js (v20+)
- Docker & Docker Compose
- MetaMask or another Web3 Wallet

---

## 1. Smart Contracts Setup

1. Navigate to the contracts directory:
   ```bash
   cd contracts
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the import patching utility (converts versioned OpenZeppelin paths inside Chainlink contracts to standard paths):
   ```bash
   node patch-imports.js
   ```
4. Compile the contracts:
   ```bash
   npm run compile
   ```
5. Run the unit test suite:
   ```bash
   npm run test
   ```

---

## 2. Docker Local Deployment (Full Stack)

To spin up the PostgreSQL database, Express Indexer API, and Next.js frontend together:

1. Create a `.env` file in the root directory (you can copy the provided `.env.example`):
   ```bash
   cp .env.example .env
   ```
2. Build and launch all services:
   ```bash
   docker-compose up --build
   ```
3. The services will be accessible at:
   - **Frontend UI**: `http://localhost:3000`
   - **Backend API**: `http://localhost:3001`
   - **PostgreSQL**: `http://localhost:5432`

---

## 3. Database Initialization

Once the database container is active, you can initialize the tables and seed configurations:

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Execute the initialization script:
   ```bash
   npm run db:init
   ```

This creates the tables (`networks`, `tokens`, `transactions`) and configures the default CCIP chain selectors and testing configurations.
