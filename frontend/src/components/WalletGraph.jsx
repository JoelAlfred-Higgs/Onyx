import React, { useState, useMemo } from 'react';

export default function WalletGraph({ transfers = [], signals = [] }) {
  const [selectedNode, setSelectedNode] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [hoveredEdge, setHoveredEdge] = useState(null);

  // Extract unique nodes and directed edges from transfers
  const graphData = useMemo(() => {
    if (!transfers || transfers.length === 0) return { nodes: [], edges: [] };

    // Limit to most relevant transfers (top 12 max to keep graph clean and readable)
    const activeTransfers = transfers.slice(0, 12);

    const nodeMap = new Map();
    const edgeList = [];

    // Identify wallets involved in circular trades for visual highlighting
    const circularSignal = signals.find((s) => s.name === 'Circular Trading' && s.detected);
    const circularWallets = new Set();
    if (circularSignal) {
      activeTransfers.forEach((tx) => {
        if (tx.from) circularWallets.add(tx.from.toLowerCase());
        if (tx.to) circularWallets.add(tx.to.toLowerCase());
      });
    }

    activeTransfers.forEach((tx, idx) => {
      const fromAddr = (tx.from || '0x0000000000000000000000000000000000000000').toLowerCase();
      const toAddr = (tx.to || '0x0000000000000000000000000000000000000000').toLowerCase();

      if (!nodeMap.has(fromAddr)) {
        nodeMap.set(fromAddr, {
          id: fromAddr,
          label: fromAddr === '0x0000000000000000000000000000000000000000' ? 'Mint (Null)' : `${fromAddr.slice(0, 6)}...${fromAddr.slice(-4)}`,
          isMint: fromAddr === '0x0000000000000000000000000000000000000000',
          isCircular: circularWallets.has(fromAddr) && fromAddr !== '0x0000000000000000000000000000000000000000',
          txCount: 0,
        });
      }
      if (!nodeMap.has(toAddr)) {
        nodeMap.set(toAddr, {
          id: toAddr,
          label: toAddr === '0x0000000000000000000000000000000000000000' ? 'Mint (Null)' : `${toAddr.slice(0, 6)}...${toAddr.slice(-4)}`,
          isMint: toAddr === '0x0000000000000000000000000000000000000000',
          isCircular: circularWallets.has(toAddr) && toAddr !== '0x0000000000000000000000000000000000000000',
          txCount: 0,
        });
      }

      nodeMap.get(fromAddr).txCount += 1;
      nodeMap.get(toAddr).txCount += 1;

      edgeList.push({
        id: `edge-${idx}`,
        source: fromAddr,
        target: toAddr,
        hash: tx.tx_hash || 'N/A',
        value: tx.value,
        timestamp: tx.timestamp,
        asset: tx.asset || 'NFT',
      });
    });

    const nodes = Array.from(nodeMap.values());
    const count = nodes.length;

    nodes.forEach((node, index) => {
      node.displayLabel = node.isMint ? 'Mint' : `Wallet ${index + 1}`;
    });

    // Arrange wallets in a two-row map so transaction direction is easier to follow.
    const width = 650;
    const height = 360;
    const columns = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(count))));
    const columnGap = columns > 1 ? 500 / (columns - 1) : 0;

    nodes.forEach((node, i) => {
      const row = Math.floor(i / columns);
      const column = i % columns;
      const rowCount = Math.min(columns, count - row * columns);
      const rowOffset = rowCount < columns ? (columns - rowCount) * columnGap / 2 : 0;
      node.x = 75 + column * columnGap + rowOffset;
      node.y = row % 2 === 0 ? 105 : 255;
    });

    return { nodes, edges: edgeList, width, height };
  }, [transfers, signals]);

  if (graphData.nodes.length === 0) {
    return (
      <div className="placeholder-text" style={{ textAlign: 'center', padding: '2rem' }}>
        No transaction graph data available.
      </div>
    );
  }

  // Find node by ID
  const getNode = (id) => graphData.nodes.find((n) => n.id === id);

  // Selected node details for evidence inspection
  const selectedNodeData = selectedNode ? getNode(selectedNode) : null;
  const selectedNodeTxs = selectedNode
    ? graphData.edges.filter((e) => e.source === selectedNode || e.target === selectedNode)
    : [];

  return (
    <div style={{ marginTop: '1rem' }}>
      {/* Graph Legend & Controls */}
      <div
        style={{
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          marginBottom: '1rem',
          fontSize: '0.8rem',
          color: '#374151',
        }}
      >
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#1a8a6b', display: 'inline-block' }}></span>
            Normal wallet
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', display: 'inline-block', boxShadow: '0 0 6px #ef4444' }}></span>
            Suspicious loop
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#64748b', display: 'inline-block' }}></span>
            Mint / unknown
          </span>
        </div>
        <span style={{ color: '#374151', fontWeight: '600' }}>Follow arrows from sender to receiver. Click a wallet for evidence.</span>
      </div>

      {/* Interactive SVG Network Graph */}
      <div
        style={{
          background: 'rgba(244, 248, 246, 0.95)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '1rem',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <svg
          viewBox={`0 0 ${graphData.width} ${graphData.height}`}
          style={{ width: '100%', height: 'auto', maxHeight: '400px' }}
        >
          <defs>
            <pattern id="graph-grid" width="24" height="24" patternUnits="userSpaceOnUse">
              <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#1a8a6b" strokeOpacity=".08" strokeWidth="1" />
            </pattern>

            {/* Standard Cyan Arrow Marker */}
            <marker
              id="arrow-cyan"
              viewBox="0 0 10 10"
              refX="22"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#1a8a6b" />
            </marker>

            {/* Red Cycle Arrow Marker */}
            <marker
              id="arrow-red"
              viewBox="0 0 10 10"
              refX="22"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#ef4444" />
            </marker>

            {/* Highlight Glow Marker */}
            <marker
              id="arrow-amber"
              viewBox="0 0 10 10"
              refX="22"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#f59e0b" />
            </marker>
          </defs>

          <rect width={graphData.width} height={graphData.height} fill="url(#graph-grid)" opacity=".7" />
          <text x="24" y="32" fill="#1a8a6b" fontSize="11" fontFamily="var(--font-mono)" fontWeight="700" letterSpacing="1.5">WALLET TRANSACTION CIRCUIT</text>
          <text x="24" y="348" fill="#5a6b7a" fontSize="10" fontFamily="var(--font-mono)">LIVE FLOW</text>

          {/* Render Edges */}
          {graphData.edges.map((edge) => {
            const sourceNode = getNode(edge.source);
            const targetNode = getNode(edge.target);
            if (!sourceNode || !targetNode) return null;

            const isSelected = selectedNode && (edge.source === selectedNode || edge.target === selectedNode);
            const isHovered = hoveredEdge === edge.id || hoveredNode === edge.source || hoveredNode === edge.target;
            const isCircularEdge = sourceNode.isCircular && targetNode.isCircular;
            const reverseEdge = graphData.edges.find(
              (candidate) => candidate.source === edge.target && candidate.target === edge.source && candidate.id !== edge.id
            );
            const edgeIndex = Number(edge.id.replace('edge-', ''));
            const reverseEdgeIndex = reverseEdge ? Number(reverseEdge.id.replace('edge-', '')) : null;

            const strokeColor = isHovered || isSelected ? '#d97706' : isCircularEdge ? '#ef4444' : '#1a8a6b';
            const markerId = isHovered || isSelected ? 'url(#arrow-amber)' : isCircularEdge ? 'url(#arrow-red)' : 'url(#arrow-cyan)';
            const strokeWidth = isHovered || isSelected ? 3 : isCircularEdge ? 3 : 1.8;
            const midpointX = (sourceNode.x + targetNode.x) / 2;
            const midpointY = (sourceNode.y + targetNode.y) / 2;
            const bend = reverseEdge
              ? edgeIndex < reverseEdgeIndex ? -64 : 64
              : 0;
            const dx = targetNode.x - sourceNode.x;
            const dy = targetNode.y - sourceNode.y;
            const distance = Math.sqrt(dx * dx + dy * dy) || 1;
            const perpendicularX = -dy / distance;
            const perpendicularY = dx / distance;
            const controlX = midpointX + perpendicularX * bend;
            const controlY = midpointY + perpendicularY * bend;
            const edgePath = `M ${sourceNode.x} ${sourceNode.y} Q ${controlX} ${controlY} ${targetNode.x} ${targetNode.y}`;

            return (
              <g key={edge.id} onMouseEnter={() => setHoveredEdge(edge.id)} onMouseLeave={() => setHoveredEdge(null)}>
                <path
                  d={edgePath}
                  fill="none"
                  stroke="transparent"
                  strokeWidth="18"
                  style={{ cursor: 'pointer' }}
                />
                {/* Directed Edge Line */}
                <path
                  d={edgePath}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeDasharray={isCircularEdge ? 'none' : '7,4'}
                  markerEnd={reverseEdge ? undefined : markerId}
                  style={{
                    transition: 'all 0.2s ease',
                    pointerEvents: 'none',
                    animation: isCircularEdge || isHovered || isSelected ? 'graph-flow 1.2s linear infinite' : 'graph-flow 2.8s linear infinite',
                  }}
                />
                <path
                  d="M -8 -5 L 2 0 L -8 5"
                  fill="none"
                  stroke={isCircularEdge ? '#ef4444' : '#f7b955'}
                  strokeWidth={isHovered || isSelected ? 3 : 2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={isHovered || isSelected ? 1 : 0.9}
                >
                  <animateMotion
                    dur={isCircularEdge ? '1.4s' : '2.6s'}
                    repeatCount="indefinite"
                    path={edgePath}
                    rotate="auto"
                  />
                </path>
              </g>
            );
          })}

          {/* Render Nodes */}
          {graphData.nodes.map((node) => {
            const isSelected = selectedNode === node.id;
            const isHovered = hoveredNode === node.id;
            const fillColor = node.isMint ? '#8a9baa' : node.isCircular ? '#ef4444' : '#1a8a6b';
            const strokeColor = isSelected ? '#d97706' : isHovered ? '#1a2332' : 'rgba(26, 35, 50, 0.3)';
            const radius = isSelected || isHovered ? 16 : 13;

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                onClick={() => setSelectedNode(selectedNode === node.id ? null : node.id)}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                style={{ cursor: 'pointer' }}
              >
                {/* Glow ring for selected or circular nodes */}
                {(isSelected || node.isCircular) && (
                  <circle
                    r={radius + 6}
                    fill="none"
                    stroke={node.isCircular ? 'rgba(239, 68, 68, 0.35)' : 'rgba(217, 119, 6, 0.35)'}
                    strokeWidth="2"
                  >
                    <animate attributeName="r" values={`${radius + 4};${radius + 9};${radius + 4}`} dur="2s" repeatCount="indefinite" />
                  </circle>
                )}

                {!isSelected && !node.isCircular && (
                  <circle r={radius + 4} className="wallet-node-pulse" />
                )}

                {/* Wallet status card */}
                <rect
                  x="-58"
                  y="-23"
                  width="116"
                  height="46"
                  rx="13"
                  fill="#ffffff"
                  fillOpacity=".96"
                  stroke={strokeColor}
                  strokeWidth={isSelected ? 3 : 2}
                  style={{ transition: 'all 0.2s ease' }}
                />
                <circle cx="-41" cy="0" r="9" fill={fillColor} />
                <circle cx="-41" cy="0" r="4" fill="#ffffff" fillOpacity=".9" />

                {/* Node Text Label */}
                <text
                  x="-26"
                  y="4"
                  fill={isSelected ? '#b45309' : '#1a2332'}
                  fontSize="11"
                  fontFamily="var(--font-mono)"
                  fontWeight="800"
                  textAnchor="middle"
                >
                  {node.displayLabel}
                </text>
                <text x="-26" y="17" fill="#8a9baa" fontSize="8" fontFamily="var(--font-mono)">
                  {node.isMint ? 'ORIGIN' : node.isCircular ? 'FLAGGED LOOP' : `${node.txCount} TRANSFER${node.txCount === 1 ? '' : 'S'}`}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoveredEdge && (
          <div
            style={{
              position: 'absolute',
              bottom: '12px',
              left: '12px',
              background: 'rgba(255, 255, 255, 0.97)',
              border: '1px solid #1a8a6b',
              borderRadius: '8px',
              padding: '0.6rem 0.85rem',
              fontSize: '0.75rem',
              fontFamily: 'var(--font-mono)',
              color: '#1a2332',
              zIndex: 10,
              boxShadow: '0 6px 16px rgba(26, 35, 50, 0.12)',
            }}
          >
            {(() => {
              const edge = graphData.edges.find((e) => e.id === hoveredEdge);
              if (!edge) return null;
              return (
                <div>
                  <div style={{ color: '#1a8a6b', fontWeight: '700', marginBottom: '0.2rem' }}>Directed Transaction Edge</div>
                  <div>Tx Hash: <span style={{ color: '#1a2332' }}>{edge.hash.slice(0, 14)}...{edge.hash.slice(-6)}</span></div>
                  <div>From: <span style={{ color: '#5a6b7a' }}>{edge.source.slice(0, 8)}...</span> → To: <span style={{ color: '#5a6b7a' }}>{edge.target.slice(0, 8)}...</span></div>
                  <div>Value: <span style={{ color: '#10b981', fontWeight: '700' }}>{edge.value !== null && edge.value !== undefined ? `${edge.value} ETH` : 'Transfer (0 ETH)'}</span></div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Wallet Inspection Panel (When a node is clicked) */}
      {selectedNodeData && (
        <div
          style={{
            marginTop: '1rem',
            background: 'rgba(255, 255, 255, 0.9)',
            border: '1px solid #d97706',
            borderRadius: '12px',
            padding: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ color: '#d97706', fontSize: '1rem' }}>🔍</span>
              <span style={{ fontWeight: '700', fontSize: '0.95rem', color: '#1a2332' }}>
                Inspected Wallet: <span style={{ fontFamily: 'var(--font-mono)', color: '#1a8a6b' }}>{selectedNodeData.id}</span>
              </span>
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              style={{
                background: 'rgba(26, 35, 50, 0.06)',
                border: 'none',
                color: '#5a6b7a',
                borderRadius: '4px',
                padding: '0.2rem 0.5rem',
                cursor: 'pointer',
                fontSize: '0.75rem',
              }}
            >
              Close Inspection
            </button>
          </div>

          <div style={{ fontSize: '0.85rem', color: '#5a6b7a', marginBottom: '0.75rem' }}>
            Participated in <strong style={{ color: '#1a2332' }}>{selectedNodeTxs.length}</strong> recorded transfers for this NFT.
            {selectedNodeData.isCircular && (
              <span style={{ color: '#ef4444', marginLeft: '0.5rem', fontWeight: '600' }}>
                ⚠️ Flagged in Circular Trading Pattern
              </span>
            )}
          </div>

          {/* Table of Evidence Transactions for this Wallet */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '0.4rem' }}>Role</th>
                  <th style={{ padding: '0.4rem' }}>Tx Hash</th>
                  <th style={{ padding: '0.4rem' }}>Counterparty</th>
                  <th style={{ padding: '0.4rem' }}>Value</th>
                </tr>
              </thead>
              <tbody>
                {selectedNodeTxs.map((tx, idx) => {
                  const isSender = tx.source === selectedNode;
                  const counterparty = isSender ? tx.target : tx.source;

                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(200, 215, 210, 0.4)' }}>
                      <td style={{ padding: '0.4rem', color: isSender ? '#f97316' : '#10b981', fontWeight: '600' }}>
                        {isSender ? 'SENDER (OUT)' : 'RECEIVER (IN)'}
                      </td>
                      <td style={{ padding: '0.4rem', color: '#1a8a6b' }}>
                        {tx.hash ? `${tx.hash.slice(0, 10)}...` : 'N/A'}
                      </td>
                      <td style={{ padding: '0.4rem', color: '#5a6b7a' }}>
                        {counterparty.slice(0, 8)}...{counterparty.slice(-4)}
                      </td>
                      <td style={{ padding: '0.4rem', color: '#10b981', fontWeight: 'bold' }}>
                        {tx.value !== null && tx.value !== undefined ? `${tx.value} ETH` : '0 ETH'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
