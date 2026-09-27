import os
import json
import httpx
from typing import Dict, Any, Optional

SYSTEM_INSTRUCTION = """You are the explanation assistant for Onyx, an NFT wash-trading risk analysis application.
Your job is to explain the structured blockchain analysis provided by the Onyx detection engine.
You must only use the evidence supplied to you.
Do not invent facts, wallet addresses, hashes, or prices.
Do not calculate or modify the risk score.
Do not introduce new evidence.
Do not claim that wash trading is proven.

Use careful, objective language such as:
- 'detected'
- 'observed'
- 'consistent with'
- 'may indicate'
- 'warrants further investigation'

Return a valid JSON object matching this exact schema:
{
  "summary": "A concise 2-3 sentence overview explaining the overall risk level and score exactly as given.",
  "key_findings": [
    "Bullet points explaining the main detected signals and supporting evidence."
  ],
  "limitations": [
    "Bullet points noting important limitations of on-chain heuristic analysis."
  ]
}
"""

def generate_fallback_ai_explanation(detection_data: Dict[str, Any]) -> Dict[str, Any]:
    """Fallback plain-English summary if Gemini API key is missing or unavailable."""
    score = detection_data.get("risk_score", 0)
    level = detection_data.get("risk_level", "UNKNOWN RISK")
    signals = [s for s in detection_data.get("signals", []) if s.get("detected")]
    
    findings = []
    for sig in signals:
        evidence_summary = "; ".join(sig.get("evidence", []))
        findings.append(f"{sig.get('name')} (+{sig.get('score')} pts): Observed pattern - {evidence_summary}")
        
    if not findings:
        findings.append("No suspicious wash trading signals detected across evaluated transactions.")

    return {
        "summary": f"Onyx evaluated this NFT contract and token ID, assigning a deterministic risk score of {score}/100 ({level}). This assessment is derived strictly from on-chain transfer topology and market context.",
        "key_findings": findings,
        "limitations": [
            "On-chain heuristic patterns indicate potential wash trading risk but do not constitute legal proof or confirmed physical wallet ownership.",
            "Transfer timestamps and values are derived from public Ethereum logs and OpenSea indexers."
        ],
        "is_fallback_mode": True
    }

async def generate_gemini_explanation(detection_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Query Gemini API to convert structured detection engine evidence into 
    a plain-English summary. Never modifies score or invents evidence.
    """
    api_key = os.getenv("GEMINI_API_KEY", "").strip()

    if not api_key or api_key in ["", "YOUR_GEMINI_API_KEY", "your_gemini_api_key_here"]:
        if os.getenv("ALLOW_MOCK_FALLBACK", "true").lower() == "true":
            return generate_fallback_ai_explanation(detection_data)
        return None



    # Filter detected signals for prompt efficiency
    detected_signals = [
        {
            "name": s["name"],
            "score": s["score"],
            "max_score": s["max_score"],
            "evidence": s["evidence"]
        }
        for s in detection_data.get("signals", [])
        if s.get("detected")
    ]

    prompt_payload = {
        "risk_score": detection_data.get("risk_score"),
        "risk_level": detection_data.get("risk_level"),
        "detected_signals": detected_signals,
        "total_transfers_found": detection_data.get("total_transfers_found"),
        "market_context": detection_data.get("market_data")
    }

    request_body = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {
                        "text": f"{SYSTEM_INSTRUCTION}\n\nStructured Detection Result:\n{json.dumps(prompt_payload, indent=2)}"
                    }
                ]
            }
        ],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.2
        }
    }

    # Models to try in order of preference (handles 503 overload by trying alternatives)
    models = ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.8-flash"]
    base_url = "https://generativelanguage.googleapis.com/v1beta/models"

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            last_error = None
            for model in models:
                url = f"{base_url}/{model}:generateContent?key={api_key}"
                try:
                    response = await client.post(url, json=request_body)

                    if response.status_code == 200:
                        res_json = response.json()
                        candidates = res_json.get("candidates", [])
                        if not candidates:
                            print(f"[Onyx] {model}: returned no candidates.")
                            continue

                        text_content = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                        if not text_content:
                            print(f"[Onyx] {model}: returned empty text.")
                            continue

                        parsed_explanation = json.loads(text_content)
                        parsed_explanation["is_fallback_mode"] = False
                        print(f"[Onyx] Gemini explanation generated successfully via {model}.")
                        return parsed_explanation

                    elif response.status_code in [503, 429]:
                        print(f"[Onyx] {model}: HTTP {response.status_code} (overloaded/rate-limited), trying next model...")
                        last_error = f"{model} returned HTTP {response.status_code}"
                        continue
                    else:
                        print(f"[Onyx] {model}: HTTP {response.status_code}: {response.text[:150]}")
                        last_error = f"{model} returned HTTP {response.status_code}"
                        continue

                except Exception as model_err:
                    print(f"[Onyx] {model}: exception {type(model_err).__name__}: {model_err}")
                    last_error = str(model_err)
                    continue

            # All models exhausted
            print(f"[Onyx] All Gemini models exhausted. Last error: {last_error}")
            if os.getenv("ALLOW_MOCK_FALLBACK", "true").lower() == "true":
                return generate_fallback_ai_explanation(detection_data)
            return None

    except Exception as e:
        # Gracefully handle network / parsing / timeout errors without breaking API response
        print(f"[Onyx] Gemini API exception: {type(e).__name__}: {e}")
        if os.getenv("ALLOW_MOCK_FALLBACK", "true").lower() == "true":
            return generate_fallback_ai_explanation(detection_data)
        return None
