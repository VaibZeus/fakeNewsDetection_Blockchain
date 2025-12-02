// src/components/CheckStatus.jsx
import React, { useState } from "react";
import { ethers } from "ethers";
import NewsJson from "../abis/NewsRegistry.json";
import { NEWS_ADDRESS } from "../constants";

function getProvider() {
  if (typeof window !== "undefined" && window.ethereum) {
    return new ethers.providers.Web3Provider(window.ethereum);
  }
  return new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545");
}

async function computeSha256HexStrict(text) {
  const encoder = new TextEncoder();
  const normalized = (text ?? "").trim();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const bytes = Array.from(new Uint8Array(hashBuffer));
  const hex = bytes.map(b => b.toString(16).padStart(2, "0")).join("");
  return "0x" + hex;
}

function StatusBadge({ statusNum }) {
  const s = Number(statusNum);
  const cls = s === 1 ? "success" : s === 2 ? "danger" : s === 3 ? "warning" : "secondary";
  const label = s === 0 ? "UnderReview" : s === 1 ? "VerifiedTrue" : s === 2 ? "MarkedFake" : s === 3 ? "Disputed" : `Unknown(${s})`;
  return <span className={`badge bg-${cls}`}>{label}</span>;
}

export default function CheckStatus() {
  const provider = getProvider();
  const [hashInput, setHashInput] = useState("");
  const [articleInput, setArticleInput] = useState("");
  const [computedHash, setComputedHash] = useState("");
  const [res, setRes] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  function normalizeHexInput(raw) {
    if (!raw) return "";
    let h = raw.trim();
    if (!h.startsWith("0x")) h = "0x" + h;
    return h;
  }

  function isValidBytes32(hex) {
    try {
      if (!hex) return false;
      if (!hex.startsWith("0x")) hex = "0x" + hex;
      const arr = ethers.utils.arrayify(hex);
      return arr.length === 32;
    } catch (e) {
      return false;
    }
  }

  async function fetchArticleByHash(hex) {
    setErr("");
    setRes(null);
    if (!hex) { setErr("No content hash provided"); return; }
    if (!isValidBytes32(hex)) { setErr("Invalid contentHash: must be 32 bytes (0x..)."); return; }

    try {
      setLoading(true);
      const contract = new ethers.Contract(NEWS_ADDRESS, NewsJson.abi, provider);
      const article = await contract.getArticle(hex);
      const createdAt = Number(article[4].toString());
      if (createdAt === 0) {
        setErr("Article not found on-chain.");
        setLoading(false);
        return;
      }
      const status = Number(article[5]);
      const yes = Number(article[6].toString());
      const no = Number(article[7].toString());
      const finalized = Boolean(article[8]);

      setRes({
        contentHash: article[0],
        uri: article[1],
        publisher: article[2],
        submitter: article[3],
        createdAt,
        status,
        yes,
        no,
        finalized
      });
    } catch (e) {
      console.error(e);
      setErr(e?.error?.message || e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  async function onCheckHash() {
    const hex = normalizeHexInput(hashInput);
    await fetchArticleByHash(hex);
  }

  async function onComputeAndCheck() {
    setErr("");
    setRes(null);
    if (!articleInput || articleInput.trim() === "") { setErr("Enter article text or URL to compute."); return; }
    try {
      setLoading(true);
      const h = await computeSha256HexStrict(articleInput);
      setComputedHash(h);
      await fetchArticleByHash(h);
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card h-100">
      <div className="card-body">
        <h5 className="card-title">Check Status</h5>

        <div className="mb-2">
          <label className="form-label small">Content Hash</label>
          <div className="input-group input-group-sm">
            <input className="form-control form-control-sm" value={hashInput} onChange={e => setHashInput(e.target.value)} placeholder="0x..." />
            <button className="btn btn-outline-primary" onClick={onCheckHash} disabled={!hashInput || loading}>Check</button>
          </div>
        </div>

        <div className="mb-2">
          <label className="form-label small">Or compute from article text / URL</label>
          <textarea className="form-control form-control-sm" rows={3} value={articleInput} onChange={e => setArticleInput(e.target.value)} placeholder="Paste article text or URL..." />
          <div className="mt-2">
            <button className="btn btn-sm btn-outline-primary" onClick={onComputeAndCheck} disabled={!articleInput || loading}>Compute & Check</button>
            {computedHash && <span className="ms-2 text-monospace">{computedHash}</span>}
          </div>
        </div>

        {err && <div className="alert alert-danger mt-3">{err}</div>}

        {res && (
          <div className="card mt-3 p-2">
            <div className="d-flex justify-content-between align-items-start">
              <div>
                <div><strong>contentHash:</strong> <span className="text-monospace">{res.contentHash}</span></div>
                <div><strong>URI:</strong> {res.uri || "(empty)"}</div>
                <div><strong>Publisher:</strong> {res.publisher}</div>
                <div><strong>Submitter:</strong> {res.submitter}</div>
                <div><strong>Stored At:</strong> {new Date(res.createdAt * 1000).toLocaleString()}</div>
              </div>
              <div className="text-end">
                <StatusBadge statusNum={res.status} />
                <div className="mt-2 small">Yes / No: {res.yes} / {res.no}</div>
                <div className="small mt-1">Finalized: {String(res.finalized)}</div>
              </div>
            </div>
          </div>
        )}

        {loading && <div className="mt-3"><div className="spinner-border spinner-border-sm" role="status"><span className="visually-hidden">Loading...</span></div> Checking...</div>}
      </div>
    </div>
  );
}
