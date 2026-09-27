import React, { useState, useEffect } from 'react';
import WalletGraph from './components/WalletGraph';
import marketOrbit from './assets/market-orbit.svg';
import networkGrid from './assets/network-grid.svg';
import ethereumMark from './assets/ethereum-mark.svg';
import signalPulse from './assets/signal-pulse.svg';
import spikeGraph from './assets/spike-graph.svg';
import bitcoinOrbit from './assets/bitcoin-orbit.svg';
import marketRadar from './assets/market-radar.svg';
import walletCycle from './assets/wallet-cycle.svg';
import riskScanner from './assets/risk-scanner.svg';
import tokenTrace from './assets/token-trace.svg';
import transactionBeacon from './assets/transaction-beacon.svg';
import riskConstellation from './assets/risk-constellation.svg';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const LOADING_STEPS = [
  'Collecting blockchain activity (Alchemy)...',
  'Analyzing wallet relationships & cycles...',
  'Checking market context & floor price (OpenSea)...',
  'Generating AI risk explanation...',
  'Finalizing analysis...',
];

export default function App() {
  const [contractAddress, setContractAddress] = useState('');
  const [tokenId, setTokenId] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStepIdx, setLoadingStepIdx] = useState(0);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);
  const [isResultsPage, setIsResultsPage] = useState(false);

  useEffect(() => {
    let interval;
    if (loading) {
      setLoadingStepIdx(0);
      interval = setInterval(() => {
        setLoadingStepIdx((prev) => (prev + 1) % LOADING_STEPS.length);
      }, 700);
    } else {
      setLoadingStepIdx(0);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const handlePreset = (address, id) => {
    setContractAddress(address);
    setTokenId(id);
    setError(null);
  };

  const handleStartNewAnalysis = () => {
    setContractAddress('');
    setTokenId('');
    setResults(null);
    setError(null);
    setIsResultsPage(false);
  };

  const handleAnalyze = async (e) => {
    e?.preventDefault();
    
    setError(null);
    setResults(null);

    const trimmedAddress = contractAddress.trim();
    const trimmedTokenId = tokenId.trim();

    if (!trimmedAddress || !trimmedTokenId) {
      if (!trimmedAddress && !trimmedTokenId) {
        setError('Please enter an NFT Contract Address and Token ID.');
      } else if (!trimmedAddress) {
        setError('NFT Contract Address is required.');
      } else {
        setError('Token ID is required.');
      }
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contract_address: trimmedAddress,
          token_id: trimmedTokenId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errorMsg = errorData?.detail || `Backend error (${response.status})`;
        throw new Error(errorMsg);
      }

      const data = await response.json();
      setResults(data);
      setIsResultsPage(true);
    } catch (err) {
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        setError(
          `Unable to connect to Onyx backend at ${API_BASE_URL}. Please ensure the backend server is running.`
        );
      } else {
        setError(err.message || 'An unexpected error occurred during analysis.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <div className="corner-visuals" aria-hidden="true">
        <img className="corner-visual corner-visual-radar" src={marketRadar} alt="" />
        <img className="corner-visual corner-visual-market" src={marketOrbit} alt="" />
        <img className="corner-visual corner-visual-network" src={networkGrid} alt="" />
        <img className="corner-visual corner-visual-wallet" src={walletCycle} alt="" />
        <img className="corner-visual corner-visual-risk" src={riskScanner} alt="" />
        <img className="corner-visual corner-visual-trace" src={tokenTrace} alt="" />
        <img className="corner-visual corner-visual-constellation" src={riskConstellation} alt="" />
        <div className="market-decor market-decor-chart">
          <span className="decor-label">WALLET SIGNAL BEACON</span>
          <img src={transactionBeacon} alt="" />
          <span className="decor-value">4 LINKED NODES</span>
        </div>
        <div className="market-decor market-decor-coin">
          <img src={bitcoinOrbit} alt="" />
          <span>MARKET PULSE</span>
        </div>
      </div>

      {!isResultsPage && (
        <>
      {/* Header */}
      <header className="header">
        <div className="header-badge header-badge-spacer" aria-hidden="true"></div>
        <h1 className="header-title">ONYX</h1>
        <p className="header-subtitle">NFT Wash-Trading Risk Analyzer</p>
      </header>

      <section className="intel-strip" aria-label="Onyx intelligence overview">
        <div className="intel-copy">
          <span className="intel-kicker">ON-CHAIN MARKET INTELLIGENCE</span>
          <h2>Read the signal behind the sale.</h2>
          <p>Connect wallet behavior, token movement, and market pressure in one focused inspection.</p>
        </div>
        <div className="intel-metrics">
          <div className="intel-metric">
            <img src={ethereumMark} alt="" />
            <span><strong>Ethereum</strong><small>Network layer</small></span>
          </div>
          <div className="intel-metric">
            <img src={signalPulse} alt="" />
            <span><strong>7 signals</strong><small>Risk indicators</small></span>
          </div>
          <div className="intel-metric intel-metric-score">
            <span className="metric-number">0-100</span>
            <span><strong>Risk score</strong><small>Explainable output</small></span>
          </div>
        </div>
      </section>

      <div className="quote-lockup">
        <span className="quote-mark">“</span>
        <p>Every sale leaves a signal. <em>Find the pattern before it finds you.</em><span className="quote-mark quote-mark-inline">”</span></p>
      </div>

      {/* Input Card */}
      <div className="card">
        <div className="inspection-layout">
          <div className="inspection-form">
            <div className="card-title">
              <span>NFT Inspection Parameters</span>
            </div>

            <form onSubmit={handleAnalyze}>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label" htmlFor="contract-address">
                    NFT Contract Address
                  </label>
                  <div className="input-wrapper">
                    <input
                      id="contract-address"
                      type="text"
                      className="form-input"
                      placeholder="e.g. 0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D"
                      value={contractAddress}
                      onChange={(e) => setContractAddress(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="token-id">
                    Token ID
                  </label>
                  <div className="input-wrapper">
                    <input
                      id="token-id"
                      type="text"
                      className="form-input"
                      placeholder="e.g. 1"
                      value={tokenId}
                      onChange={(e) => setTokenId(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                </div>
              </div>

              {/* Quick Fill Presets */}
              <div className="preset-section">
                <span className="preset-label">Quick Test Presets:</span>
                <button
                  type="button"
                  className="preset-btn"
                  onClick={() =>
                    handlePreset('0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D', '1')
                  }
                >
                  BAYC #1 (High Wash Pattern)
                </button>
                <button
                  type="button"
                  className="preset-btn"
                  onClick={() =>
                    handlePreset('0xED5AF3B7828476C17F56A6376557565402756193', '8888')
                  }
                >
                  AZUKI #8888
                </button>
              </div>

              {/* Analyze Button */}
              <button
                type="submit"
                className="btn-analyze"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="spinner"></div>
                    <span>{LOADING_STEPS[loadingStepIdx]}</span>
                  </>
                ) : (
                  <span>ANALYZE NFT</span>
                )}
              </button>
            </form>

            {/* User-friendly Error Display */}
            {error && (
              <div className="error-banner">
                <span className="error-icon">⚠️</span>
                <span>{error}</span>
              </div>
            )}
          </div>
          <aside className="inspection-signal" aria-label="Example transaction spike graph">
            <div className="signal-panel-topline">
              <span>MARKET SIGNAL</span>
              <span className="signal-live"><i></i> LIVE</span>
            </div>
            <div className="signal-panel-title">Transaction pressure</div>
            <img src={spikeGraph} alt="Example transaction pressure spike graph" />
            <div className="signal-panel-footer">
              <span>WALLET ACTIVITY</span>
              <strong>+24.8%</strong>
            </div>
          </aside>
        </div>
      </div>
        </>
      )}

      {/* Results Area */}
      {isResultsPage && results && results.risk_score !== undefined && (
        <>
        <div className="results-page-header">
          <button type="button" className="results-back-btn" onClick={handleStartNewAnalysis}>
            ← Back to analyzer
          </button>
          <span>Inspection complete</span>
        </div>
        <div className="card results-area">
          <div className="card-title">
            <span>Wash-Trading Analysis Results</span>
            <span className="badge-dev" style={{ background: 'rgba(26, 138, 107, 0.1)', color: '#1a8a6b', borderColor: 'rgba(26, 138, 107, 0.35)' }}>
              Deterministic Engine v1.0
            </span>
          </div>

          {/* Top Score Banner */}
          <div className="results-grid">
            <div className="stat-box" style={{ borderColor: getRiskColor(results.risk_level) }}>
              <div className="stat-label">Wash-Trading Risk Score</div>
              <div className="score-display">
                <span className="score-num" style={{ color: getRiskColor(results.risk_level) }}>
                  {results.risk_score}
                </span>
                <span className="score-total">/ 100</span>
              </div>
            </div>

            <div className="stat-box" style={{ borderColor: getRiskColor(results.risk_level) }}>
              <div className="stat-label">Risk Level</div>
              <div className="stat-value" style={{ color: getRiskColor(results.risk_level), fontSize: '1.2rem' }}>
                {results.risk_level}
              </div>
            </div>

            <div className="stat-box">
              <div className="stat-label">Transfers Analyzed</div>
              <div className="stat-value" style={{ color: '#1a8a6b' }}>
                {results.total_transfers_found ?? 0}
              </div>
            </div>
          </div>

          {(results.history_complete === false || results.total_transfers_found === 0) && (
            <div
              role="status"
              style={{
                marginBottom: '1.25rem',
                padding: '0.75rem 1rem',
                border: '1px solid rgba(234, 179, 8, 0.45)',
                borderRadius: '6px',
                color: '#854d0e',
                background: 'rgba(234, 179, 8, 0.08)',
                fontSize: '0.85rem',
                lineHeight: '1.5'
              }}
            >
              {results.note || (results.history_complete === false
                ? 'Blockchain history is incomplete; this score uses only the transfers retrieved so far.'
                : 'No NFT transfer activity was found for this token.')}
            </div>
          )}

          {/* AI Explanation Layer */}
          <div
            className="placeholder-section"
            style={{
              marginBottom: '1.5rem',
              borderColor: 'rgba(192, 132, 252, 0.5)',
              background: 'linear-gradient(135deg, rgba(147, 51, 234, 0.08) 0%, rgba(6, 182, 212, 0.05) 100%)',
              boxShadow: '0 10px 25px -10px rgba(192, 132, 252, 0.2)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <div className="placeholder-title" style={{ color: '#d8b4fe', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem', fontWeight: '800' }}>
                <span>✨</span> AI Risk Explanation
              </div>
              <span style={{ fontSize: '0.75rem', color: '#c084fc', background: 'rgba(192, 132, 252, 0.15)', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontWeight: '600' }}>
                Non-Authoritative Interpretation
              </span>
            </div>

            {results.ai_explanation ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ background: 'rgba(15, 23, 42, 0.6)', borderRadius: '8px', padding: '0.85rem 1rem', borderLeft: '3px solid #c084fc' }}>
                  <div style={{ fontSize: '0.75rem', color: '#c084fc', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                    Executive Summary
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#f8fafc', lineHeight: '1.5' }}>
                    {results.ai_explanation.summary}
                  </div>
                </div>

                {results.ai_explanation.key_findings?.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.8rem', color: '#111827', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                      Key Findings
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#1f2937', fontSize: '0.85rem', lineHeight: '1.5' }}>
                      {results.ai_explanation.key_findings.map((item, idx) => (
                        <li key={idx} style={{ marginBottom: '0.3rem' }}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {results.ai_explanation.limitations?.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.8rem', color: '#111827', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                      Limitations & Disclaimers
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#1f2937', fontSize: '0.85rem', lineHeight: '1.5' }}>
                      {results.ai_explanation.limitations.map((item, idx) => (
                        <li key={idx} style={{ marginBottom: '0.3rem' }}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="placeholder-text" style={{ color: '#94a3b8' }}>
                AI explanation is currently unavailable. (Deterministic risk score and raw signals remain fully operational above).
              </div>
            )}
          </div>

          {/* Etherscan Verification Links Section */}
          <div className="placeholder-section" style={{ marginBottom: '1.25rem', borderColor: 'rgba(16, 185, 129, 0.4)', background: 'rgba(16, 185, 129, 0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div className="placeholder-title" style={{ color: '#10b981', margin: 0 }}>Etherscan Verification Links</div>
              <span style={{ fontSize: '0.75rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.15)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: '600' }}>
                On-Chain Verification Active
              </span>
            </div>

            {results.etherscan_links && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                <a
                  href={results.etherscan_links.contract_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="preset-btn"
                  style={{ color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.4)', background: 'rgba(16, 185, 129, 0.1)', padding: '0.4rem 0.75rem' }}
                >
                  🔗 View Contract on Etherscan
                </a>
                <a
                  href={results.etherscan_links.token_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="preset-btn"
                  style={{ color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.4)', background: 'rgba(16, 185, 129, 0.1)', padding: '0.4rem 0.75rem' }}
                >
                  🔗 View Token #{results.token_id} on Etherscan
                </a>
              </div>
            )}
          </div>

          {/* OpenSea Market Data Section */}
          <div className="placeholder-section" style={{ marginBottom: '1.25rem', borderColor: 'rgba(26, 138, 107, 0.35)', background: 'rgba(26, 138, 107, 0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div className="placeholder-title" style={{ color: '#1a8a6b', margin: 0 }}>OpenSea Market Context</div>
              {results.market_data?.is_available ? (
                <span style={{ fontSize: '0.75rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: '600' }}>
                  Market Context Active
                </span>
              ) : (
                <span style={{ fontSize: '0.75rem', color: '#8a9baa', background: 'rgba(138, 155, 170, 0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                  Market data unavailable
                </span>
              )}
            </div>

            {results.market_data?.is_available ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginTop: '0.5rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#5a6b7a', textTransform: 'uppercase' }}>Collection</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: '700', color: '#1a2332' }}>
                    {results.market_data.collection?.name || 'Unknown'}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.75rem', color: '#5a6b7a', textTransform: 'uppercase' }}>Floor Price</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: '700', color: '#1a8a6b' }}>
                    {results.market_data.floor_price !== null && results.market_data.floor_price !== undefined
                      ? `${results.market_data.floor_price} ${results.market_data.currency || 'ETH'}`
                      : 'N/A'}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.75rem', color: '#5a6b7a', textTransform: 'uppercase' }}>Recorded Sales</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: '700', color: '#10b981' }}>
                    {results.market_data.sales?.length ?? 0} Sales
                  </div>
                </div>
              </div>
            ) : (
              <div className="placeholder-text" style={{ color: '#5a6b7a' }}>
                OpenSea market context is currently unavailable or unconfigured. (Analysis continues using Alchemy on-chain transfer data).
              </div>
            )}
          </div>

          {/* Interactive Wallet Network Graph */}
          <div className="placeholder-section" style={{ marginBottom: '1.25rem', borderColor: 'rgba(26, 138, 107, 0.35)', background: 'rgba(26, 138, 107, 0.03)' }}>
            <div className="placeholder-title" style={{ color: '#1a8a6b', marginBottom: '0.25rem' }}>
              Interactive Wallet Transaction Graph
            </div>
            <div className="placeholder-text" style={{ color: '#5a6b7a', marginBottom: '0.75rem', fontSize: '0.8rem' }}>
              Visualizing wallet interactions, directed transfer paths, circular trading loops, and transaction values.
            </div>

            <WalletGraph 
              transfers={results.normalized_transfers} 
              signals={results.signals} 
            />
          </div>

          {/* Disclaimer Banner */}
          {results.disclaimer && (
            <div className="placeholder-section" style={{ marginBottom: '1.25rem', borderColor: 'rgba(245, 158, 11, 0.3)', background: 'rgba(245, 158, 11, 0.05)' }}>
              <div className="placeholder-title" style={{ color: '#d97706' }}>Legal & Heuristic Notice</div>
              <div className="placeholder-text" style={{ color: '#1a2332' }}>{results.disclaimer}</div>
            </div>
          )}

          {/* Detected Signals Section */}
          <div className="placeholder-section" style={{ marginBottom: '1.5rem' }}>
            <div className="placeholder-title" style={{ marginBottom: '1rem', fontSize: '0.95rem' }}>
              Detected Signals Breakdown
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {results.signals?.map((sig, idx) => (
                <div 
                  key={idx} 
                  style={{ 
                    background: sig.detected ? 'rgba(239, 68, 68, 0.06)' : 'rgba(244, 248, 246, 0.7)',
                    border: `1px solid ${sig.detected ? 'rgba(239, 68, 68, 0.3)' : 'rgba(200, 215, 210, 0.5)'}`,
                    borderRadius: '10px',
                    padding: '0.9rem 1.1rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <span style={{ fontWeight: '700', color: sig.detected ? '#dc2626' : '#5a6b7a', fontSize: '0.95rem' }}>
                      {sig.detected ? '🚨' : '⚪'} {sig.name}
                    </span>
                    <span style={{ 
                      fontSize: '0.8rem', 
                      fontFamily: 'var(--font-mono)',
                      fontWeight: '700',
                      color: sig.detected ? '#ef4444' : '#8a9baa',
                      background: sig.detected ? 'rgba(239, 68, 68, 0.1)' : 'rgba(200, 215, 210, 0.4)',
                      padding: '0.2rem 0.6rem',
                      borderRadius: '6px'
                    }}>
                      {sig.score} / {sig.max_score} pts
                    </span>
                  </div>

                  <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#374151', fontSize: '0.85rem' }}>
                    {sig.evidence?.map((ev, evIdx) => (
                      <li key={evIdx} style={{ marginBottom: '0.2rem' }}>{ev}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* Normalized Transfer Activity Table */}
          <div className="placeholder-section">
            <div className="placeholder-title" style={{ marginBottom: '0.75rem' }}>Raw Blockchain Transfer Evidence</div>
            {results.normalized_transfers && results.normalized_transfers.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '0.5rem' }}>Tx Hash</th>
                      <th style={{ padding: '0.5rem' }}>From Address</th>
                      <th style={{ padding: '0.5rem' }}>To Address</th>
                      <th style={{ padding: '0.5rem' }}>Timestamp</th>
                      <th style={{ padding: '0.5rem' }}>Value</th>
                      <th style={{ padding: '0.5rem' }}>Verification</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.normalized_transfers.map((tx, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(200, 215, 210, 0.4)' }}>
                        <td style={{ padding: '0.5rem', color: '#1a8a6b' }}>
                          {tx.tx_hash ? `${tx.tx_hash.slice(0, 10)}...${tx.tx_hash.slice(-6)}` : 'N/A'}
                        </td>
                        <td style={{ padding: '0.5rem', color: '#5a6b7a' }}>
                          {tx.from ? `${tx.from.slice(0, 6)}...${tx.from.slice(-4)}` : 'N/A'}
                        </td>
                        <td style={{ padding: '0.5rem', color: '#5a6b7a' }}>
                          {tx.to ? `${tx.to.slice(0, 6)}...${tx.to.slice(-4)}` : 'N/A'}
                        </td>
                        <td style={{ padding: '0.5rem', color: '#1a2332' }}>
                          {tx.timestamp ? new Date(tx.timestamp).toLocaleString() : 'N/A'}
                        </td>
                        <td style={{ padding: '0.5rem', color: '#10b981', fontWeight: 'bold' }}>
                          {tx.value !== null && tx.value !== undefined ? `${tx.value} ETH` : 'Transfer (0 ETH)'}
                        </td>
                        <td style={{ padding: '0.5rem' }}>
                          {tx.tx_hash && (
                            <a
                              href={`https://etherscan.io/tx/${tx.tx_hash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: '#10b981', textDecoration: 'none', fontSize: '0.75rem' }}
                            >
                              Verify ↗
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="placeholder-text">No transfer activity recorded for this token.</div>
            )}
          </div>
        </div>
        <div className="results-bottom-action">
          <button type="button" className="results-new-btn" onClick={handleStartNewAnalysis}>
            Check another NFT
          </button>
        </div>
        </>
      )}

      {/* Footer */}
      <footer className="footer">
        Onyx — NFT Wash-Trading Risk Analyzer
      </footer>
    </div>
  );
}

function getRiskColor(level) {
  switch (level?.toUpperCase()) {
    case 'LOW WASH-TRADING RISK': return '#10b981';
    case 'SUSPICIOUS ACTIVITY': return '#f59e0b';
    case 'HIGH WASH-TRADING RISK': return '#ef4444';
    default: return '#94a3b8';
  }
}
