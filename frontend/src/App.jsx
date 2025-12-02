// src/App.jsx
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import SubmitArticle from "./components/SubmitArticle";
import CheckStatus from "./components/CheckStatus";
import VoteArticle from "./components/VoteArticle";
import BlockViewer from "./components/BlockViewer";
import PublisherAdmin from "./components/PublisherAdmin";
import PubJson from "./abis/PublisherRegistry.json";
import { PUB_ADDRESS } from "./constants";
// Ensure bootstrap is imported in index.js: import "bootstrap/dist/css/bootstrap.min.css";

export default function App() {
  const [role, setRole] = useState("guest"); // guest | publisher | owner
  const [connectedAddress, setConnectedAddress] = useState(null);
  const [theme, setTheme] = useState("light");
  const [alert, setAlert] = useState(null); // { type, msg } or null
  const [checkingRole, setCheckingRole] = useState(false);
  const [viewKey, setViewKey] = useState(0); // used to force remount of main area when role changes

  function getProvider() {
    if (typeof window !== "undefined" && window.ethereum) {
      return new ethers.providers.Web3Provider(window.ethereum);
    }
    return new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545");
  }

  // wallet connect + events
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.ethereum) return;
    const eth = window.ethereum;
    const handleAccounts = (accounts) => {
      setConnectedAddress(accounts && accounts[0] ? accounts[0] : null);
      if (!accounts || accounts.length === 0) {
        setRole("guest");
        setViewKey(k => k + 1);
      }
    };
    eth.on && eth.on("accountsChanged", handleAccounts);
    eth.request({ method: "eth_accounts" }).then(accts => handleAccounts(accts)).catch(() => {});
    return () => { eth.removeListener && eth.removeListener("accountsChanged", handleAccounts); };
  }, []);

  useEffect(() => {
    document.body.classList.remove("theme-light", "theme-dark");
    document.body.classList.add(theme === "dark" ? "theme-dark" : "theme-light");
  }, [theme]);

  async function connectWallet() {
    if (!window.ethereum) {
      setAlert({ type: "warning", msg: "No web3 provider found. Install MetaMask or similar." });
      return;
    }
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      setConnectedAddress(accounts && accounts[0] ? accounts[0] : null);
      setAlert(null);
    } catch (e) {
      setAlert({ type: "danger", msg: "Wallet connection failed or was rejected." });
    }
  }

  function disconnectWallet() {
    setConnectedAddress(null);
    setRole("guest");
    setViewKey(k => k + 1);
    setAlert({ type: "info", msg: "Disconnected wallet — back to Guest view." });
  }

  async function isOwnerAddress(addr) {
    try {
      const provider = getProvider();
      const contract = new ethers.Contract(PUB_ADDRESS, PubJson.abi, provider);
      const owner = await contract.owner();
      return owner && owner.toLowerCase() === (addr || "").toLowerCase();
    } catch (e) {
      console.error("owner check failed", e);
      return false;
    }
  }

  async function isTrustedPublisher(addr) {
    try {
      const provider = getProvider();
      const contract = new ethers.Contract(PUB_ADDRESS, PubJson.abi, provider);
      const t = await contract.isTrusted(addr);
      return Boolean(t);
    } catch (e) {
      console.error("isTrusted check failed", e);
      return false;
    }
  }

  // Attempt to change role, but gate with wallet + on-chain checks.
  // ALSO force remount (viewKey) so components exclusive to old role unmount immediately.
  async function attemptSetRole(requestedRole) {
    setAlert(null);
    if (requestedRole === "guest") {
      setRole("guest");
      setViewKey(k => k + 1);
      return;
    }

    if (!connectedAddress) {
      setAlert({ type: "warning", msg: `You must connect your wallet to log in as ${requestedRole}.` });
      return;
    }

    setCheckingRole(true);
    try {
      if (requestedRole === "publisher") {
        const trusted = await isTrustedPublisher(connectedAddress);
        if (!trusted) {
          setAlert({
            type: "warning",
            msg: "Your connected account is NOT a trusted publisher. Ask the owner to add you as a trusted publisher.",
          });
          return;
        }
        setRole("publisher");
        setAlert({ type: "success", msg: "Logged in as Publisher." });
        setViewKey(k => k + 1);
      } else if (requestedRole === "owner") {
        const ownerOk = await isOwnerAddress(connectedAddress);
        if (!ownerOk) {
          setAlert({
            type: "warning",
            msg: "Connected wallet is not the contract owner. Connect the owner wallet to access Owner Dashboard.",
          });
          return;
        }
        setRole("owner");
        setAlert({ type: "success", msg: "Logged in as Owner." });
        setViewKey(k => k + 1);
      }
    } catch (e) {
      console.error("role check error", e);
      setAlert({ type: "danger", msg: "Role verification failed — see console." });
    } finally {
      setCheckingRole(false);
    }
  }

  const containerStyle = { maxWidth: 1200, margin: "24px auto", padding: 16 };

  return (
    <div className="container" style={containerStyle}>
      <header className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h1 className="h1 mb-0" style={{ fontFamily: "Pricedown, sans-serif" }}>Fake News Detection</h1>
          {/* <small className="text-muted text-uppercase">Role: <strong>{role}</strong></small> */}
          <small className="text-muted text-uppercase">Using <strong>BlockChain</strong></small>
        </div>

        <div className="d-flex align-items-center gap-2">
          <div className="me-2">
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title="Toggle theme"
            >
              {theme === "dark" ? "🌙 Dark" : "🌤 Light"}
            </button>
          </div>

          <div className="btn-group me-2" role="group" aria-label="roles">
            <button
              className={`btn btn-sm ${role === "guest" ? "btn-primary" : "btn-outline-primary"}`}
              onClick={() => attemptSetRole("guest")}
              disabled={checkingRole}
            >
              Guest
            </button>

            <button
              className={`btn btn-sm ${role === "publisher" ? "btn-primary" : "btn-outline-primary"}`}
              onClick={() => attemptSetRole("publisher")}
              disabled={checkingRole}
              title="Requires a trusted publisher wallet"
            >
              Login as Publisher
            </button>

            <button
              className={`btn btn-sm ${role === "owner" ? "btn-primary" : "btn-outline-primary"}`}
              onClick={() => attemptSetRole("owner")}
              disabled={checkingRole}
              title="Requires the contract owner wallet"
            >
              Login as Owner
            </button>
          </div>

          <div className="text-end">
            {connectedAddress ? (
              <div>
                <div className="small text-monospace">{connectedAddress}</div>
                <button className="btn btn-sm btn-outline-danger mt-1" onClick={disconnectWallet}>Disconnect</button>
              </div>
            ) : (
              <button className="btn btn-sm btn-success" onClick={connectWallet}>Connect Wallet</button>
            )}
          </div>
        </div>
      </header>

      {/* Alerts - we DO NOT override Bootstrap alert backgrounds; show message text only */}
      {alert && (
        <div className={`alert alert-${alert.type}`} role="alert">
          {alert.msg}
        </div>
      )}

      {/* Use viewKey to force remount when role changes so owner-only components unmount immediately */}
      <div key={viewKey}>
        {role === "guest" && (
          <main>
            <h2 className="h5">Home</h2>
            <p className="text-muted">As a guest you can submit a public article or check its status on-chain.</p>
            <div className="row gy-3">
              <div className="col-md-6"><SubmitArticle connectedAddress={connectedAddress} /></div>
              <div className="col-md-6"><CheckStatus connectedAddress={connectedAddress} /></div>
            </div>
          </main>
        )}

        {role === "publisher" && (
          <main>
            <h2 className="h5">Publisher Dashboard</h2>
            <p className="text-muted">Submit articles and vote on them as a trusted publisher.</p>
            <div className="row gy-3">
              <div className="col-lg-6"><SubmitArticle connectedAddress={connectedAddress} /></div>
              <div className="col-lg-6"><VoteArticle connectedAddress={connectedAddress} /></div>
              <div className="col-12"><CheckStatus connectedAddress={connectedAddress} /></div>
            </div>
          </main>
        )}

        {role === "owner" && (
          <main>
            <h2 className="h5">Owner Dashboard</h2>
            <p className="text-muted">Full owner controls including publisher admin and block viewer.</p>
            <div className="row gy-3">
              <div className="col-lg-6"><SubmitArticle connectedAddress={connectedAddress} /></div>
              <div className="col-lg-6"><VoteArticle connectedAddress={connectedAddress} /></div>
              <div className="col-lg-6"><PublisherAdmin connectedAddress={connectedAddress} /></div>
              <div className="col-lg-6"><CheckStatus connectedAddress={connectedAddress} /></div>
              <div className="col-12"><BlockViewer connectedAddress={connectedAddress} /></div>
            </div>
          </main>
        )}
      </div>

      <footer className="mt-4 small text-muted">
        Built for the Fake News Detection via Blockchain — By: Vaibhav & Sachin.
      </footer>

      {/* THEME CSS: keep alerts untouched (bootstrap default), add placeholder tuning for dark mode */}
      <style>{`
        body.theme-light { --bg: #f8fafc; --card-bg: #ffffff; --text: #0f1724; --muted: #475569; --input-bg: #fff; --card-border: rgba(15,23,36,0.06); }
        body.theme-dark  { --bg: #061022; --card-bg: #071828; --text: #e6eef8; --muted: #94a3b8; --input-bg: #071828; --card-border: rgba(255,255,255,0.04); }

        body.theme-light, body.theme-dark {
          background: var(--bg);
          color: var(--text);
        }

        .card {
          background: var(--card-bg) !important;
          color: var(--text) !important;
          border: 1px solid var(--card-border) !important;
        }

        .card .card-title { color: var(--text) !important; }
        .text-muted { color: var(--muted) !important; }

        .form-control, .form-select, textarea.form-control {
          background: var(--input-bg) !important;
          color: var(--text) !important;
          border: 1px solid var(--card-border) !important;
        }

        /* placeholder styles */
        body.theme-light ::placeholder {
          color: rgba(15,23,36,0.4);
        }
        body.theme-dark ::placeholder {
          color: rgba(230,238,248,0.45); /* slightly lighter for readability on dark backgrounds */
        }

        .text-monospace { font-family: monospace; font-size: 12px; color: var(--text); }
        .badge.bg-success, .badge.bg-danger, .badge.bg-warning, .badge.bg-secondary { color: #fff; }
      `}</style>
    </div>
  );
}
