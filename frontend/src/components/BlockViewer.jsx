// src/components/BlockViewer.jsx
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";

/*
  Improved BlockViewer
  - Respects theme variables (--card-bg, --card-border, --text)
  - Professional styling: rounded cards, subtle shadows, hover state
  - Transaction preview rows use theme variables (no white bg in dark mode)
  - Refresh button
  - Expandable transaction details (click "Details")
  - Uses injected provider (window.ethereum) if available, else localhost
*/

const DEFAULT_BLOCKS = 6;

function short(h = "", start = 8, end = 8) {
  if (!h) return "";
  if (h.length <= start + end) return h;
  return `${h.slice(0, start)}…${h.slice(-end)}`;
}

function weiToEth(weiBn) {
  try {
    return ethers.utils.formatEther(weiBn);
  } catch {
    return "0";
  }
}

function numberWithCommas(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export default function BlockViewer({ recentCount = DEFAULT_BLOCKS }) {
  const [provider, setProvider] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);
  const [expandedTxs, setExpandedTxs] = useState(new Set());

  useEffect(() => {
    const p = (typeof window !== "undefined" && window.ethereum)
      ? new ethers.providers.Web3Provider(window.ethereum)
      : new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545");
    setProvider(p);
    loadBlocks(p);
    // auto refresh every 8s (non-destructive)
    const id = setInterval(() => loadBlocks(p), 8000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadBlocks(p = provider, count = recentCount) {
    if (!p) return;
    setError(null);
    setLoading(true);
    try {
      const latest = await p.getBlockNumber();
      const arr = [];
      const end = Math.max(0, latest - (count - 1));
      for (let n = latest; n >= end; n--) {
        const block = await p.getBlockWithTransactions(n);
        arr.push(block);
      }
      setBlocks(arr);
      setLastUpdated(new Date());
    } catch (e) {
      console.error("BlockViewer load error:", e);
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  async function onRefresh() {
    await loadBlocks();
  }

  function toggleTx(hash) {
    setExpandedTxs(prev => {
      const copy = new Set(prev);
      if (copy.has(hash)) copy.delete(hash);
      else copy.add(hash);
      return copy;
    });
  }

  return (
    <div className="card">
      <div className="card-body">
        <div className="d-flex align-items-start justify-content-between mb-3">
          <div>
            <h5 className="card-title mb-0">Recent Blocks</h5>
            <div className="small text-muted mt-1">
              {lastUpdated ? `Updated: ${lastUpdated.toLocaleString()}` : "Loading..."}
            </div>
          </div>

          <div className="d-flex align-items-center gap-2">
            <button className="btn btn-sm btn-outline-secondary" onClick={onRefresh} disabled={loading}>
              {loading ? (<><span className="spinner-border spinner-border-sm me-1" role="status" />Refreshing</>) : "Refresh"}
            </button>
          </div>
        </div>

        {error && <div className="alert alert-danger small">{error}</div>}

        <div>
          {blocks.map(b => (
            <div key={b.number} className="mb-3">
              <div className="block-card p-3">
                <div className="d-flex flex-column flex-md-row justify-content-between gap-3">
                  <div>
                    <div className="h6 mb-1">Block #{b.number} <small className="text-muted">({numberWithCommas(b.transactions.length)} tx)</small></div>
                    <div className="small text-muted">Timestamp: {new Date(b.timestamp * 1000).toLocaleString()}</div>
                    <div className="small mt-1"><strong>Hash:</strong> <span className="text-monospace">{short(b.hash, 12, 12)}</span></div>
                    <div className="small"><strong>Parent:</strong> <span className="text-monospace">{short(b.parentHash, 10, 8)}</span></div>
                    <div className="small"><strong>Miner:</strong> <span className="text-monospace">{short(b.miner, 10, 8)}</span></div>
                  </div>

                  <div className="text-md-end small" style={{ minWidth: 200 }}>
                    <div><strong>Nonce:</strong> {b.nonce ?? "—"}</div>
                    <div><strong>Gas:</strong> {numberWithCommas(String(b.gasUsed))} / {numberWithCommas(String(b.gasLimit || b.gasUsed))}</div>
                    {b.baseFeePerGas != null && <div><strong>Base fee:</strong> {ethers.utils.formatUnits(b.baseFeePerGas, "gwei").slice(0, 8)} gwei</div>}
                    <div className="mt-1"><strong>Difficulty:</strong> {b.difficulty ? numberWithCommas(String(b.difficulty)) : "—"}</div>
                  </div>
                </div>

                <hr style={{ borderColor: "var(--card-border)" }} />

                <div>
                  <div className="small text-muted mb-2">Transactions (preview)</div>

                  <div className="tx-list">
                    {b.transactions.length === 0 && <div className="small text-muted">No transactions in this block</div>}

                    {b.transactions.slice(0, 8).map(tx => {
                      const expanded = expandedTxs.has(tx.hash);
                      return (
                        <div key={tx.hash} className="tx-row mb-2">
                          <div className="d-flex align-items-start justify-content-between">
                            <div style={{ minWidth: 300 }}>
                              <div className="fw-semibold small text-monospace">{short(tx.hash, 14, 12)}</div>
                              <div className="small text-muted">
                                <span>from: <span className="text-monospace">{short(tx.from, 8, 8)}</span></span>
                                <span className="ms-2">to: <span className="text-monospace">{tx.to ? short(tx.to, 8, 8) : "contract"}</span></span>
                              </div>
                            </div>

                            <div className="text-end small" style={{ minWidth: 200 }}>
                              <div><strong>Value:</strong> {Number(weiToEth(tx.value)).toFixed(6)} ETH</div>
                              <div><strong>GasLimit:</strong> {tx.gasLimit ? tx.gasLimit.toString() : "-"}</div>
                              <div className="text-muted">{tx.data && tx.data !== "0x" ? `input: ${short(tx.data, 12, 8)}` : "no input"}</div>
                            </div>
                          </div>

                          <div className="mt-2 d-flex justify-content-between align-items-center">
                            <div className="small text-muted">Block tx index: {tx.transactionIndex ?? "-"}</div>
                            <div>
                              <button className="btn btn-sm btn-outline-primary me-2" onClick={() => navigator.clipboard?.writeText(tx.hash)}>Copy Hash</button>
                              <button className="btn btn-sm btn-outline-secondary" onClick={() => toggleTx(tx.hash)}>{expanded ? "Hide Details" : "Details"}</button>
                            </div>
                          </div>

                          {expanded && (
                            <div className="tx-details mt-2 p-2">
                              <div className="small"><strong>Full Hash:</strong> <span className="text-monospace">{tx.hash}</span></div>
                              <div className="small"><strong>From:</strong> <span className="text-monospace">{tx.from}</span></div>
                              <div className="small"><strong>To:</strong> <span className="text-monospace">{tx.to ?? "(contract)"}</span></div>
                              <div className="small"><strong>Value (ETH):</strong> {weiToEth(tx.value)}</div>
                              <div className="small"><strong>GasLimit:</strong> {tx.gasLimit ? tx.gasLimit.toString() : "-"}</div>
                              <div className="small"><strong>GasPrice / MaxFee:</strong> {tx.gasPrice ? tx.gasPrice.toString() : (tx.maxFeePerGas ? tx.maxFeePerGas.toString() : "-")}</div>
                              <div className="small"><strong>Input Data:</strong> <div className="text-monospace mt-1">{tx.data || "0x"}</div></div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {b.transactions.length > 8 && (
                      <div className="small text-muted">...and {b.transactions.length - 8} more</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {blocks.length === 0 && !loading && <div className="small text-muted">No blocks to show.</div>}
        </div>

        <div className="mt-2 small text-muted">Showing last {blocks.length} blocks. Refresh to update.</div>
      </div>

      {/* local styles that use theme variables so dark/light modes work */}
      <style>{`
        .block-card {
          background: var(--card-bg);
          border: 1px solid var(--card-border);
          border-radius: 12px;
          box-shadow: 0 6px 18px rgba(2,6,23,0.06);
        }

        .tx-list { display: flex; flex-direction: column; gap: 8px; }

        .tx-row {
          background: var(--card-bg);
          border: 1px solid var(--card-border);
          padding: 12px;
          border-radius: 10px;
          transition: transform 120ms ease, box-shadow 120ms ease;
        }

        .tx-row:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 20px rgba(2,6,23,0.08);
        }

        .tx-details {
          background: rgba(0,0,0,0.03);
          border-radius: 8px;
          border: 1px dashed var(--card-border);
          padding: 10px;
          margin-top: 8px;
        }

        /* make expanded details readable in dark mode */
        body.theme-dark .tx-details {
          background: rgba(255,255,255,0.02);
        }

        .text-monospace { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, "Roboto Mono", monospace; font-size: 12px; color: var(--text); }
        .small { color: var(--muted); }
        .fw-semibold { font-weight: 600; color: var(--text); }

        /* ensure buttons remain visible in dark */
        .btn-outline-primary { border-color: var(--card-border); }
        .btn-outline-secondary { border-color: var(--card-border); color: var(--text); }

        @media (max-width: 767px) {
          .block-card { padding: 14px; }
        }
      `}</style>
    </div>
  );
}
