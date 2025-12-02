// src/components/VoteArticle.jsx
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import NewsJson from "../abis/NewsRegistry.json";
import { NEWS_ADDRESS } from "../constants";

async function computeSha256HexStrict(text) {
  const encoder = new TextEncoder();
  const normalized = (text ?? "").trim();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const bytes = Array.from(new Uint8Array(hashBuffer));
  const hex = bytes.map(b => b.toString(16).padStart(2, "0")).join("");
  return "0x" + hex;
}

function getProviderAndSigner() {
  if (typeof window !== "undefined" && window.ethereum) {
    const prov = new ethers.providers.Web3Provider(window.ethereum);
    return { provider: prov, signer: prov.getSigner() };
  }
  const prov = new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545");
  return { provider: prov, signer: null };
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

function statusToString(n) {
  switch (Number(n)) {
    case 0: return "UnderReview";
    case 1: return "VerifiedTrue";
    case 2: return "MarkedFake";
    case 3: return "Disputed";
    default: return `Unknown(${n})`;
  }
}

export default function VoteArticle({ connectedAddress }) {
  const [hashInput, setHashInput] = useState("");
  const [articleInput, setArticleInput] = useState("");
  const [computedHash, setComputedHash] = useState(null);
  const [statusMsg, setStatusMsg] = useState("");
  const [articleInfo, setArticleInfo] = useState(null);
  const [checkedHash, setCheckedHash] = useState(false);
  const [articleExists, setArticleExists] = useState(false);
  const [alreadyVoted, setAlreadyVoted] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {}, []);

  async function computeAndCheck() {
    setStatusMsg("");
    setComputedHash(null);
    setArticleInfo(null);
    setCheckedHash(false);
    setArticleExists(false);
    setAlreadyVoted(null);

    if (!articleInput || articleInput.trim() === "") {
      setStatusMsg("Paste the article text/URI to compute contentHash.");
      return;
    }

    try {
      setLoading(true);
      setStatusMsg("Computing contentHash...");
      const ch = await computeSha256HexStrict(articleInput);
      setComputedHash(ch);
      setStatusMsg("Computed contentHash. Checking on-chain...");

      const { provider } = getProviderAndSigner();
      const readContract = new ethers.Contract(NEWS_ADDRESS, NewsJson.abi, provider);
      const article = await readContract.getArticle(ch);
      const createdAt = Number(article[4].toString());
      if (createdAt === 0) {
        setStatusMsg("Article not found on-chain. Submit first.");
        setCheckedHash(true);
        setArticleExists(false);
      } else {
        const info = {
          contentHash: article[0],
          uri: article[1],
          submitter: article[3],
          createdAt,
          status: Number(article[5]),
          yes: Number(article[6].toString()),
          no: Number(article[7].toString()),
          finalized: article[8],
        };
        setArticleInfo(info);
        setCheckedHash(true);
        setArticleExists(true);
        setStatusMsg("Article found on-chain.");

        // check hasVoted if wallet connected
        if (connectedAddress) {
          try {
            const voted = await readContract.hasVoted(ch, connectedAddress);
            setAlreadyVoted(Boolean(voted));
            if (voted) setStatusMsg(prev => prev + " — You already voted on this article.");
          } catch (e) {
            // ignore; non-critical
          }
        } else {
          setStatusMsg(prev => prev + " Connect wallet to check your vote history.");
        }
      }
    } catch (e) {
      console.error(e);
      setStatusMsg("Check failed: " + (e?.message || String(e)));
    } finally {
      setLoading(false);
    }
  }

  async function precheckForHash(hexRaw) {
    setStatusMsg("");
    setArticleInfo(null);
    setCheckedHash(false);
    setArticleExists(false);
    setAlreadyVoted(null);

    let hex = hexRaw && hexRaw.trim() ? hexRaw.trim() : "";
    if (!hex.startsWith("0x")) hex = "0x" + hex.replace(/^0x/i, "");

    if (!isValidBytes32(hex)) {
      setStatusMsg("Provide a valid 32-byte contentHash (0x...64 hex).");
      return;
    }

    try {
      setLoading(true);
      const { provider } = getProviderAndSigner();
      const readContract = new ethers.Contract(NEWS_ADDRESS, NewsJson.abi, provider);
      const article = await readContract.getArticle(hex);
      const createdAt = Number(article[4].toString());
      if (createdAt === 0) {
        setStatusMsg("Article not found on-chain.");
        setCheckedHash(true);
        setArticleExists(false);
      } else {
        const info = {
          contentHash: article[0],
          uri: article[1],
          submitter: article[3],
          createdAt: createdAt,
          status: Number(article[5]),
          yes: Number(article[6].toString()),
          no: Number(article[7].toString()),
          finalized: article[8],
        };
        setArticleInfo(info);
        setCheckedHash(true);
        setArticleExists(true);
        setStatusMsg("Article found on-chain.");

        if (connectedAddress) {
          try {
            const voted = await readContract.hasVoted(hex, connectedAddress);
            setAlreadyVoted(Boolean(voted));
            if (voted) setStatusMsg(prev => prev + " — You already voted on this article.");
          } catch (e) { /* ignore */ }
        } else {
          setStatusMsg(prev => prev + " Connect wallet to check your vote history.");
        }
      }
    } catch (e) {
      console.error(e);
      setStatusMsg("Check failed: " + (e?.message || String(e)));
    } finally {
      setLoading(false);
    }
  }

  // New: check hasVoted before sending transaction; show friendly message if already voted.
  async function vote(support) {
    setStatusMsg("");
    setLoading(true);
    try {
      let hex = hashInput && hashInput.trim() ? hashInput.trim() : (computedHash || "");
      if (!hex.startsWith("0x")) hex = "0x" + hex.replace(/^0x/i, "");
      if (!isValidBytes32(hex)) { setStatusMsg("Invalid contentHash."); setLoading(false); return; }

      // ensure article exists
      if (!checkedHash || !articleExists) { setStatusMsg("Check the article first."); setLoading(false); return; }
      if (!connectedAddress) { setStatusMsg("Connect your wallet to vote."); setLoading(false); return; }

      const { signer, provider } = getProviderAndSigner();
      if (!signer) { setStatusMsg("Signer required. Connect wallet."); setLoading(false); return; }

      // Check on-chain if user already voted (prevents revert)
      const readContract = new ethers.Contract(NEWS_ADDRESS, NewsJson.abi, provider);
      const voted = await readContract.hasVoted(hex, connectedAddress);
      if (voted) {
        setAlreadyVoted(true);
        setStatusMsg("You have already voted on this article — duplicate votes are not allowed.");
        setLoading(false);
        return;
      }

      // proceed with vote
      const writeContract = new ethers.Contract(NEWS_ADDRESS, NewsJson.abi, signer);
      setStatusMsg("Sending vote transaction...");
      const tx = await writeContract.vote(hex, support);
      await tx.wait();
      setStatusMsg("Vote recorded. Thank you.");

      // refresh article info
      const updated = await readContract.getArticle(hex);
      setArticleInfo({
        contentHash: updated[0],
        uri: updated[1],
        submitter: updated[3],
        createdAt: Number(updated[4].toString()),
        status: Number(updated[5]),
        yes: Number(updated[6].toString()),
        no: Number(updated[7].toString()),
        finalized: updated[8]
      });
      setAlreadyVoted(true);
    } catch (e) {
      console.error(e);
      // show short, user-friendly message
      const raw = e?.error?.message || e?.message || String(e);
      if (/already voted/i.test(raw)) {
        setStatusMsg("You have already voted on this article.");
      } else if (/revert/i.test(raw) || /execution reverted/i.test(raw)) {
        // show brief revert reason if available
        const m = raw.match(/revert(?:.*:)?\s*(.*)/i);
        setStatusMsg(m && m[1] ? `Transaction reverted: ${m[1]}` : "Transaction reverted on-chain.");
      } else {
        setStatusMsg("Vote failed: " + (e?.message || String(e)).slice(0, 200));
      }
    } finally {
      setLoading(false);
    }
  }

  const canVote = checkedHash && articleExists && !alreadyVoted && !loading && connectedAddress;

  return (
    <div className="card h-100">
      <div className="card-body">
        <h5 className="card-title">Vote Article</h5>

        {!connectedAddress && (
          <div className="alert alert-warning">
            Wallet not connected. Connect to cast votes.
          </div>
        )}

        <div className="row">
          <div className="col-md-6 mb-2">
            <label className="form-label small">Content Hash (0x...)</label>
            <input className="form-control form-control-sm" value={hashInput} onChange={e => setHashInput(e.target.value)} placeholder="0x..." />
            <div className="mt-2">
              <button className="btn btn-sm btn-outline-primary me-2" onClick={() => precheckForHash(hashInput)} disabled={!hashInput || loading}>Check Hash</button>
              <button className="btn btn-sm btn-outline-secondary" onClick={() => { setHashInput(""); setCheckedHash(false); setArticleInfo(null); setStatusMsg(""); setAlreadyVoted(null); }}>Clear</button>
            </div>
          </div>

          <div className="col-md-6 mb-2">
            <label className="form-label small">Or paste article text / URI</label>
            <textarea className="form-control form-control-sm" rows="4" value={articleInput} onChange={e => setArticleInput(e.target.value)} />
            <div className="mt-2">
              <button className="btn btn-sm btn-outline-primary" onClick={computeAndCheck} disabled={!articleInput || loading}>Compute & Check</button>
              {computedHash && <button className="btn btn-sm btn-outline-secondary ms-2" onClick={() => { setHashInput(computedHash); setStatusMsg("Computed hash copied to input."); }}>Use computed hash</button>}
            </div>
          </div>
        </div>

        {articleInfo && (
          <div className="card mt-3 p-2">
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <div><strong>contentHash:</strong> <span className="text-monospace">{articleInfo.contentHash}</span></div>
                <div><strong>URI:</strong> {articleInfo.uri || "(empty)"}</div>
                <div><strong>Submitter:</strong> {articleInfo.submitter}</div>
                <div><strong>Submitted At:</strong> {new Date(articleInfo.createdAt * 1000).toLocaleString()}</div>
              </div>
              <div className="text-end">
                <div className="mb-1"><strong>Status</strong></div>
                <div><span className="badge bg-secondary">{statusToString(articleInfo.status)}</span></div>
                <div className="small mt-2">Yes / No: {articleInfo.yes} / {articleInfo.no}</div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-3 d-flex gap-2">
          <button className="btn btn-success btn-sm" onClick={() => vote(true)} disabled={!canVote}>Vote Yes</button>
          <button className="btn btn-danger btn-sm" onClick={() => vote(false)} disabled={!canVote}>Vote No</button>
        </div>

        {statusMsg && <div className="mt-3"><div className="alert alert-info py-2">{statusMsg}</div></div>}
      </div>
    </div>
  );
}
