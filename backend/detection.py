from typing import List, Dict, Any, Tuple, Optional
from datetime import datetime

ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"


def parse_iso_timestamp(ts_str: str) -> Optional[datetime]:
    """Parse ISO timestamp strings into datetime objects for time delta calculations."""
    if not ts_str:
        return None
    try:
        cleaned = ts_str.replace("Z", "+00:00")
        return datetime.fromisoformat(cleaned)
    except Exception:
        return None


def _empty_result() -> Dict[str, Any]:
    empty_signal_defs = [
        ("Repeated Trading", 25, "Insufficient transfer history to analyze."),
        ("Circular Trading", 20, "Insufficient transfer history to analyze."),
        ("Shared Funding", 15, "No shared funding patterns identified in current dataset."),
        ("Rapid Trading", 10, "Insufficient transfer history to analyze."),
        ("Price / Value Anomaly", 15, "No price anomalies identified in current dataset."),
        ("Wallet Behavior", 10, "Insufficient wallet interaction history."),
        ("Funding / Gas Relationship", 5, "No gas funding anomalies detected."),
    ]
    return {
        "risk_score": 0,
        "risk_level": "LOW WASH-TRADING RISK",
        "signals": [
            {"name": name, "score": 0, "max_score": max_score, "detected": False, "evidence": [ev]}
            for name, max_score, ev in empty_signal_defs
        ],
        "disclaimer": (
            "This score represents wash-trading risk indicators based on on-chain patterns "
            "and does not constitute proof of illegal activity or confirmed wallet ownership."
        ),
    }


def analyze_wash_trading(
    transfers: List[Dict[str, Any]],
    opensea_market_data: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Deterministic 0-100 Wash Trading Detection Engine.
    Analyzes normalized transfer activity and OpenSea market context for 7 explainable signals.

    NOTE ON SCOPE: this analyzes the transfer history of a SINGLE NFT (one contract + token ID).
    "Circular Trading" here means the token returned to a wallet that previously held it
    (e.g. A -> B -> A), not a multi-wallet, multi-asset graph cycle across a whole collection.
    """
    if not transfers:
        return _empty_result()

    # Sort transfers by timestamp (falling back to original order when timestamps are
    # missing or unparsable) so the same input always produces the same evidence ordering,
    # regardless of what order the upstream API returned records in.
    def _sort_key(indexed_tx: Tuple[int, Dict[str, Any]]) -> Tuple[float, int]:
        idx, tx = indexed_tx
        ts = parse_iso_timestamp(tx.get("timestamp"))
        return (ts.timestamp() if ts else float("inf"), idx)

    transfers = [tx for _, tx in sorted(enumerate(transfers), key=_sort_key)]

    # Sample-size scaling: a pattern seen on a token with very few transfers is weaker
    # evidence than the same pattern seen across many transfers. Signals that fire on
    # thin history are scaled down rather than excluded outright, so evidence is still
    # shown but doesn't dominate the score.
    transfer_count = len(transfers)
    if transfer_count < 3:
        thin_history_factor = 0.5
    else:
        thin_history_factor = 1.0

    # ---- Signal 1: Repeated Trading (Max: 25 points) ----
    repeated_score = 0
    repeated_evidence = []
    pair_counts: Dict[Tuple[str, str], int] = {}

    for tx in transfers:
        from_addr = (tx.get("from") or "").lower()
        to_addr = (tx.get("to") or "").lower()
        if not from_addr or not to_addr:
            continue
        if from_addr == ZERO_ADDRESS or from_addr == to_addr:
            continue
        pair = tuple(sorted([from_addr, to_addr]))
        pair_counts[pair] = pair_counts.get(pair, 0) + 1

    suspicious_pairs = {p: count for p, count in pair_counts.items() if count >= 2}
    if suspicious_pairs:
        max_interactions = max(suspicious_pairs.values())
        base = 25 if max_interactions >= 3 else 15
        repeated_score = round(base * thin_history_factor)
        for (w1, w2), count in suspicious_pairs.items():
            repeated_evidence.append(
                f"Wallets {w1[:8]}... and {w2[:8]}... traded this NFT back and forth {count} times."
            )

    # ---- Signal 2: Circular Trading (Max: 20 points) ----
    # Real cycle detection over the chronological ownership path. `path` is the walk of
    # wallets as the token changed hands, in order. A cycle fires when the token returns
    # to a wallet already present in the CURRENT path; we report the tightest loop by
    # searching from the most recent occurrence backward (not the first), so a sequence
    # of repeated back-and-forth trades (A->B->A->B->A...) reports each loop correctly
    # instead of degenerating into a stale/incorrect segment after the first cycle.
    circular_score = 0
    circular_evidence = []
    path: List[str] = []
    cycle_detected = False

    for tx in transfers:
        from_addr = (tx.get("from") or "").lower()
        to_addr = (tx.get("to") or "").lower()
        if not from_addr or not to_addr or from_addr == to_addr:
            continue
        if from_addr == ZERO_ADDRESS:
            continue  # mint event; establishes first holder, not part of a resale loop

        if not path:
            path.append(from_addr)

        if to_addr in path:
            cycle_detected = True
            # find the most recent (last) occurrence of to_addr in the path so far
            last_idx = len(path) - 1 - path[::-1].index(to_addr)
            loop_wallets = path[last_idx:] + [to_addr]
            short_cycle = " -> ".join(w[:8] + "..." for w in loop_wallets)
            circular_evidence.append(f"Circular ownership path identified: {short_cycle}")

        path.append(to_addr)

    if cycle_detected:
        circular_score = round(20 * thin_history_factor)

    # ---- Signal 3: Shared Funding (Max: 15 points) ----
    shared_funding_score = 0
    shared_funding_evidence = []
    funding_sources: Dict[str, List[str]] = {}
    for tx in transfers:
        from_addr = (tx.get("from") or "").lower()
        to_addr = (tx.get("to") or "").lower()
        funding_source = tx.get("funding_source") or tx.get("from_funding_source")
        if not funding_source:
            continue
        wallets = funding_sources.setdefault(funding_source, [])
        for addr in (from_addr, to_addr):
            if addr and addr not in wallets:
                wallets.append(addr)

    for source, wallets in funding_sources.items():
        if len(wallets) >= 2:
            shared_funding_score = round(15 * thin_history_factor)
            shared_funding_evidence.append(
                f"Wallets {', '.join(w[:8] + '...' for w in wallets)} received funding from "
                f"source {source[:8]}..., indicating a shared funding relationship."
            )

    if not shared_funding_evidence:
        shared_funding_evidence.append("No shared funding source identified in available transfer data.")

    # ---- Signal 4: Rapid Trading (Max: 10 points) ----
    rapid_score = 0
    rapid_evidence = []
    timestamps = []
    for tx in transfers:
        ts = parse_iso_timestamp(tx.get("timestamp"))
        if ts:
            timestamps.append((ts, tx.get("tx_hash", "")))

    timestamps.sort(key=lambda x: x[0])
    rapid_intervals = []
    for i in range(1, len(timestamps)):
        t_prev, h_prev = timestamps[i - 1]
        t_curr, h_curr = timestamps[i]
        diff_hours = (t_curr - t_prev).total_seconds() / 3600.0
        if diff_hours < 24.0:
            rapid_intervals.append((diff_hours, h_prev, h_curr))

    if rapid_intervals:
        min_diff = min(item[0] for item in rapid_intervals)
        base = 10 if min_diff < 6.0 else 5
        rapid_score = round(base * thin_history_factor)
        for diff_h, h1, h2 in rapid_intervals[:3]:
            if diff_h < 1.0:
                mins = int(diff_h * 60)
                rapid_evidence.append(
                    f"Rapid transfer occurred within {mins} minutes between Tx {h1[:8]}... and Tx {h2[:8]}..."
                )
            else:
                rapid_evidence.append(
                    f"Rapid transfer occurred within {diff_h:.1f} hours between Tx {h1[:8]}... and Tx {h2[:8]}..."
                )

    # ---- Signal 5: Price / Value Anomaly (Max: 15 points) ----
    price_score = 0
    price_evidence = []
    values = [tx.get("value") for tx in transfers if tx.get("value") is not None and tx.get("value") > 0]

    if len(values) >= 2:
        max_val = max(values)
        min_val = min(values)
        if min_val > 0 and (max_val / min_val) >= 2.5:
            price_score = round(15 * thin_history_factor)
            price_evidence.append(
                f"Price anomaly detected: Maximum transfer value ({max_val} ETH) is "
                f"{max_val / min_val:.1f}x the minimum non-zero value ({min_val} ETH)."
            )
        elif len(values) != len(set(values)) and len(values) >= 3:
            price_score = round(10 * thin_history_factor)
            price_evidence.append(
                f"Repeated exact transfer value of {values[0]} ETH detected across multiple transfers."
            )

    if opensea_market_data and opensea_market_data.get("is_available"):
        floor = opensea_market_data.get("floor_price")
        if floor and values:
            max_val = max(values)
            if max_val > (floor * 2.5):
                price_evidence.append(
                    f"OpenSea Market Context: Transfer value ({max_val} ETH) is significantly "
                    f"higher than collection floor price ({floor} ETH)."
                )

    if not price_evidence:
        price_evidence.append("No price anomalies or extreme price jumps detected in available transfer value data.")

    # ---- Signal 6: Wallet Behavior (Max: 10 points) ----
    wallet_score = 0
    wallet_evidence = []
    wallet_frequency: Dict[str, int] = {}
    for tx in transfers:
        f = (tx.get("from") or "").lower()
        t = (tx.get("to") or "").lower()
        if f and f != ZERO_ADDRESS:
            wallet_frequency[f] = wallet_frequency.get(f, 0) + 1
        if t:
            wallet_frequency[t] = wallet_frequency.get(t, 0) + 1

    high_freq_wallets = {w: count for w, count in wallet_frequency.items() if count >= 3}
    if high_freq_wallets:
        wallet_score = round(10 * thin_history_factor)
        for w, count in high_freq_wallets.items():
            wallet_evidence.append(f"Wallet {w[:8]}... repeatedly bought/sold this single NFT asset {count} times.")

    if not wallet_evidence:
        wallet_evidence.append("Wallet participation frequency remains within normal bounds.")

    # ---- Signal 7: Funding / Gas Relationship (Max: 5 points) ----
    gas_score = 0
    gas_evidence = []
    for tx in transfers:
        if tx.get("is_zero_day_funded"):
            gas_score = round(5 * thin_history_factor)
            gas_evidence.append(f"Wallet {(tx.get('to') or '')[:8]}... received gas funding immediately prior to transfer.")

    if not gas_evidence:
        gas_evidence.append("No zero-day gas funding relationships detected.")

    raw_total_score = (
        repeated_score
        + circular_score
        + shared_funding_score
        + rapid_score
        + price_score
        + wallet_score
        + gas_score
    )
    final_score = min(100, max(0, raw_total_score))

    if final_score >= 60:
        risk_level = "HIGH WASH-TRADING RISK"
    elif final_score >= 30:
        risk_level = "SUSPICIOUS ACTIVITY"
    else:
        risk_level = "LOW WASH-TRADING RISK"

    signals = [
        {
            "name": "Repeated Trading",
            "score": repeated_score,
            "max_score": 25,
            "detected": repeated_score > 0,
            "evidence": repeated_evidence or ["No repeated trading between identical wallet pairs detected."],
        },
        {
            "name": "Circular Trading",
            "score": circular_score,
            "max_score": 20,
            "detected": circular_score > 0,
            "evidence": circular_evidence or ["No circular ownership loops detected."],
        },
        {
            "name": "Shared Funding",
            "score": shared_funding_score,
            "max_score": 15,
            "detected": shared_funding_score > 0,
            "evidence": shared_funding_evidence,
        },
        {
            "name": "Rapid Trading",
            "score": rapid_score,
            "max_score": 10,
            "detected": rapid_score > 0,
            "evidence": rapid_evidence or ["Transfers occurred across normal time intervals."],
        },
        {
            "name": "Price / Value Anomaly",
            "score": price_score,
            "max_score": 15,
            "detected": price_score > 0,
            "evidence": price_evidence,
        },
        {
            "name": "Wallet Behavior",
            "score": wallet_score,
            "max_score": 10,
            "detected": wallet_score > 0,
            "evidence": wallet_evidence,
        },
        {
            "name": "Funding / Gas Relationship",
            "score": gas_score,
            "max_score": 5,
            "detected": gas_score > 0,
            "evidence": gas_evidence,
        },
    ]

    return {
        "risk_score": final_score,
        "risk_level": risk_level,
        "signals": signals,
        "sample_size_note": (
            f"Analysis based on {transfer_count} transfer(s). Signals detected on fewer than 3 "
            "transfers are scaled down, as thin history provides weaker evidence."
            if transfer_count < 3
            else f"Analysis based on {transfer_count} transfers."
        ),
        "disclaimer": (
            "This score represents wash-trading risk indicators based on on-chain patterns "
            "and does not constitute proof of illegal activity or confirmed wallet ownership. "
            "'Circular Trading' reflects repeat-ownership within this single token's transfer "
            "history, not a multi-asset wallet graph cycle."
        ),
    }