import os
from typing import Optional
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from alchemy import fetch_alchemy_nft_transfers
from opensea import fetch_opensea_market_data
from etherscan import generate_etherscan_verification_links
from detection import analyze_wash_trading
from gemini import generate_gemini_explanation

load_dotenv()

app = FastAPI(title="Onyx API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AnalyzeRequest(BaseModel):
    contract_address: Optional[str] = None
    contractAddress: Optional[str] = None
    token_id: Optional[str] = None
    tokenId: Optional[str] = None

    @property
    def get_contract_address(self) -> str:
        return (self.contract_address or self.contractAddress or "").strip()

    @property
    def get_token_id(self) -> str:
        return (self.token_id or self.tokenId or "").strip()

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "Onyx"
    }

@app.post("/analyze")
async def analyze(req: AnalyzeRequest):
    address = req.get_contract_address
    token = req.get_token_id

    if not address or not token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Both contract address and token ID are required."
        )

    # 1. Retrieve normalized blockchain activity from Alchemy
    alchemy_result = await fetch_alchemy_nft_transfers(address, token)

    if not alchemy_result.get("success"):
        error_code = alchemy_result.get("code", "ERROR")
        error_msg = alchemy_result.get("error", "Failed to retrieve Alchemy blockchain data.")
        
        status_code = status.HTTP_400_BAD_REQUEST
        if error_code in ["MISSING_API_KEY", "UNAUTHORIZED"]:
            status_code = status.HTTP_401_UNAUTHORIZED
        elif error_code == "RATE_LIMITED":
            status_code = status.HTTP_429_TOO_MANY_REQUESTS
        elif error_code in ["TIMEOUT", "NETWORK_ERROR", "INTERNAL_ERROR", "ALCHEMY_HTTP_ERROR", "RPC_ERROR", "MALFORMED_RESPONSE"]:
            status_code = status.HTTP_502_BAD_GATEWAY

        raise HTTPException(status_code=status_code, detail=f"[{error_code}] {error_msg}")

    normalized_transfers = alchemy_result.get("transfers", [])

    # 2. Retrieve OpenSea market data
    opensea_market_data = await fetch_opensea_market_data(address, token)

    # 3. Generate Etherscan verification links
    etherscan_links = generate_etherscan_verification_links(address, token, normalized_transfers)

    # 4. Run deterministic Wash Trading Detection Engine with market context
    detection_result = analyze_wash_trading(normalized_transfers, opensea_market_data)

    # 5. Generate AI plain-English explanation (never alters score/signals)
    ai_explanation = await generate_gemini_explanation({
        "risk_score": detection_result["risk_score"],
        "risk_level": detection_result["risk_level"],
        "signals": detection_result["signals"],
        "total_transfers_found": alchemy_result["total_transfers_found"],
        "market_data": opensea_market_data
    })

    return {
        "status": "success",
        "data_source": "Alchemy, OpenSea, Etherscan & AI",
        "contract_address": alchemy_result["contract_address"],
        "token_id": alchemy_result["token_id"],
        "total_transfers_found": alchemy_result["total_transfers_found"],
        "raw_transfers_scanned": alchemy_result.get("raw_transfers_scanned", 0),
        "pages_scanned": alchemy_result.get("pages_scanned", 0),
        "history_complete": alchemy_result.get("history_complete", True),
        "risk_score": detection_result["risk_score"],
        "risk_level": detection_result["risk_level"],
        "signals": detection_result["signals"],
        "disclaimer": detection_result["disclaimer"],
        "ai_explanation": ai_explanation,
        "market_data": opensea_market_data,
        "etherscan_links": etherscan_links,
        "normalized_transfers": normalized_transfers,
        "note": alchemy_result.get("note", "")
    }
