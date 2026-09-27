import copy
import os
import re
import time
from collections import OrderedDict
from typing import Any, Dict, Tuple

import httpx

MAX_TRANSFER_PAGES = 50
TRANSFER_PAGE_SIZE = 1000
TRANSFER_CACHE_TTL_SECONDS = 300
TRANSFER_CACHE_MAX_ENTRIES = 128
_transfer_cache: OrderedDict[Tuple[str, str], Tuple[float, Dict[str, Any]]] = OrderedDict()

def validate_ethereum_address(address: str) -> bool:
    """Validate 0x-prefixed 40-character hex Ethereum address."""
    return bool(re.match(r"^0x[a-fA-F0-9]{40}$", address.strip()))

def validate_token_id(token_id: str) -> bool:
    """Validate token ID is numeric or valid hex."""
    cleaned = token_id.strip()
    if cleaned.isdigit():
        return True
    if cleaned.startswith("0x") or cleaned.startswith("0X"):
        try:
            return bool(cleaned[2:]) and int(cleaned[2:], 16) >= 0
        except ValueError:
            return False
    return False

def to_hex_token_id(token_id: str) -> str:
    """Convert token ID string to hex string suitable for Alchemy filters."""
    cleaned = token_id.strip()
    if cleaned.isdigit():
        return hex(int(cleaned))
    if cleaned.startswith("0x") or cleaned.startswith("0X"):
        return hex(int(cleaned, 16))
    return cleaned

async def fetch_alchemy_nft_transfers(contract_address: str, token_id: str) -> Dict[str, Any]:
    """
    Fetch raw and normalized NFT transfer history from Alchemy Ethereum Mainnet.
    Does NOT auto-classify transfers as sales or calculate risk scores.
    """
    api_key = os.getenv("ALCHEMY_API_KEY", "").strip()
    
    clean_address = contract_address.strip()
    clean_token_id = token_id.strip()

    if not validate_ethereum_address(clean_address):
        return {
            "success": False,
            "error": f"Invalid Ethereum contract address format: '{contract_address}'",
            "code": "INVALID_CONTRACT_ADDRESS"
        }

    if not validate_token_id(clean_token_id):
        return {
            "success": False,
            "error": f"Invalid token ID format: '{token_id}'",
            "code": "INVALID_TOKEN_ID"
        }

    # Check if API key is missing or explicitly placeholder
    if not api_key or api_key in ["your_alchemy_api_key_here", "YOUR_ALCHEMY_API_KEY"]:
        return {
            "success": False,
            "error": "ALCHEMY_API_KEY is missing in backend/.env environment variables.",
            "code": "MISSING_API_KEY"
        }

    target_hex_token_id = to_hex_token_id(clean_token_id)
    cache_key = (clean_address.lower(), target_hex_token_id.lower())
    cached_entry = _transfer_cache.get(cache_key)
    if cached_entry is not None:
        cached_at, cached_result = cached_entry
        if time.monotonic() - cached_at < TRANSFER_CACHE_TTL_SECONDS:
            _transfer_cache.move_to_end(cache_key)
            return copy.deepcopy(cached_result)
        del _transfer_cache[cache_key]

    url = f"https://eth-mainnet.g.alchemy.com/v2/{api_key}"
    params = {
        "fromBlock": "0x0",
        "toBlock": "latest",
        "contractAddresses": [clean_address],
        "category": ["erc721", "erc1155"],
        "withMetadata": True,
        "excludeZeroValue": False,
        "maxCount": hex(TRANSFER_PAGE_SIZE),
        "order": "asc"
    }
    normalized_transfers = []
    raw_transfer_count = 0
    pages_scanned = 0
    history_complete = False

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            for page_number in range(1, MAX_TRANSFER_PAGES + 1):
                payload = {
                    "jsonrpc": "2.0",
                    "id": page_number,
                    "method": "alchemy_getAssetTransfers",
                    "params": [params]
                }
                response = await client.post(url, json=payload)
                print(f"[Onyx] Alchemy alchemy_getAssetTransfers HTTP {response.status_code}")

                if response.status_code in [401, 403]:
                    return {"success": False, "error": "Alchemy API request unauthorized. Check ALCHEMY_API_KEY.", "code": "UNAUTHORIZED"}
                if response.status_code == 429:
                    return {
                        "success": False,
                        "error": "Alchemy returned HTTP 429. Wait for the rate window to reset or check your Alchemy dashboard for an exhausted usage limit.",
                        "code": "RATE_LIMITED"
                    }
                if response.status_code != 200:
                    return {"success": False, "error": f"Alchemy API returned HTTP {response.status_code}.", "code": "ALCHEMY_HTTP_ERROR"}

                try:
                    rpc_response = response.json()
                except ValueError:
                    return {"success": False, "error": "Alchemy returned malformed JSON.", "code": "MALFORMED_RESPONSE"}

                if not isinstance(rpc_response, dict):
                    return {"success": False, "error": "Alchemy returned an invalid response object.", "code": "MALFORMED_RESPONSE"}
                if "error" in rpc_response:
                    rpc_error = rpc_response.get("error")
                    rpc_code = rpc_error.get("code") if isinstance(rpc_error, dict) else "unknown"
                    rpc_message = rpc_error.get("message", "") if isinstance(rpc_error, dict) else ""
                    if str(rpc_code) == "429" or any(
                        limit_term in rpc_message.lower()
                        for limit_term in ("rate limit", "quota", "credits exceeded", "capacity exceeded")
                    ):
                        return {
                            "success": False,
                            "error": "Alchemy reported a rate or usage limit. Wait for the rate window to reset or check your Alchemy dashboard usage.",
                            "code": "RATE_LIMITED"
                        }
                    return {"success": False, "error": f"Alchemy RPC request failed (code {rpc_code}).", "code": "RPC_ERROR"}

                result = rpc_response.get("result")
                if not isinstance(result, dict) or not isinstance(result.get("transfers"), list):
                    return {"success": False, "error": "Alchemy response is missing the transfers list.", "code": "MALFORMED_RESPONSE"}

                raw_transfers = result["transfers"]
                pages_scanned += 1
                raw_transfer_count += len(raw_transfers)
                if raw_transfers and pages_scanned == 1:
                    print(f"[Onyx] Alchemy first-record fields: {sorted(raw_transfers[0].keys()) if isinstance(raw_transfers[0], dict) else []}")
                print(f"[Onyx] Alchemy page {pages_scanned}: {len(raw_transfers)} raw records")

                for tx in raw_transfers:
                    if not isinstance(tx, dict):
                        return {"success": False, "error": "Alchemy returned a malformed transfer record.", "code": "MALFORMED_RESPONSE"}

                    token_ids = [tx.get("tokenId"), tx.get("erc721TokenId")]
                    erc1155_metadata = tx.get("erc1155Metadata")
                    if erc1155_metadata is not None:
                        if not isinstance(erc1155_metadata, list):
                            return {"success": False, "error": "Alchemy returned malformed ERC-1155 metadata.", "code": "MALFORMED_RESPONSE"}
                        token_ids.extend(
                            item.get("tokenId")
                            for item in erc1155_metadata
                            if isinstance(item, dict)
                        )

                    matches_token = False
                    for raw_token_id in token_ids:
                        if raw_token_id is None or not validate_token_id(str(raw_token_id)):
                            continue
                        if to_hex_token_id(str(raw_token_id)).lower() == target_hex_token_id.lower():
                            matches_token = True
                            break

                    if not matches_token:
                        continue

                    metadata = tx.get("metadata")
                    timestamp = metadata.get("blockTimestamp") if isinstance(metadata, dict) else None
                    normalized_transfers.append({
                        "tx_hash": tx.get("hash"),
                        "from": tx.get("from"),
                        "to": tx.get("to"),
                        "token_id": clean_token_id,
                        "timestamp": timestamp,
                        "value": None,
                        "category": tx.get("category"),
                        "block_num": tx.get("blockNum"),
                        "asset": tx.get("asset")
                    })

                page_key = result.get("pageKey")
                if page_key in (None, ""):
                    history_complete = True
                    break
                if not isinstance(page_key, str):
                    return {"success": False, "error": "Alchemy returned an invalid pagination cursor.", "code": "MALFORMED_RESPONSE"}
                params["pageKey"] = page_key

        print(f"[Onyx] Alchemy normalized record count: {len(normalized_transfers)}")
        if history_complete:
            note = "Complete normalized NFT transfer history retrieved from Alchemy Ethereum Mainnet. Transfer values are not sale prices."
        else:
            note = f"Partial history: scanned {pages_scanned} pages ({raw_transfer_count} collection transfers); Alchemy reported more pages. Results may omit older or newer activity. Transfer values are not sale prices."

        result = {
            "success": True,
            "contract_address": clean_address,
            "token_id": clean_token_id,
            "total_transfers_found": len(normalized_transfers),
            "raw_transfers_scanned": raw_transfer_count,
            "pages_scanned": pages_scanned,
            "history_complete": history_complete,
            "transfers": normalized_transfers,
            "note": note
        }
        _transfer_cache[cache_key] = (time.monotonic(), copy.deepcopy(result))
        _transfer_cache.move_to_end(cache_key)
        while len(_transfer_cache) > TRANSFER_CACHE_MAX_ENTRIES:
            _transfer_cache.popitem(last=False)
        return result

    except httpx.TimeoutException:
        return {
            "success": False,
            "error": "Timeout while connecting to Alchemy API.",
            "code": "TIMEOUT"
        }
    except httpx.RequestError:
        return {
            "success": False,
            "error": "Network failure while connecting to Alchemy API.",
            "code": "NETWORK_ERROR"
        }
    except Exception:
        return {
            "success": False,
            "error": "Unexpected error while processing the Alchemy response.",
            "code": "INTERNAL_ERROR"
        }
