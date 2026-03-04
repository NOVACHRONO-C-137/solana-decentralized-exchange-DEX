import { Connection, Keypair } from "@solana/web3.js"
import { Raydium, TxVersion, ApiV3PoolInfoConcentratedItem } from "@raydium-io/raydium-sdk-v2"
import BN from "bn.js"
import Decimal from "decimal.js"

// CONFIG — edit these
const POOL_IDS = [
    "Ed6FzPjRPmUDkrimShSACrV1wYKYVstjKSADue3vUT8k",
    "2sL6V9GfpD6rP9aWpAoJEKteNcE94zPBtCfgrJGdHUML",
    "71Yjqv83w73n92fEsvFncFjMVHFqdUGKcuhsvnbwp8SG",
]

const PRIVATE_KEY: number[] = [] // paste wallet secret key array here

// Ranges as multipliers of current price
// e.g. 0.5x to 2.0x means: if price=1000, range is 500–2000
const RANGE_MULTIPLIERS = [
    { lower: 0.50, upper: 2.00, amountA: 2 },
    { lower: 0.65, upper: 1.60, amountA: 2 },
    { lower: 0.75, upper: 1.40, amountA: 2 },
    { lower: 0.80, upper: 1.25, amountA: 2 },
    { lower: 0.85, upper: 1.20, amountA: 2 },
    { lower: 0.88, upper: 1.15, amountA: 2 },
    { lower: 0.90, upper: 1.12, amountA: 2 },
    { lower: 0.92, upper: 1.10, amountA: 2 },
    { lower: 0.94, upper: 1.08, amountA: 2 },
    { lower: 0.96, upper: 1.05, amountA: 2 },
]

async function seedPool(raydium: Raydium, poolId: string) {
    console.log(`\n🏊 Seeding pool: ${poolId.slice(0, 8)}...`)

    const poolInfoList = await raydium.api.fetchPoolById({ ids: poolId })
    if (!poolInfoList?.[0]) {
        console.log("⚠️ Pool not indexed, skipping")
        return
    }

    const poolInfo = poolInfoList[0] as ApiV3PoolInfoConcentratedItem
    const currentPrice = poolInfo.price
    const tickSpacing = (poolInfo as any).config?.tickSpacing || 60
    console.log(`📊 ${poolInfo.mintA.symbol}/${poolInfo.mintB.symbol} | price=${currentPrice} | tickSpacing=${tickSpacing}`)

    for (let i = 0; i < RANGE_MULTIPLIERS.length; i++) {
        const { lower, upper, amountA } = RANGE_MULTIPLIERS[i]
        const minPrice = currentPrice * lower
        const maxPrice = currentPrice * upper

        const tickLower = Math.floor(Math.floor(Math.log(minPrice) / Math.log(1.0001)) / tickSpacing) * tickSpacing
        const tickUpper = Math.floor(Math.floor(Math.log(maxPrice) / Math.log(1.0001)) / tickSpacing) * tickSpacing

        if (tickLower >= tickUpper) {
            console.log(`⚠️ Invalid ticks for range ${lower}–${upper}, skipping`)
            continue
        }

        const baseAmount = new BN(
            new Decimal(amountA).mul(new Decimal(10).pow(poolInfo.mintA.decimals)).toFixed(0)
        )

        console.log(`  [${i + 1}/${RANGE_MULTIPLIERS.length}] Range: ${minPrice.toFixed(4)}–${maxPrice.toFixed(4)} | ticks: ${tickLower}→${tickUpper}`)

        try {
            const { execute } = await raydium.clmm.openPositionFromBase({
                poolInfo,
                tickLower,
                tickUpper,
                base: "MintA",
                baseAmount,
                otherAmountMax: new BN("999999999999999"),
                txVersion: TxVersion.LEGACY,
            } as any)

            await execute({ sendAndConfirm: true })
            console.log(`  ✅ Position created`)
            await new Promise(r => setTimeout(r, 3000))

        } catch (err: any) {
            console.error(`  ❌ Failed:`, err.message)
        }
    }
}

async function main() {
    const connection = new Connection("https://api.devnet.solana.com")
    const wallet = Keypair.fromSecretKey(Uint8Array.from(PRIVATE_KEY))

    console.log("🌱 AeroDEX Liquidity Seeder")
    console.log("💳 Wallet:", wallet.publicKey.toString())

    const solBalance = await connection.getBalance(wallet.publicKey) / 1e9
    console.log("💰 SOL:", solBalance)
    if (solBalance < 0.5) {
        console.error("❌ Need at least 0.5 SOL")
        return
    }

    const raydium = await Raydium.load({
        connection,
        owner: wallet,
        cluster: "devnet",
        disableFeatureCheck: true,
        disableLoadToken: true,
    })

    for (const poolId of POOL_IDS) {
        await seedPool(raydium, poolId)
    }

    console.log("\n🎉 Seeding complete! Refresh your DEX to see chart bars.")
}

main().catch(console.error)
