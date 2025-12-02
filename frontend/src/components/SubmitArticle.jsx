// src/components/SubmitArticle.jsx
import React, { useState } from "react";
import { ethers } from "ethers";
import NewsJson from "../abis/NewsRegistry.json";
import PubJson from "../abis/PublisherRegistry.json";
import { NEWS_ADDRESS, PUB_ADDRESS } from "../constants";

/*
  SubmitArticle: improved duplicate submission handling
  - Computes SHA-256 contentHash
  - Pre-checks getArticle(contentHash) and shows a friendly message if already present
  - If not present, proceeds to submit using signer
  - Extracts concise revert/error messages instead of raw JSON-RPC dumps
*/

async function computeSha256HexStrict(text) {
  const encoder = new TextEncoder();
  const normalized = (text ?? "").trim();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const bytes = Array.from(new Uint8Array(hashBuffer));
  const hex = bytes.map(b => b.toString(16).padStart(2, "0")).join("");
  return hex;
}

function getProviderAndSigner() {
  if (typeof window !== "undefined" && window.ethereum) {
    const prov = new ethers.providers.Web3Provider(window.ethereum);
    return { provider: prov, signer: prov.getSigner() };
  }
  const prov = new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545");
  return { provider: prov, signer: null };
}

function statusToString(statusNum) {
  switch (Number(statusNum)) {
    case 0: return "UnderReview";
    case 1: return "VerifiedTrue";
    case 2: return "MarkedFake";
    case 3: return "Disputed";
    default: return `Unknown(${statusNum})`;
  }
}

function StatusBadge({ statusNum }) {
  const s = Number(statusNum);
  const bg = s === 1 ? "success" : s === 2 ? "danger" : s === 3 ? "warning" : "secondary";
  return <span className={`badge bg-${bg}`}>{statusToString(s)}</span>;
}

// Friendly short error extraction
function extractShortError(err) {
  // common patterns: revert reason inside error.message or error.error.message
  const raw = err?.error?.message || err?.message || String(err);
  // look for 'revert' and strip prefix
  const m = raw.match(/revert(?:\s*:\s*|\s*)(.*)/i);
  if (m && m[1]) return m[1].slice(0, 300);
  // fallback: return first 300 chars with no JSON
  return raw.slice(0, 300);
}

export default function SubmitArticle({ connectedAddress }) {
  const [uri, setUri] = useState("");
  const [content, setContent] = useState("");
  const [publisherInput, setPublisherInput] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [articleInfo, setArticleInfo] = useState(null);
  const [txHash, setTxHash] = useState(null);
  const [computedHash, setComputedHash] = useState(null);
  const [busy, setBusy] = useState(false);
  const [publisherTrusted, setPublisherTrusted] = useState(null);

  async function checkPublisherTrusted(addr) {
    try {
      if (!addr || addr === ethers.constants.AddressZero) return false;
      if (!PUB_ADDRESS) return null;
      const { provider } = getProviderAndSigner();
      const pubContract = new ethers.Contract(PUB_ADDRESS, PubJson.abi, provider);
      const trusted = await pubContract.isTrusted(addr);
      return Boolean(trusted);
    } catch (e) {
      return null;
    }
  }

  // New: pre-check if article exists on-chain
  async function precheckHash(hex) {
    try {
      const { provider } = getProviderAndSigner();
      const readContract = new ethers.Contract(NEWS_ADDRESS, NewsJson.abi, provider);
      const article = await readContract.getArticle(hex);
      const createdAt = Number(article[4].toString());
      if (createdAt === 0) return null;
      return {
        contentHash: article[0],
        uri: article[1],
        publisher: article[2],
        submitter: article[3],
        createdAt,
        status: Number(article[5]),
        yes: Number(article[6].toString()),
        no: Number(article[7].toString()),
        finalized: article[8],
      };
    } catch (e) {
      console.error("precheckHash error", e);
      return null;
    }
  }

  async function submit() {
    setStatusMsg("");
    setArticleInfo(null);
    setTxHash(null);
    setComputedHash(null);
    setPublisherTrusted(null);

    if (!NEWS_ADDRESS || !ethers.utils.isAddress(NEWS_ADDRESS)) {
      setStatusMsg("NEWS_ADDRESS invalid in src/constants.");
      return;
    }

    if (!connectedAddress) {
      setStatusMsg("You must connect your wallet to submit articles.");
      return;
    }

    try {
      setBusy(true);
      setStatusMsg("Computing SHA-256...");
      const hex = await computeSha256HexStrict(content || uri || "");
      if (hex.length !== 64) {
        setStatusMsg("Computed hash has unexpected length. Check input.");
        setBusy(false);
        return;
      }
      const contentHashHex = "0x" + hex;
      setComputedHash(contentHashHex);

      // pre-check: if already present, show friendly message and return
      const existing = await precheckHash(contentHashHex);
      if (existing) {
        setArticleInfo(existing);
        setStatusMsg(`This article is already submitted on-chain by ${existing.submitter} at ${new Date(existing.createdAt * 1000).toLocaleString()}.`);
        if (existing.publisher && existing.publisher !== ethers.constants.AddressZero) {
          const trusted = await checkPublisherTrusted(existing.publisher);
          setPublisherTrusted(trusted);
        } else setPublisherTrusted(false);
        setBusy(false);
        return;
      }

      // prepare publisher address (optional)
      let publisherToPass = ethers.constants.AddressZero;
      if (publisherInput && publisherInput.trim() !== "") {
        const maybe = publisherInput.trim();
        if (!ethers.utils.isAddress(maybe)) {
          setStatusMsg("Publisher address is invalid.");
          setBusy(false);
          return;
        }
        publisherToPass = maybe;
      }

      // require signer
      const { provider, signer } = getProviderAndSigner();
      if (!signer) {
        setStatusMsg("Please connect wallet (signer needed).");
        setBusy(false);
        return;
      }

      setStatusMsg("Submitting article to chain...");
      const writeContract = new ethers.Contract(NEWS_ADDRESS, NewsJson.abi, signer);

      // Submit tx
      const tx = await writeContract.submitArticle(contentHashHex, uri || "", publisherToPass);
      setTxHash(tx.hash);
      setStatusMsg(`Transaction sent: ${tx.hash} — waiting to be mined...`);
      const receipt = await tx.wait();
      setStatusMsg(`Transaction mined: ${tx.hash} — reading stored article...`);

      // read back
      const readContract = new ethers.Contract(NEWS_ADDRESS, NewsJson.abi, provider);
      const article = await readContract.getArticle(contentHashHex);
      const createdAt = Number(article[4].toString());
      if (createdAt === 0) {
        setStatusMsg("Article submitted but not found on-chain (unexpected).");
      } else {
        const stored = {
          contentHash: article[0],
          uri: article[1],
          publisher: article[2],
          submitter: article[3],
          createdAt: createdAt,
          status: Number(article[5]),
          yes: Number(article[6].toString()),
          no: Number(article[7].toString()),
          finalized: article[8],
        };
        setArticleInfo(stored);
        if (stored.publisher && stored.publisher !== ethers.constants.AddressZero) {
          const trusted = await checkPublisherTrusted(stored.publisher);
          setPublisherTrusted(trusted);
        } else setPublisherTrusted(false);
        setStatusMsg("Submitted and stored on-chain.");
      }
    } catch (err) {
      console.error("submit error:", err);
      const short = extractShortError(err);
      setStatusMsg("Submit failed: " + short);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card h-100">
      <div className="card-body">
        <h5 className="card-title">Submit Article</h5>

        {!connectedAddress && (
          <div className="alert alert-warning">
            <strong>Wallet not connected.</strong> Connect your wallet to submit articles.
          </div>
        )}

        <div className="mb-2">
          <label className="form-label small">Article URI (optional)</label>
          <input className="form-control form-control-sm" value={uri} onChange={e => setUri(e.target.value)} placeholder="https://..." />
        </div>

        <div className="mb-2">
          <label className="form-label small">Article Text (or paste)</label>
          <textarea className="form-control form-control-sm" rows={4} value={content} onChange={e => setContent(e.target.value)} placeholder="Paste article text..." />
        </div>

        <div className="mb-3">
          <label className="form-label small">Publisher Address (optional)</label>
          <input className="form-control form-control-sm" value={publisherInput} onChange={e => setPublisherInput(e.target.value)} placeholder="0xPublisherAddress" />
        </div>

        <div className="d-flex align-items-center gap-2">
          <button className="btn btn-primary btn-sm" onClick={submit} disabled={busy || !connectedAddress}>
            {busy ? "Working..." : "Submit"}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => { setUri(""); setContent(""); setPublisherInput(""); setStatusMsg(""); setArticleInfo(null); setTxHash(null); setComputedHash(null); }}>
            Clear
          </button>
        </div>

        {statusMsg && <div className="mt-3"><div className="alert alert-info py-2">{statusMsg}</div></div>}

        {computedHash && !articleInfo && (
          <div className="mt-2"><small className="text-monospace">Computed: {computedHash}</small></div>
        )}

        {txHash && (
          <div className="mt-2"><small className="text-monospace">Tx: {txHash}</small></div>
        )}

        {articleInfo && (
          <div className="mt-3">
            <div className="card p-2">
              <div className="d-flex justify-content-between align-items-center">
                <strong>Stored Article</strong>
                <StatusBadge statusNum={articleInfo.status} />
              </div>
              <div className="small mt-2">
                <div><strong>contentHash:</strong> <span className="text-monospace">{articleInfo.contentHash}</span></div>
                <div><strong>URI:</strong> {articleInfo.uri || "(empty)"}</div>
                <div><strong>Publisher:</strong> {articleInfo.publisher}</div>
                <div><strong>Submitter:</strong> {articleInfo.submitter}</div>
                <div><strong>Submitted At:</strong> {new Date(articleInfo.createdAt * 1000).toLocaleString()}</div>
                <div className="mt-1">{publisherTrusted !== null && (publisherTrusted ? <span className="badge bg-success">Publisher trusted</span> : <span className="badge bg-danger">Publisher not trusted</span>)}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
