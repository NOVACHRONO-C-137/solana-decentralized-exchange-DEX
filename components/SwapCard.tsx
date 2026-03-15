"use client"

import { useState, useEffect } from "react"
import { ArrowDown, ChevronDown, Wallet, Settings, Link2, BarChart3, Loader2, CheckCircle2, AlertCircle } from "lucide-react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { useWallet, useConnection } from "@solana/wallet-adapter-react"
import { PublicKey } from "@solana/web3.js"
import { Raydium, TxVersion, getPdaTickArrayAddress, CurveCalculator } from "@raydium-io/raydium-sdk-v2"
import BN from "bn.js"
import Decimal from "decimal.js"
import Image from "next/image"
import { ConnectWalletModal } from "@/components/ConnectWalletModal"
import { TokenSelectorModal, DEVNET_TOKENS, TokenInfo } from "@/components/liquidity/TokenSelectorModal"
import { useTokenBalances } from "@/hooks/useTokenBalances"

// ─────────────────────────────────────────────────────────────────────────────
// Constants — devnet program IDs
// ─────────────────────────────────────────────────────────────────────────────
const CLMM_PROGRAM_ID = "DRayAUgENGQBKVaX8owNhgzkEDyoHTGVEGHVJT1E9pfH"
const AMM_V4_PROGRAM_ID = "HWy1jotHpo6UqeQxx49dpYYdQB8wj9Qk9MdxwjLvDHB8"
// Step 1: CPMM Program ID for devnet
const CPMM_PROGRAM_ID = "DRaycpLY18LhpbydsBWbVJtxpNv9oXPgjRSfpF2bWpYb"

// ─────────────────────────────────────────────────────────────────────────────
// Token icon
// ─────────────────────────────────────────────────────────────────────────────
function SwapTokenIcon({ token }: { token: TokenInfo }) {
    const [imgError, setImgError] = useState(false)

    if (token.logoURI && !imgError) {
        return (
            <div className="flex h-8 w-8 items-center justify-center rounded-full overflow-hidden">
                <Image
                    src={token.logoURI}
                    alt={token.symbol}
                    width={32}
                    height={32}
                    className="rounded-full object-cover"
                    onError={() => setImgError(true)}
                    unoptimized
                />
            </div>
        )
    }

    if (token.symbol === "SOL") {
        return (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#9945FF] to-[#14F195]">
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                    <path d="M5.5 17.5L8.5 14.5H18.5L15.5 17.5H5.5Z" fill="white" stroke="white" strokeWidth="0.5" />
                    <path d="M5.5 6.5L8.5 9.5H18.5L15.5 6.5H5.5Z" fill="white" stroke="white" strokeWidth="0.5" />
                    <path d="M5.5 12L8.5 9H18.5L15.5 12H5.5Z" fill="white" stroke="white" strokeWidth="0.5" />
                </svg>
            </div>
        )
    }

    return (
        <div className={`flex h-8 w-8 items-center justify-center rounded-full ${token.color}`}>
            <span className="text-lg">{token.icon}</span>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Token selector button
// ─────────────────────────────────────────────────────────────────────────────
function TokenSelector({ token, onSwitch }: { token: TokenInfo; onSwitch?: () => void }) {
    return (
        <button
            onClick={onSwitch}
            className="flex items-center gap-2 rounded-full bg-secondary/80 dark:bg-secondary/60 px-3 py-2 transition-colors hover:bg-secondary dark:hover:bg-secondary/80"
        >
            <SwapTokenIcon token={token} />
            <span className="text-lg font-semibold text-foreground">{token.symbol}</span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Input field
// ─────────────────────────────────────────────────────────────────────────────
function GradientBorderField({
    label, token, amount, usdValue, balance,
    onAmountChange, onTokenSwitch, onMax, readOnly,
}: {
    label: string
    token: TokenInfo
    amount: string
    usdValue: string
    balance?: number
    onAmountChange: (val: string) => void
    onTokenSwitch?: () => void
    onMax?: () => void
    readOnly?: boolean
}) {
    const formatBal = (b: number) => {
        if (b < 0.001 && b > 0) return "<0.001"
        if (b < 1) return b.toFixed(4)
        return b.toLocaleString(undefined, { maximumFractionDigits: 4 })
    }

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-1">
                <span className="text-sm font-medium text-muted-foreground">{label}</span>
                <div className="flex items-center gap-2">
                    <button className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
                        <Wallet className="h-3.5 w-3.5" />
                        <span>{balance != null ? formatBal(balance) : "0"}</span>
                    </button>
                    {!readOnly && balance != null && balance > 0 && (
                        <>
                            <button
                                onClick={onMax}
                                className="rounded-md bg-secondary/80 dark:bg-secondary/50 px-2 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                            >
                                Max
                            </button>
                            <button
                                onClick={() => onAmountChange(((balance || 0) / 2).toString())}
                                className="rounded-md bg-secondary/80 dark:bg-secondary/50 px-2 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                            >
                                50%
                            </button>
                        </>
                    )}
                </div>
            </div>
            <div className="rounded-2xl bg-gradient-to-r from-[#7c3aed] via-[#6366f1] to-[#3b82f6] p-[1.5px]">
                <div className="flex items-center justify-between rounded-[calc(1rem-1.5px)] bg-card/95 dark:bg-card/80 px-4 py-4 backdrop-blur-sm">
                    <TokenSelector token={token} onSwitch={onTokenSwitch} />
                    <div className="flex flex-col items-end gap-0.5">
                        <input
                            type="text"
                            value={amount}
                            onChange={(e) => onAmountChange(e.target.value)}
                            placeholder="0.00"
                            readOnly={readOnly}
                            className="w-28 bg-transparent text-right text-xl font-semibold text-foreground placeholder:text-muted-foreground/50 focus:outline-none disabled:cursor-not-allowed"
                        />
                        <span className="text-xs text-muted-foreground">~{usdValue}</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Slippage modal
// ─────────────────────────────────────────────────────────────────────────────
function SlippageModal({
    isOpen, onClose, value, onChange,
}: {
    isOpen: boolean
    onClose: () => void
    value: string
    onChange: (v: string) => void
}) {
    const [localValue, setLocalValue] = useState(value)

    const handleSave = () => {
        onChange(localValue)
        onClose()
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-[#11121a] text-white border-white/10 sm:max-w-[360px] rounded-2xl p-6 shadow-2xl font-sans">
                <div className="flex items-center justify-between mb-5">
                    <p className="text-base font-bold">Slippage Settings</p>
                </div>
                <div className="flex flex-wrap gap-2 mb-4">
                    {["0.1", "0.5", "1.0", "2.0"].map((v) => (
                        <button
                            key={v}
                            onClick={() => setLocalValue(v)}
                            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all border ${localValue === v
                                ? "bg-[var(--neon-teal)]/10 border-[var(--neon-teal)] text-[var(--neon-teal)]"
                                : "bg-white/5 border-white/10 text-white/70 hover:border-white/20"
                                }`}
                        >
                            {v}%
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-2 mb-5">
                    <input
                        type="number"
                        value={localValue}
                        onChange={(e) => setLocalValue(e.target.value)}
                        className="w-full rounded-xl bg-black/40 border border-white/10 py-3 px-4 text-sm text-white focus:outline-none focus:border-[var(--neon-teal)]"
                        placeholder="0.5"
                        step="0.1"
                    />
                    <span className="text-white/50 text-sm">%</span>
                </div>
                <button
                    onClick={handleSave}
                    className="w-full rounded-xl bg-[var(--neon-teal)] py-3 text-sm font-bold text-black hover:opacity-90 transition-opacity"
                >
                    Save
                </button>
            </DialogContent>
        </Dialog>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Debug logger — prefix every log with [AeroDEX] so they're easy to filter
// ─────────────────────────────────────────────────────────────────────────────
const log = (...args: any[]) => console.log("[AeroDEX]", ...args)
const warn = (...args: any[]) => console.warn("[AeroDEX]", ...args)
const err = (...args: any[]) => console.error("[AeroDEX]", ...args)

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export default function SwapCard() {
    const { connected, publicKey, signAllTransactions } = useWallet()
    const { connection } = useConnection()
    const {
        balances, discoveredTokens,
        loading: balancesLoading,
        getBalance, refetch: refetchBalances,
    } = useTokenBalances()

    const defaultFrom = DEVNET_TOKENS.find(t => t.symbol === "SOL") || DEVNET_TOKENS[0]
    const defaultTo = DEVNET_TOKENS.find(t => t.symbol === "PLTR") || DEVNET_TOKENS[1]

    const [fromAmount, setFromAmount] = useState("")
    const [toAmount, setToAmount] = useState("")
    const [fromToken, setFromToken] = useState<TokenInfo>(defaultFrom)
    const [toToken, setToToken] = useState<TokenInfo>(defaultTo)
    const [slippage, setSlippage] = useState("0.5")
    const [slippageOpen, setSlippageOpen] = useState(false)
    const [walletModalOpen, setWalletModalOpen] = useState(false)
    const [selectingFor, setSelectingFor] = useState<"from" | "to" | null>(null)
    const [loading, setLoading] = useState(false)
    const [txSig, setTxSig] = useState<string | null>(null)
    const [swapError, setSwapError] = useState<string | null>(null)
    const [currentPoolPrice, setCurrentPoolPrice] = useState<number | null>(null)

    const fromBalance = getBalance(fromToken.mint)
    const toBalance = getBalance(toToken.mint)

    const balancesMap = new Map<string, number>()
    balances.forEach((tb, mint) => balancesMap.set(mint, tb.balance))

    // ── Live quote ──────────────────────────────────────────────────────
    useEffect(() => {
        const fetchQuote = async () => {
            if (!fromToken || !toToken || fromToken.mint === toToken.mint) return
            try {
                const res = await fetch(
                    `https://api-v3-devnet.raydium.io/pools/info/mint?mint1=${fromToken.mint}&mint2=${toToken.mint}&poolType=all&poolSortField=liquidity&sortType=desc&pageSize=1&page=1`
                )
                const json = await res.json()
                const pool = json?.data?.data?.[0]
                if (pool?.price) {
                    const isMint1 = pool.mintA.address === fromToken.mint
                    setCurrentPoolPrice(isMint1 ? pool.price : 1 / pool.price)
                } else {
                    setCurrentPoolPrice(null)
                }
            } catch (e) {
                warn("Quote fetch failed:", e)
            }
        }
        fetchQuote()
    }, [fromToken, toToken])

    // ── UI helpers ──────────────────────────────────────────────────────
    const handleFlipTokens = () => {
        setFromToken(toToken)
        setToToken(fromToken)
        setFromAmount(toAmount)
        setToAmount(fromAmount)
        setTxSig(null)
        setSwapError(null)
    }

    const handleFromAmountChange = (val: string) => {
        setFromAmount(val)
        setTxSig(null)
        setSwapError(null)
        const num = Number(val)
        if (!val || isNaN(num) || num <= 0) { setToAmount(""); return }
        const rate = currentPoolPrice ?? (fromToken.symbol === "SOL" ? 50 : 0.02)
        setToAmount((num * rate).toFixed(6))
    }

    // ── Core swap ───────────────────────────────────────────────────────
    const handleSwap = async () => {
        if (!connected || !publicKey) { setWalletModalOpen(true); return }
        if (!signAllTransactions) { setSwapError("Wallet does not support signing."); return }
        const amount = Number(fromAmount)
        if (!fromAmount || isNaN(amount) || amount <= 0) { setSwapError("Enter a valid amount."); return }
        if (amount > fromBalance) { setSwapError(`Insufficient ${fromToken.symbol} balance.`); return }

        setLoading(true); setSwapError(null); setTxSig(null)

        try {
            // ── Step 1: discover pool ─────────────────────────────────
            // Mints must be sorted the same way the pool was created.
            // We try both orderings for AMM; CLMM always stores sorted mints.
            const sorted = [fromToken.mint, toToken.mint].sort()
            log("── STEP 1: Pool discovery ──────────────────────────────")
            log("fromMint:", fromToken.mint)
            log("toMint  :", toToken.mint)
            log("sorted  :", sorted)

            let poolType: "clmm" | "amm" | "cpmm" | null = null
            let poolId = ""

            // CLMM scan — state size 1544, mintA @ offset 73, mintB @ offset 105
            log("Scanning CLMM (dataSize=1544, offsets 73/105)...")
            const clmmHits = await connection.getProgramAccounts(
                new PublicKey(CLMM_PROGRAM_ID),
                {
                    dataSlice: { offset: 0, length: 0 },        // save bandwidth
                    filters: [
                        { dataSize: 1544 },
                        { memcmp: { offset: 73, bytes: sorted[0] } },
                        { memcmp: { offset: 105, bytes: sorted[1] } },
                    ],
                }
            )
            log(`CLMM hits: ${clmmHits.length}`)

            if (clmmHits.length > 0) {
                poolType = "clmm"
                poolId = clmmHits[0].pubkey.toBase58()
                log("✅ CLMM pool found:", poolId)
            }

            // ── NEW: CPMM scan — state size 637, mintA @ 168, mintB @ 200
            if (!poolType) {
                log("Scanning Standard AMM CPMM (dataSize=637, offsets 168/200)...")

                // Try both orderings because JS string sort might not match Rust byte sort!
                const orderings = [
                    [fromToken.mint, toToken.mint],
                    [toToken.mint, fromToken.mint]
                ];

                for (const [m1, m2] of orderings) {
                    const cpmmHits = await connection.getProgramAccounts(
                        new PublicKey(CPMM_PROGRAM_ID),
                        {
                            dataSlice: { offset: 0, length: 0 },
                            filters: [
                                { dataSize: 637 },
                                { memcmp: { offset: 168, bytes: m1 } },
                                { memcmp: { offset: 200, bytes: m2 } },
                            ],
                        }
                    )
                    log(`CPMM hits (${m1.slice(0, 4)}… / ${m2.slice(0, 4)}…): ${cpmmHits.length}`)

                    if (cpmmHits.length > 0) {
                        poolType = "cpmm"
                        poolId = cpmmHits[0].pubkey.toBase58()
                        log("✅ CPMM pool found:", poolId)
                        break
                    }
                }
            }

            // Legacy AMM v4 scan — state size 752, coinMint @ 400, pcMint @ 432
            // Try both orderings because creation order isn't guaranteed
            if (!poolType) {
                log("Scanning Legacy AMM v4 (dataSize=752, offsets 400/432)...")
                for (const [m1, m2] of [[sorted[0], sorted[1]], [sorted[1], sorted[0]]]) {
                    const ammHits = await connection.getProgramAccounts(
                        new PublicKey(AMM_V4_PROGRAM_ID),
                        {
                            dataSlice: { offset: 0, length: 0 },
                            filters: [
                                { dataSize: 752 },
                                { memcmp: { offset: 400, bytes: m1 } },
                                { memcmp: { offset: 432, bytes: m2 } },
                            ],
                        }
                    )
                    log(`AMM hits (${m1.slice(0, 8)}… / ${m2.slice(0, 8)}…): ${ammHits.length}`)
                    if (ammHits.length > 0) {
                        poolType = "amm"
                        poolId = ammHits[0].pubkey.toBase58()
                        log("✅ AMM v4 pool found:", poolId)
                        break
                    }
                }
            }

            if (!poolType) {
                throw new Error(
                    `No pool found for ${fromToken.symbol}/${toToken.symbol}.\n` +
                    `Checked CLMM (${CLMM_PROGRAM_ID.slice(0, 8)}…), CPMM (${CPMM_PROGRAM_ID.slice(0, 8)}…) and AMM v4 (${AMM_V4_PROGRAM_ID.slice(0, 8)}…).`
                )
            }

            // ── Step 2: init SDK ──────────────────────────────────────
            log("── STEP 2: Init Raydium SDK ────────────────────────────")
            const raydium = await Raydium.load({
                owner: publicKey,
                connection,
                cluster: "devnet",
                disableFeatureCheck: true,
                disableLoadToken: false,
                signAllTransactions,
            })
            log("✅ SDK ready")

            const slippageFraction = parseFloat(slippage) / 100
            const amountIn = new BN(
                new Decimal(amount)
                    .mul(new Decimal(10).pow(fromToken.decimals))
                    .toFixed(0)
            )
            log("amountIn (raw lamports):", amountIn.toString())
            log("slippage:", (slippageFraction * 100).toFixed(2) + "%")

            // ── Step 3a: CLMM swap ────────────────────────────────────
            if (poolType === "clmm") {
                log("── STEP 3a: CLMM swap ──────────────────────────────────")

                const clmmData = await raydium.clmm.getPoolInfoFromRpc(poolId)
                const { poolInfo: _poolInfo, poolKeys, tickData } = clmmData
                const poolInfo = _poolInfo as any

                log("poolInfo.mintA      :", poolInfo.mintA.address)
                log("poolInfo.mintB      :", poolInfo.mintB.address)
                log("poolInfo.tickCurrent:", poolInfo.tickCurrent)
                log("poolInfo.tickSpacing:", poolInfo.tickSpacing)
                log("poolInfo.currentPrice:", poolInfo.currentPrice?.toString())
                log("poolInfo.observationId:", (poolInfo as any).observationId)

                // Swap direction: a2b = selling mintA for mintB (price decreases)
                const a2b = fromToken.mint === poolInfo.mintA.address
                const tickSpacing = poolInfo.tickSpacing
                const ticksPerArr = tickSpacing * 60          // ticks per array
                const curTick = poolInfo.tickCurrent

                log(`Swap direction: ${a2b ? "A→B (a2b)" : "B→A (b2a)"}`)
                log(`ticksPerArray: ${ticksPerArr}`)

                // Anchor to the tick array that contains the current tick
                const anchorStart = Math.floor(curTick / ticksPerArr) * ticksPerArr
                log("anchorStart:", anchorStart)

                // 3 consecutive arrays in the direction of travel
                const neededIndexes: number[] = a2b
                    ? [anchorStart, anchorStart - ticksPerArr, anchorStart - ticksPerArr * 2]
                    : [anchorStart, anchorStart + ticksPerArr, anchorStart + ticksPerArr * 2]

                log("neededTickArrayIndexes:", neededIndexes)

                // Map of initialized arrays from tickData (keyed by pool ID → tick index → {address})
                const poolTickMap: Record<number, { address: PublicKey }> =
                    (tickData as any)[poolId] ?? {}
                const initIndexes = Object.keys(poolTickMap).map(Number)
                log("initializedTickArrayIndexes:", initIndexes)

                const clmmProgram = new PublicKey(CLMM_PROGRAM_ID)
                const poolPubkey = new PublicKey(poolId)

                const remainingAccounts = neededIndexes.map(idx => {
                    const entry = poolTickMap[idx]
                    if (entry?.address) {
                        log(`  tick[${idx}] → initialized: ${(entry.address as PublicKey).toBase58()}`)
                        return entry.address as PublicKey
                    }
                    // Not initialized — compute PDA; on-chain will skip uninitialised arrays
                    const { publicKey: pda } = getPdaTickArrayAddress(clmmProgram, poolPubkey, idx)
                    log(`  tick[${idx}] → PDA (uninit): ${pda.toBase58()}`)
                    return pda
                })

                // amountOutMin: price × amount × (1 − slippage)
                const rawPrice = parseFloat(poolInfo.currentPrice?.toString() ?? "1") || 1
                const estOut = a2b ? amount * rawPrice : amount / rawPrice
                const minOut = Math.max(0, estOut * (1 - slippageFraction))
                const amountOutMin = new BN(
                    new Decimal(minOut)
                        .mul(new Decimal(10).pow(toToken.decimals))
                        .toFixed(0)
                )
                log("estimated output :", estOut.toFixed(6), toToken.symbol)
                log("amountOutMin (raw):", amountOutMin.toString())

                log("Calling raydium.clmm.swap()...")
                const { execute } = await raydium.clmm.swap({
                    poolInfo,
                    poolKeys,
                    ownerInfo: {
                        useSOLBalance: fromToken.symbol === "SOL" || toToken.symbol === "SOL",
                    },
                    inputMint: new PublicKey(fromToken.mint),
                    amountIn,
                    amountOutMin,
                    observationId: (poolInfo as any).observationId,
                    remainingAccounts,
                    txVersion: TxVersion.V0,
                } as any)

                log("Sending CLMM swap transaction...")
                const result = await execute({ sendAndConfirm: true })
                const txId = (result as any).txIds?.[0] ?? (result as any).txId
                log("✅ CLMM swap confirmed! txId:", txId)
                setTxSig(txId)

                // ── Step 3b: CPMM (Standard AMM) swap ─────────────────────────
            } else if (poolType === "cpmm") {
                log("── STEP 3b: CPMM swap ──────────────────────────────────────")

                // Correct SDK pattern: getPoolInfoFromRpc returns { poolInfo, rpcData }
                // rpcData has baseReserve, quoteReserve, configInfo already as BN
                const { poolInfo, rpcData } = await raydium.cpmm.getPoolInfoFromRpc(poolId)

                log("poolInfo.mintA       :", poolInfo.mintA.address)
                log("poolInfo.mintB       :", poolInfo.mintB.address)
                log("rpcData.baseReserve  :", rpcData.baseReserve.toString())
                log("rpcData.quoteReserve :", rpcData.quoteReserve.toString())
                log("rpcData.configInfo.tradeFeeRate:", (rpcData as any).configInfo?.tradeFeeRate?.toString() ?? "default 2500")

                // baseIn = true → selling mintA, false → selling mintB
                const baseIn = fromToken.mint === poolInfo.mintA.address
                log(`Swap direction: ${baseIn ? "A→B (baseIn=true)" : "B→A (baseIn=false)"}`)

                // Use SDK's CurveCalculator — handles fees internally using configInfo.tradeFeeRate
                const swapResult = (CurveCalculator as any).swapBaseInput(
                    baseIn ? rpcData.baseReserve : rpcData.quoteReserve,
                    baseIn ? rpcData.quoteReserve : rpcData.baseReserve,
                    new BN((rpcData as any).configInfo?.tradeFeeRate ?? 2500),
                    amountIn,
                    new BN(0), // inputTokenFee
                    new BN((rpcData as any).configInfo?.protocolFeeRate ?? 0),
                    new BN((rpcData as any).configInfo?.fundFeeRate ?? 0),
                )

                log("swapResult.outputAmount (hex):", (swapResult as any).outputAmount)
                log("swapResult.tradeFee (hex)     :", (swapResult as any).tradeFee)

                const outputAmountBN = new BN((swapResult as any).outputAmount, 'hex')
                const slipBps = Math.floor(slippageFraction * 10000)
                const minAmountOut = outputAmountBN.muln(10000 - slipBps).divn(10000)
                log("outputAmount (decimal):", outputAmountBN.toString())
                log("minAmountOut (raw)    :", minAmountOut.toString())

                log("Calling raydium.cpmm.swap()...")
                const { execute } = await raydium.cpmm.swap({
                    poolInfo,
                    baseIn,
                    swapResult,
                    inputAmount: amountIn,
                    ownerInfo: {
                        useSOLBalance: fromToken.symbol === "SOL" || toToken.symbol === "SOL",
                    },
                    txVersion: TxVersion.V0,
                } as any)

                log("Sending CPMM swap transaction...")
                const result = await execute({ sendAndConfirm: true })
                const txId = (result as any).txIds?.[0] ?? (result as any).txId
                log("✅ CPMM swap confirmed! txId:", txId)
                setTxSig(txId)

                // ── Step 3c: Legacy AMM v4 swap ────────────────────────────
            } else {
                log("── STEP 3b: Legacy AMM v4 swap ─────────────────────────")

                const { poolInfo: _ammInfo, poolKeys } = await raydium.liquidity.getPoolInfoFromRpc({ poolId })
                const poolInfo = _ammInfo as any

                log("poolInfo.baseMint  :", poolInfo.baseMint.address)
                log("poolInfo.quoteMint :", poolInfo.quoteMint.address)
                log("poolInfo.baseReserve  :", poolInfo.baseReserve.toString())
                log("poolInfo.quoteReserve :", poolInfo.quoteReserve.toString())

                const baseIn = fromToken.mint === poolInfo.baseMint.address
                log(`Swap direction: ${baseIn ? "base→quote" : "quote→base"}`)

                const reserveIn = baseIn ? poolInfo.baseReserve : poolInfo.quoteReserve
                const reserveOut = baseIn ? poolInfo.quoteReserve : poolInfo.baseReserve

                // Constant-product: out = reserveOut * in / (reserveIn + in)
                const estOutBN = reserveOut.mul(amountIn).div(reserveIn.add(amountIn))
                const slipBps = Math.floor(slippageFraction * 10000)
                const amountOutMin = estOutBN.muln(10000 - slipBps).divn(10000)

                log("estOut (raw BN)    :", estOutBN.toString())
                log("slipBps            :", slipBps)
                log("amountOutMin (raw) :", amountOutMin.toString())

                log("Calling raydium.liquidity.swap()...")
                const { execute } = await raydium.liquidity.swap({
                    poolInfo,
                    poolKeys,
                    amountIn,
                    amountOutMin,
                    inputMint: new PublicKey(fromToken.mint),
                    fixedSide: "in",
                    txVersion: TxVersion.V0,
                    ownerInfo: {
                        useSOLBalance: fromToken.symbol === "SOL" || toToken.symbol === "SOL",
                    },
                } as any)

                log("Sending AMM v4 swap transaction...")
                const result = await execute({ sendAndConfirm: true })
                const txId = (result as any).txIds?.[0] ?? (result as any).txId
                log("✅ AMM v4 swap confirmed! txId:", txId)
                setTxSig(txId)
            }

            setTimeout(() => refetchBalances(), 2000)

        } catch (e: any) {
            err("Swap failed:", e)

            // Extract the most useful error string
            let msg: string = e?.message ?? "Swap failed"

            // Raydium SDK sometimes wraps the real error inside logs
            if (e?.logs) {
                const failLog = (e.logs as string[]).find((l: string) => l.includes("Error") || l.includes("failed"))
                if (failLog) msg = failLog
            }

            // Trim if very long
            if (msg.length > 160) msg = msg.slice(0, 160) + "…"
            setSwapError(msg)
        } finally {
            setLoading(false)
        }
    }

    // ── Button state ─────────────────────────────────────────────────
    const buttonLabel = () => {
        if (!connected) return "Connect Wallet to Swap"
        if (loading) return null
        if (!fromAmount || Number(fromAmount) <= 0) return "Enter an amount"
        if (Number(fromAmount) > fromBalance) return `Insufficient ${fromToken.symbol}`
        return "Swap"
    }

    const buttonDisabled =
        loading || (connected && (!fromAmount || Number(fromAmount) <= 0))

    // ── Render ───────────────────────────────────────────────────────
    return (
        <>
            <div className="w-full max-w-[420px]">
                {/* Top bar */}
                <div className="mb-4 flex items-center justify-between">
                    <button className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                        <Wallet className="h-4 w-4" />
                        Buy
                    </button>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setSlippageOpen(true)}
                            className="flex items-center gap-1.5 rounded-full border border-white/20 bg-secondary/70 dark:bg-secondary/50 px-3 py-1.5 text-xs font-medium text-[var(--neon-teal)] transition-all hover:border-[var(--neon-teal)]/40 hover:bg-[var(--neon-teal)]/5"
                        >
                            <Settings className="h-3.5 w-3.5" />
                            {slippage}%
                        </button>
                        <button className="text-muted-foreground transition-colors hover:text-foreground" aria-label="Share link">
                            <Link2 className="h-4 w-4" />
                        </button>
                        <button className="text-muted-foreground transition-colors hover:text-foreground" aria-label="Chart">
                            <BarChart3 className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* Card */}
                <div className="rounded-3xl border border-border/60 bg-card/70 dark:bg-white/[0.04] p-5 shadow-lg shadow-black/[0.03] dark:shadow-black/20 backdrop-blur-md">
                    <GradientBorderField
                        label="From"
                        token={fromToken}
                        amount={fromAmount}
                        usdValue="$0"
                        balance={fromBalance}
                        onAmountChange={handleFromAmountChange}
                        onTokenSwitch={() => setSelectingFor("from")}
                        onMax={() => {
                            const max = fromToken.symbol === "SOL"
                                ? Math.max(0, fromBalance - 0.01)
                                : fromBalance
                            setFromAmount(max.toString())
                            handleFromAmountChange(max.toString())
                        }}
                    />

                    <div className="relative z-10 flex justify-center -my-3">
                        <button
                            onClick={handleFlipTokens}
                            className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-border/50 bg-card dark:bg-secondary shadow-sm transition-all hover:scale-105 hover:shadow-md active:scale-95"
                        >
                            <ArrowDown className="h-4 w-4 text-foreground" />
                        </button>
                    </div>

                    <GradientBorderField
                        label="To"
                        token={toToken}
                        amount={toAmount}
                        usdValue="$0"
                        balance={toBalance}
                        onAmountChange={setToAmount}
                        onTokenSwitch={() => setSelectingFor("to")}
                        readOnly
                    />

                    {/* Error */}
                    {swapError && (
                        <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
                            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                            <span className="break-all">{swapError}</span>
                        </div>
                    )}

                    {/* Success */}
                    {txSig && (
                        <div className="mt-3 flex items-center gap-2 rounded-xl border border-[var(--neon-teal)]/20 bg-[var(--neon-teal)]/5 px-4 py-3 text-sm text-[var(--neon-teal)]">
                            <CheckCircle2 className="h-4 w-4 shrink-0" />
                            <span>
                                Swap confirmed!{" "}
                                <a
                                    href={`https://solscan.io/tx/${txSig}?cluster=devnet`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="underline underline-offset-2 hover:opacity-80"
                                >
                                    View on Solscan
                                </a>
                            </span>
                        </div>
                    )}

                    {/* Swap button */}
                    <button
                        onClick={handleSwap}
                        disabled={buttonDisabled}
                        className="mt-5 w-full rounded-2xl bg-foreground py-4 text-center text-base font-semibold text-background transition-all hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="h-5 w-5 animate-spin" />
                                Swapping…
                            </>
                        ) : (
                            buttonLabel()
                        )}
                    </button>
                </div>
            </div>

            <SlippageModal
                isOpen={slippageOpen}
                onClose={() => setSlippageOpen(false)}
                value={slippage}
                onChange={setSlippage}
            />

            <ConnectWalletModal
                isOpen={walletModalOpen}
                onClose={() => setWalletModalOpen(false)}
            />

            <TokenSelectorModal
                isOpen={selectingFor !== null}
                onClose={() => setSelectingFor(null)}
                onSelectToken={(token) => {
                    if (selectingFor === "from") {
                        if (token.mint === toToken.mint) setToToken(fromToken)
                        setFromToken(token)
                    }
                    if (selectingFor === "to") {
                        if (token.mint === fromToken.mint) setFromToken(toToken)
                        setToToken(token)
                    }
                    setFromAmount("")
                    setToAmount("")
                    setSelectingFor(null)
                }}
                balances={balancesMap}
                balancesLoading={balancesLoading}
                discoveredTokens={discoveredTokens}
            />
        </>
    )
}