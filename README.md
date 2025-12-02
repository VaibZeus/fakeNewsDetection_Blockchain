# Fake News Detection Using Blockchain

A decentralized system for verifying news authenticity using Ethereum smart contracts.

## 🚀 Overview

Fake news spreads quickly across digital platforms, creating large-scale misinformation. Traditional verification systems rely on centralized authorities, which are susceptible to manipulation.
This project solves the problem by using Blockchain, providing a transparent, immutable, and decentralized verification system.

Users can:

      Submit articles
      
      Vote on article authenticity
      
      Check article status
      
      View recent blockchain activity
      
      Manage trusted publishers (Owner only)

Built using:

    Solidity (Smart contracts)
    
    Hardhat (Testing & deployment)
    
    React.js + Bootstrap (Frontend)
    
    Ethers.js (Blockchain interaction)
    
    MetaMask (Wallet authentication)

## 🎯 Key Features
🔹 1. Article Submission

    Users submit text or a URL.
    
    A SHA-256 hash is generated.
    
    Blockchain stores the hash + metadata.
    
    Prevents duplicate submissions (pre-check included).

🔹 2. Voting System

    Only trusted publishers can vote.
    
    Each wallet can vote only once per article.
    
    Article status updates based on votes:

                              ✔ Verified True
                              
                              ❌ Marked Fake
                              
                              ⚠ Disputed
                              
                              ⌛ Under Review

🔹 3. Role-Based Access

    Role	Permissions:
        Guest	Submit article, check status
        Publisher	Submit article, vote
        Owner	All actions + add/remove publishers

    On login:

    System verifies wallet address
    Owners & publishers must be recognized on-chain

🔹 4. Block Viewer

      A professional, theme-aware block viewer showing:
      
      Block number, hash, timestamp
      
      Miner, nonce, gasUsed/gasLimit
      
      BaseFee (if available)
      
      Transaction previews with expandable details
      
      Refresh capability
      
      Automatic dark/light mode support

🔹 5. Dark / Light Mode UI

      Toggle between modern light and dark themes.

## 🛠️ Tech Stack
  Frontend:
  
    React.js
    
    Bootstrap 5
    
    Ethers.js
    
    MetaMask integration
  
  Blockchain:
  
    Solidity
    
    Hardhat
    
    JSON-RPC (Local Ethereum node)
  
  Tools:
  
    SHA-256 hashing (browser-native crypto)
    
    React state-based routing
    
    Component-level styling

## 📦 Installation & Setup
1. Clone the Repository
   
        git clone https://github.com/<your-username>/fake-news-detection-blockchain.git
        cd fake-news-detection-blockchain

2. Install Dependencies
   
        npm install

3. Install Hardhat

        npm install --save-dev hardhat

4. Start Local Blockchain Node

        npx hardhat node

5. Deploy Smart Contracts

  Open a new terminal:

      npx hardhat run scripts/deploy.js --network localhost


  Copy the generated contract addresses and update:

      src/constants.js

6. Start the Frontend

       npm run dev


Make sure MetaMask is connected to localhost:8545.

      📂 Project Structure
      ├── contracts
      │   ├── NewsRegistry.sol
      │   └── PublisherRegistry.sol
      ├── scripts
      │   └── deploy.js
      ├── frontend
      │   ├── src
      │   │   ├── components
      │   │   ├── abis
      │   │   ├── constants.js
      │   │   └── App.jsx
