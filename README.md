# Onyx — NFT Wash-Trading Risk Analyzer

**Onyx* is an online web application that analyzes Ethereum NFTs for patterns consistent with wash trading. It combines multi-source blockchain data (Alchemy, OpenSea, Etherscan) with a deterministic 0–100 scoring detection engine and a non-authoritative Gemini AI explanation layer.

---

## 🌟 Key Features & Signals

- **Deterministic Detection Engine**: Calculates a 0–100 Wash-Trading Risk Score based on 7 explainable on-chain signals:
  1. **Repeated Trading** (Max 25 pts)
  2. **Circular Trading** (Max 20 pts)
  3. **Shared Funding** (Max 15 pts)
  4. **Rapid Trading** (Max 10 pts)
  5. **Price / Value Anomaly** (Max 15 pts)
  6. **Wallet Behavior** (Max 10 pts)
  7. **Funding / Gas Relationship** (Max 5 pts)
- **Interactive Wallet Network Topology**: Direct SVG visual graph rendering participating wallets as nodes and transactions as directed edges with ETH values and circular trade highlights.
- **OpenSea Market Context**: Displays collection info, floor price, and sales context.
- **Etherscan On-Chain Verification**: Direct links for contract, token, and transaction hash verification.
- **Gemini AI Explanation Layer**: Translates structured evidence into plain-English executive summaries and key findings without altering scores or inventing data.

---

## 🏗️ Project Architecture

```
washguard/
├── backend/
│   ├── main.py               # FastAPI server entry point & POST /analyze pipeline
│   ├── alchemy.py            # Alchemy Ethereum Mainnet transfer fetcher
│   ├── opensea.py            # OpenSea v2 API market context fetcher
│   ├── etherscan.py          # Etherscan verification URL generator
│   ├── detection.py          # Deterministic 0-100 Wash-Trading Detection Engine
│   ├── gemini.py             # Gemini AI explanation generator
│   ├── requirements.txt      # Python dependencies (FastAPI, Uvicorn, httpx, etc.)
│   └── .env.example          # Environment variables template
└── frontend/
    ├── src/
    │   ├── App.jsx           # Modern hackathon dashboard UI
    │   ├── index.css         # Dark-mode cyber forensics design system
    │   └── components/
    │       └── WalletGraph.jsx # Interactive SVG Wallet Network Graph
    ├── package.json          # React + Vite dependencies
    └── .env                  # Frontend configuration (VITE_API_URL)
```

---

## 🚀 Quick Start Guide

### 1. Backend Setup (FastAPI)
```bash
cd backend
python -m pip install -r requirements.txt
cp .env.example .env
# Configure your API keys in backend/.env:
# ALCHEMY_API_KEY=your_key
# OPENSEA_API_KEY=your_key
# ETHERSCAN_API_KEY=your_key
# GEMINI_API_KEY=your_key

python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```
*Backend runs on `http://127.0.0.1:8000`*

### 2. Frontend Setup (React + Vite)
```bash
cd frontend
npm install
npm run dev
```
*Frontend runs on `http://localhost:5173`*

---

## 🛠️ Production Build & Deployment

### Production Frontend Build
```bash
cd frontend
npm run build
```

### Environment Variables
Configure the following in `backend/.env`:
- `ALCHEMY_API_KEY`
- `OPENSEA_API_KEY`
- `ETHERSCAN_API_KEY`
- `GEMINI_API_KEY`
- `ALLOW_MOCK_FALLBACK=true` (Enables resilient demo fallbacks if an API key is unconfigured)

Configure in `frontend/.env`:
- `VITE_API_URL=https://your-backend-domain.com`

---

## ⚖️ Legal & Heuristic Notice
WashGuard provides a blockchain-pattern risk assessment based on on-chain heuristics. It does not establish trading intent, physical wallet ownership, or market manipulation with legal certainty.
