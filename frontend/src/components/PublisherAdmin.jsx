// src/components/PublisherAdmin.jsx
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import PubJson from "../abis/PublisherRegistry.json";
import { PUB_ADDRESS } from "../constants";

function getProviderAndSigner() {
  if (typeof window !== "undefined" && window.ethereum) {
    const prov = new ethers.providers.Web3Provider(window.ethereum);
    return { provider: prov, signer: prov.getSigner() };
  }
  return { provider: new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545"), signer: null };
}

export default function PublisherAdmin({ connectedAddress }) {
  const [ownerAddress, setOwnerAddress] = useState(null);
  const [checkAddr, setCheckAddr] = useState("");
  const [checkResult, setCheckResult] = useState(null);
  const [inputAddr, setInputAddr] = useState("");
  const [message, setMessage] = useState("");
  const [trustedList, setTrustedList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    async function load() {
      try {
        const { provider } = getProviderAndSigner();
        const contract = new ethers.Contract(PUB_ADDRESS, PubJson.abi, provider);
        const owner = await contract.owner();
        setOwnerAddress(owner);

        const added = await contract.queryFilter(contract.filters.PublisherAdded(), 0, "latest");
        const removed = await contract.queryFilter(contract.filters.PublisherRemoved(), 0, "latest");
        const evts = [];
        for (const e of added) evts.push({ type: "add", addr: e.args[0], blockNumber: e.blockNumber, logIndex: e.logIndex });
        for (const e of removed) evts.push({ type: "remove", addr: e.args[0], blockNumber: e.blockNumber, logIndex: e.logIndex });
        evts.sort((a,b) => a.blockNumber - b.blockNumber || a.logIndex - b.logIndex);

        const map = new Map();
        for (const e of evts) {
          const a = e.addr.toLowerCase();
          if (e.type === "add") map.set(a, true);
          else if (e.type === "remove") map.delete(a);
        }
        setTrustedList(Array.from(map.keys()));
      } catch (e) {
        setMessage("Failed to load publisher registry: " + (e?.message || String(e)));
      }
    }
    load();
  }, [refreshKey]);

  async function checkAddress(addr) {
    setCheckResult(null);
    setMessage("");
    try {
      if (!ethers.utils.isAddress(addr)) { setMessage("Invalid address."); return; }
      const { provider } = getProviderAndSigner();
      const contract = new ethers.Contract(PUB_ADDRESS, PubJson.abi, provider);
      const isTrusted = await contract.isTrusted(addr);
      setCheckResult(Boolean(isTrusted));
    } catch (e) {
      setMessage("Failed to check address: " + (e?.message || String(e)));
    }
  }

  async function addPublisher() {
    setMessage("");
    if (!ethers.utils.isAddress(inputAddr)) { setMessage("Enter a valid address."); return; }
    try {
      const { signer } = getProviderAndSigner();
      if (!signer) { setMessage("Connect wallet as owner to manage publishers."); return; }
      const writeContract = new ethers.Contract(PUB_ADDRESS, PubJson.abi, signer);
      setLoading(true);
      const tx = await writeContract.addPublisher(inputAddr);
      setMessage("Tx sent: " + tx.hash);
      await tx.wait();
      setMessage("Publisher added: " + inputAddr);
      setInputAddr(""); setRefreshKey(k => k+1);
    } catch (e) {
      setMessage("Failed to add: " + (e?.message || String(e)));
    } finally {
      setLoading(false);
    }
  }

  async function removePublisher() {
    setMessage("");
    if (!ethers.utils.isAddress(inputAddr)) { setMessage("Enter a valid address."); return; }
    try {
      const { signer } = getProviderAndSigner();
      if (!signer) { setMessage("Connect wallet as owner to manage publishers."); return; }
      setLoading(true);
      const writeContract = new ethers.Contract(PUB_ADDRESS, PubJson.abi, signer);
      const tx = await writeContract.removePublisher(inputAddr);
      setMessage("Tx sent: " + tx.hash);
      await tx.wait();
      setMessage("Publisher removed: " + inputAddr);
      setInputAddr(""); setRefreshKey(k => k+1);
    } catch (e) {
      setMessage("Failed to remove: " + (e?.message || String(e)));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card h-100">
      <div className="card-body">
        <h5 className="card-title">Publisher Registry (Admin)</h5>

        {!connectedAddress && <div className="alert alert-warning">Connect wallet to manage publishers (owner only).</div>}

        <div className="mb-2 small"><strong>Contract:</strong> <span className="text-monospace">{PUB_ADDRESS}</span></div>
        <div className="mb-2 small"><strong>Owner:</strong> <span className="text-monospace">{ownerAddress ?? "loading..."}</span></div>

        <div className="mb-3">
          <label className="form-label small">Check address</label>
          <div className="input-group input-group-sm">
            <input className="form-control" value={checkAddr} onChange={e => setCheckAddr(e.target.value)} placeholder="0x..." />
            <button className="btn btn-outline-primary" onClick={() => checkAddress(checkAddr)}>Check</button>
          </div>
          {checkResult !== null && <div className="mt-2"><span className={`badge ${checkResult ? "bg-success" : "bg-danger"}`}>{checkResult ? "Trusted" : "Not trusted"}</span></div>}
        </div>

        <div className="mb-3">
          <label className="form-label small">Add / Remove publisher (owner)</label>
          <div className="input-group input-group-sm">
            <input className="form-control" value={inputAddr} onChange={e => setInputAddr(e.target.value)} placeholder="0xPublisherAddress" />
            <button className="btn btn-outline-success" onClick={addPublisher} disabled={loading || !connectedAddress}>Add</button>
            <button className="btn btn-outline-danger" onClick={removePublisher} disabled={loading || !connectedAddress}>Remove</button>
          </div>
        </div>

        {message && <div className="alert alert-info">{message}</div>}

        <div>
          <strong>Trusted list</strong>
          <div className="mt-2 small">
            {trustedList.length === 0 ? <div className="text-muted">No trusted publishers found.</div> :
              trustedList.map((a) => <div key={a}><span className="text-monospace">{a}</span></div>)}
          </div>
        </div>
      </div>
    </div>
  );
}
