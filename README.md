# NOVADEX - Solana Decentralized Exchange

Web3 application designed to demonstrate the full lifecycle of token swapping and liquidity management on the Solana Blockchain. 

---

## Technology Stack & Programs Used

* **Frontend:** Next.js 14 (App Router), React 18, Tailwind CSS, Lucide Icons.
* **Web3 Integration:** `@solana/web3.js`, `@solana/wallet-adapter-react`.
* **DEX Engine:** `@raydium-io/raydium-sdk-v2`.
* **Solana Programs Interacted With:**
  * **Raydium CLMM Program:** For Concentrated Liquidity pools (custom price ranges) [DRayAUgENGQBKVaX8owNhgzkEDyoHTGVEGHVJT1E9pfH](https://solscan.io/account/DRayAUgENGQBKVaX8owNhgzkEDyoHTGVEGHVJT1E9pfH?cluster=devnet).
  * **Raydium CPMM Program:** For standard Constant Product Market Maker pools. [DRaycpLY18LhpbydsBWbVJtxpNv9oXPgjRSfpF2bWpYb](https://solscan.io/account/DRaycpLY18LhpbydsBWbVJtxpNv9oXPgjRSfpF2bWpYb?cluster=devnet).
  * **Raydium AMM V4 Program:** For legacy liquidity pools, you need extra sol for this. [675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8](https://solscan.io/account/675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8?cluster=devnet).

---

## How to Use

Make sure you have a Solana wallet (like Phantom or Solflare) installed in your browser extensions and have it switched to **Developer Mode -> Devnet**. You will need some free Devnet SOL from the [Solana Faucet](https://faucet.solana.com/) to pay for gas fees.

### Step 1: Connect Your Wallet
Click the "Connect Wallet" button in the navigation bar. Ensure your wallet network is explicitly set to **Solana Devnet**.

### Step 2: Swap Tokens
Navigate to the Swap interface. 
1. Select the token you want to trade and the token you want to receive.
2. The app will automatically fetch the best on-chain pool routing.
3. Click "Swap" and approve the signature in your wallet.

### Step 3: Provide Liquidity (Earn Fees)
Navigate to the **Pools** section to become a Liquidity Provider (LP).
1. Choose between **Standard (CPMM)** or **Concentrated (CLMM)** liquidity.
2. If using CLMM, set your custom Minimum and Maximum price tick ranges.
3. Deposit your token pairs to mint LP tokens or open an NFT position.

### Step 4: Manage & Withdraw Liquidity
Go to the **Portfolio / Withdraw** page to view your active positions.
1. View your earned fees and current liquidity units.
2. Select a position to either withdraw a percentage of your liquidity or completely close the position to reclaim your rent SOL.

---

## Local Development

If you want to run this project locally on your machine:

1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install --legacy-peer-deps
