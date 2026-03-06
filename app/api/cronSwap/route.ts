//app/api/cronSwap/route.tsx

import { NextResponse } from "next/server";
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import {
  Raydium,
  TxVersion,
  ApiV3PoolInfoConcentratedItem,
} from "@raydium-io/raydium-sdk-v2";
import BN from "bn.js";
import Decimal from "decimal.js";

// Reads from POOL_IDS env var (comma-separated) so you can add pools without redeploying.
// Falls back to the single known working pool.
const getTargetPools = (): string[] => {
  const envPools =
    process.env.POOL_IDS?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) || [];
  if (envPools.length > 0) return envPools;
  return [
    "Ed6FzPjRPmUDkrimShSACrV1wYKYVstjKSADue3vUT8k", // PLTR-LHMN 0.25%
  ];
};

export async function GET() {
  try {
    if (!process.env.BOT_PRIVATE_KEY) {
      return NextResponse.json(
        { error: "BOT_PRIVATE_KEY not configured" },
        { status: 400 },
      );
    }

    const connection = new Connection("https://api.devnet.solana.com");

    const wallet = Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(process.env.BOT_PRIVATE_KEY)),
    );

    console.log("🤖 Bot wallet:", wallet.publicKey.toString());

    // Safety check — stop if SOL too low
    const lamports = await connection.getBalance(wallet.publicKey);
    const solBalance = lamports / 1e9;
    console.log("💰 SOL balance:", solBalance);
    if (solBalance < 0.05) {
      return NextResponse.json(
        { error: "Bot SOL balance too low", solBalance },
        { status: 400 },
      );
    }

    // Load Raydium ONCE
    const raydium = await Raydium.load({
      connection,
      owner: wallet,
      cluster: "devnet",
      disableFeatureCheck: true,
      disableLoadToken: true,
      signAllTransactions: async (txs: unknown[]) => {
        return txs.map((tx) => {
          if (tx instanceof Transaction) {
            tx.sign(wallet);
          }
          return tx;
        });
      },
    });

    const TARGET_POOLS = getTargetPools();
    console.log(`🎯 Targeting ${TARGET_POOLS.length} pool(s)`);

    const results: unknown[] = [];

    for (const poolId of TARGET_POOLS) {
      try {
        console.log(`\n🔄 Pool: ${poolId.slice(0, 8)}...`);

        // Fetch pool info from Raydium devnet API
        const poolInfoList = await raydium.api.fetchPoolById({ ids: poolId });
        if (!poolInfoList || poolInfoList.length === 0 || !poolInfoList[0]) {
          console.log("⚠️ Pool not indexed yet, skipping");
          results.push({
            poolId,
            status: "skipped",
            reason: "not indexed by Raydium API yet",
          });
          continue;
        }

        const poolInfo = poolInfoList[0] as ApiV3PoolInfoConcentratedItem;
        console.log(
          `📊 ${poolInfo.mintA.symbol}/${poolInfo.mintB.symbol} | price=${poolInfo.price}`,
        );

        // Random direction to keep pool balanced over time
        const swapAtoB = Math.random() > 0.5;
        const inputMintAddress = swapAtoB
          ? poolInfo.mintA.address
          : poolInfo.mintB.address;
        const inputDecimals = swapAtoB
          ? poolInfo.mintA.decimals
          : poolInfo.mintB.decimals;
        const outputDecimals = swapAtoB
          ? poolInfo.mintB.decimals
          : poolInfo.mintA.decimals;
        const symIn = swapAtoB ? poolInfo.mintA.symbol : poolInfo.mintB.symbol;
        const symOut = swapAtoB ? poolInfo.mintB.symbol : poolInfo.mintA.symbol;

        // Small swap: 0.5–2 tokens — keeps price movement gentle
        const amountFloat = Math.random() * 1.5 + 0.5;
        const amountIn = new BN(
          new Decimal(amountFloat)
            .mul(new Decimal(10).pow(inputDecimals))
            .toFixed(0),
        );

        // amountOutMin = expected output * 0.9 (10% slippage tolerance for devnet)
        const poolPrice = swapAtoB ? poolInfo.price : 1 / poolInfo.price;
        const expectedOut = amountFloat * poolPrice;
        const amountOutMin = new BN(
          new Decimal(expectedOut * 0.9)
            .mul(new Decimal(10).pow(outputDecimals))
            .toFixed(0),
        );

        console.log(
          `↔️ ${amountFloat.toFixed(3)} ${symIn} → ~${expectedOut.toFixed(3)} ${symOut}`,
        );

        // Build + execute swap
        const { execute } = await raydium.clmm.swap({
          poolInfo,
          poolKeys: undefined,
          inputMint: new PublicKey(inputMintAddress),
          amountIn,
          amountOutMin,
          priceLimit: new Decimal(0),
          observationId: null,
          ownerInfo: { useSOLBalance: true },
          txVersion: TxVersion.LEGACY,
        } as unknown);

        await execute({ sendAndConfirm: true });

        console.log(`✅ Swap success: ${symIn}→${symOut}`);
        results.push({
          poolId,
          status: "success",
          direction: `${symIn}→${symOut}`,
          amount: amountFloat.toFixed(3),
        });
      } catch (poolErr: unknown) {
        console.error(`❌ Pool ${poolId.slice(0, 8)} failed:`, poolErr.message);
        results.push({ poolId, status: "failed", error: poolErr.message });
      }
    }

    return NextResponse.json({ success: true, solBalance, results });
  } catch (error: unknown) {
    console.error("❌ Bot error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
