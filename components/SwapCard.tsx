"use client"

import { useState, useEffect, useRef, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { ArrowDown, ChevronDown, Wallet, Settings, Link2, BarChart3, Loader2, CheckCircle2, AlertCircle } from "lucide-react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { useWallet, useConnection } from "@solana/wallet-adapter-react"
import { PublicKey } from "@solana/web3.js"
import { Raydium, TxVersion, getPdaTickArrayAddress, CurveCalculator, PoolUtils } from "@raydium-io/raydium-sdk-v2"
import BN from "bn.js"
import Decimal from "decimal.js"
import Image from "next/image"
import { ConnectWalletModal } from "@/components/ConnectWalletModal"
import { TokenSelectorModal, DEVNET_TOKENS, TokenInfo } from "@/components/liquidity/TokenSelectorModal"
import { useTokenBalances } from "@/hooks/useTokenBalances"
import { notify } from "@/lib/toast"
import { logger } from "@/lib/logger"
import { resolveTokenFromMint } from "@/lib/token-metadata"

// ─────────────────────────────────────────────────────────────────────────────
// Constants — devnet program IDs
// ─────────────────────────────────────────────────────────────────────────────
const CLMM_PROGRAM_ID = "DRayAUgENGQBKVaX8owNhgzkEDyoHTGVEGHVJT1E9pfH"
const AMM_V4_PROGRAM_ID = "HWy1jotHpo6UqeQxx49dpYYdQB8wj9Qk9MdxwjLvDHB8"
const CPMM_PROGRAM_ID = "DRaycpLY18LhpbydsBWbVJtxpNv9oXPgjRSfpF2bWpYb"

// ─────────────────────────────────────────────────────────────────────────────
// Read the decimals byte directly from the SPL mint account.
// This is the ground truth — called inside handleSwap so it's ALWAYS correct
// regardless of what the token state says.
//
// SPL MintLayout byte layout:
//   [0..4]   mint_authority_option
//   [4..36]  mint_authority
//   [36..44] supply (u64)
//   [44]     decimals  ← this byte
// ─────────────────────────────────────────────────────────────────────────────
async function getMintDecimals(mint: string, connection: any): Promise<number> {
    try {
        const info = await connection.getAccountInfo(new PublicKey(mint))
        if (info?.data && info.data.length >= 45) return info.data[44]
    } catch { }
    return 6
}

// ─────────────────────────────────────────────────────────────────────────────
// Token icon
// ─────────────────────────────────────────────────────────────────────────────
function SwapTokenIcon({ token }: { token: TokenInfo }) {
    const [imgError, setImgError] = useState(false)

    if (token.logoURI && !imgError) {
        return (
            <div className="flex h-8 w-8 items-center justify-center rounded-full overflow-hidden">
                <Image src={token.logoURI} alt={token.symbol} width={32} height={32}
                    className="rounded-full object-cover" onError={() => setImgError(true)} unoptimized />
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
            <span className="text-sm font-bold text-white">{token.icon}</span>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Token selector button
// ─────────────────────────────────────────────────────────────────────────────
function TokenSelector({ token, onSwitch, locked }: { token: TokenInfo; onSwitch?: () => void; locked?: boolean }) {
    return (
        <button
            onClick={locked ? undefined : onSwitch}
            className={`flex items-center gap-2 rounded-full backdrop-blur-sm border px-3 py-2 transition-colors
                ${locked
                    ? "bg-black/[0.04] dark:bg-white/[0.03] border-black/[0.05] dark:border-white/[0.04] cursor-default"
                    : "bg-black/[0.07] dark:bg-white/[0.06] border-black/[0.08] dark:border-white/[0.06] hover:bg-black/[0.18] dark:hover:bg-white/[0.10]"
                }`}
        >
            <SwapTokenIcon token={token} />
            <span className="text-base sm:text-lg font-semibold text-foreground">{token.symbol}</span>
            {!locked && <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Input field
// ─────────────────────────────────────────────────────────────────────────────
function GradientBorderField({
    label, token, amount, balance,
    onAmountChange, onTokenSwitch, onMax, readOnly, locked,
}: {
    label: string; token: TokenInfo; amount: string; balance?: number;
    onAmountChange: (val: string) => void; onTokenSwitch?: () => void;
    onMax?: () => void; readOnly?: boolean; locked?: boolean;
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
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Wallet className="h-3.5 w-3.5" />
                        <span>{balance != null ? formatBal(balance) : "0"}</span>
                    </span>
                    {!readOnly && balance != null && balance > 0 && (
                        <>
                            <button onClick={onMax}
                                className="rounded-md bg-secondary/80 dark:bg-secondary/50 px-2 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
                                Max
                            </button>
                            <button onClick={() => onAmountChange(((balance || 0) / 2).toString())}
                                className="rounded-md bg-secondary/80 dark:bg-secondary/50 px-2 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
                                50%
                            </button>
                        </>
                    )}
                </div>
            </div>
            <div className="rounded-2xl border border-[#0D9B5F]/40 dark:border-[#14F195]/20">
                <div className="flex items-center justify-between rounded-2xl bg-[rgba(200,235,220,0.5)] dark:bg-white/[0.03] backdrop-blur-sm px-4 py-4">
                    <TokenSelector token={token} onSwitch={onTokenSwitch} locked={locked} />
                    <div className="flex flex-col items-end gap-0.5">
                        <input type="text" inputMode="decimal" pattern="^\d*\.?\d*$"
                            value={amount} onChange={(e) => onAmountChange(e.target.value)}
                            placeholder="0.00" readOnly={readOnly}
                            className="w-24 sm:w-28 bg-transparent text-right text-lg sm:text-xl font-semibold text-foreground placeholder:text-muted-foreground/50 focus:outline-none disabled:cursor-not-allowed"
                            onKeyDown={(e) => {
                                const allowed = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End', '.']
                                if (!allowed.includes(e.key) && !/^\d$/.test(e.key)) e.preventDefault()
                                if (e.key === '.' && e.currentTarget.value.includes('.')) e.preventDefault()
                            }} />
                    </div>
                </div>
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Slippage modal
// ─────────────────────────────────────────────────────────────────────────────
function SlippageModal({ isOpen, onClose, value, onChange }: {
    isOpen: boolean; onClose: () => void; value: string; onChange: (v: string) => void;
}) {
    const [localValue, setLocalValue] = useState(value)
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-[rgba(220,240,232,0.72)] dark:bg-[rgba(255,255,255,0.02)] backdrop-blur-[6px] border border-black/[0.06] dark:border-[rgba(255,255,255,0.06)] shadow-[0_2px_16px_0_rgba(0,0,0,0.06)] text-foreground w-[90vw] max-w-[280px] rounded-2xl p-4 sm:p-5 font-sans">
                <p className="text-base font-bold text-foreground mb-5">Slippage Settings</p>
                <div className="grid grid-cols-2 gap-2 mb-4">
                    {["0.1", "0.5", "1.0", "2.0"].map((v) => (
                        <button key={v} onClick={() => setLocalValue(v)}
                            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all border ${localValue === v
                                ? "border-[#2d7a5f] dark:border-[rgba(20,241,149,0.25)] text-[#1a5c45] dark:text-[rgba(20,241,149,0.9)] bg-[rgba(45,122,95,0.15)] dark:bg-[rgba(20,241,149,0.05)]"
                                : "border-black/[0.1] dark:border-[rgba(255,255,255,0.08)] text-muted-foreground"}`}>
                            {v}%
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-2 mb-5">
                    <input type="number" value={localValue} onChange={(e) => setLocalValue(e.target.value)}
                        className="flex-1 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)] rounded-xl px-4 py-3 text-sm font-mono focus:outline-none"
                        placeholder="0.5" step="0.1" />
                    <span className="text-muted-foreground text-sm">%</span>
                </div>
                <button onClick={() => { onChange(localValue); onClose(); }}
                    className="w-full bg-[#2d7a5f] hover:bg-[#235f4a] dark:bg-[rgba(20,241,149,0.15)] dark:hover:bg-[rgba(20,241,149,0.25)] text-white dark:text-[#14f195] border border-[#2d7a5f] dark:border-[rgba(20,241,149,0.25)] font-semibold py-3 rounded-xl transition-colors">
                    Save
                </button>
            </DialogContent>
        </Dialog>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
function SwapCardInner({ lockedTokens = false }: { lockedTokens?: boolean }) {
    const { connected, publicKey, signAllTransactions } = useWallet()
    const { connection } = useConnection()
    const { balances, discoveredTokens, loading: balancesLoading, getBalance, refetch: refetchBalances } = useTokenBalances()

    const searchParams = useSearchParams()
    const fromSymbol = searchParams.get("from") || "SOL"
    const toSymbol = searchParams.get("to") || "SOL"

    const [fromToken, setFromToken] = useState<TokenInfo>(
        DEVNET_TOKENS.find(t => t.symbol === fromSymbol) || DEVNET_TOKENS[0]
    )
    const [toToken, setToToken] = useState<TokenInfo>(
        DEVNET_TOKENS.find(t => t.symbol === toSymbol) || DEVNET_TOKENS[0]
    )
    // Track whether async token resolution is still in progress.
    // Swap button is disabled until both tokens are resolved.
    const [tokensResolving, setTokensResolving] = useState(
        !!(searchParams.get("fromMint") || searchParams.get("toMint"))
    )

    // ── PRIMARY: resolve from URL mint addresses ──────────────────────────────
    useEffect(() => {
        const urlFromMint = searchParams.get("fromMint")
        const urlToMint = searchParams.get("toMint")
        const urlFrom = searchParams.get("from") || ""
        const urlTo = searchParams.get("to") || ""

        if (!urlFromMint && !urlToMint) {
            setTokensResolving(false)
            return
        }

        setTokensResolving(true)
        const allLocal = [...DEVNET_TOKENS, ...discoveredTokens]

        const run = async () => {
            const [resolvedFrom, resolvedTo] = await Promise.all([
                urlFromMint
                    ? resolveTokenFromMint(urlFromMint, urlFrom, allLocal, connection)
                    : Promise.resolve(allLocal.find(t => t.symbol === urlFrom) || DEVNET_TOKENS[0]),
                urlToMint
                    ? resolveTokenFromMint(urlToMint, urlTo, allLocal, connection)
                    : Promise.resolve(allLocal.find(t => t.symbol === urlTo) || DEVNET_TOKENS[0]),
            ])
            setFromToken(resolvedFrom)
            setToToken(resolvedTo)
            setTokensResolving(false)
        }

        run()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams])

    // ── SECONDARY: plain /swap — update when wallet connects ─────────────────
    useEffect(() => {
        if (discoveredTokens.length === 0) return
        if (searchParams.get("fromMint") || searchParams.get("toMint")) return

        const allTokens = [...DEVNET_TOKENS, ...discoveredTokens]
        const urlFrom = searchParams.get("from")
        const urlTo = searchParams.get("to")
        if (urlFrom) { const f = allTokens.find(t => t.symbol === urlFrom); if (f) setFromToken(f) }
        if (urlTo) { const t = allTokens.find(t => t.symbol === urlTo); if (t) setToToken(t) }
    }, [discoveredTokens])

    const [fromAmount, setFromAmount] = useState("")
    const [toAmount, setToAmount] = useState("")
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

    // ── Live quote ────────────────────────────────────────────────────────────
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
                    setCurrentPoolPrice(pool.mintA.address === fromToken.mint ? pool.price : 1 / pool.price)
                } else {
                    setCurrentPoolPrice(null)
                }
            } catch { }
        }
        fetchQuote()
    }, [fromToken, toToken])

    const handleFlipTokens = () => {
        setFromToken(toToken); setToToken(fromToken)
        setFromAmount(toAmount); setToAmount(fromAmount)
        setTxSig(null); setSwapError(null); setCurrentPoolPrice(null)
    }

    const handleFromAmountChange = (val: string) => {
        if (val === "") { setFromAmount(""); setToAmount(""); setTxSig(null); setSwapError(null); return }
        if (!/^\d*\.?\d*$/.test(val)) return
        if ((val.match(/\./g) || []).length > 1) return
        setFromAmount(val); setTxSig(null); setSwapError(null)
        const num = Number(val)
        if (!val || isNaN(num) || num <= 0) { setToAmount(""); return }
        const rate = currentPoolPrice ?? 0.02
        setToAmount((num * rate).toFixed(6))
    }

    // ── Core swap ─────────────────────────────────────────────────────────────
    const handleSwap = async () => {
        if (!connected || !publicKey) { setWalletModalOpen(true); return }
        if (!signAllTransactions) {
            const msg = "Wallet does not support signing."; setSwapError(msg); notify.error(msg); return
        }
        const amount = Number(fromAmount)
        if (!fromAmount || isNaN(amount) || amount <= 0) {
            const msg = "Enter a valid amount."; setSwapError(msg); notify.error(msg); return
        }
        if (amount > fromBalance) {
            const msg = `Insufficient ${fromToken.symbol} balance.`; setSwapError(msg); notify.error(msg); return
        }

        setLoading(true); setSwapError(null); setTxSig(null)
        window.dispatchEvent(new CustomEvent('quantum-quake', { detail: { active: true } }));

        try {
            // ── CRITICAL: always fetch real decimals from chain right here ────
            // Never trust token state decimals — they may not have resolved yet
            // or may have been resolved before the fix was applied.
            const [fromDecimals, toDecimals] = await Promise.all([
                getMintDecimals(fromToken.mint, connection),
                getMintDecimals(toToken.mint, connection),
            ])
            logger.log(`Decimals — ${fromToken.symbol}: ${fromDecimals}, ${toToken.symbol}: ${toDecimals}`)

            const sorted = [fromToken.mint, toToken.mint].sort()
            let poolType: "clmm" | "amm" | "cpmm" | null = null
            let poolId = ""

            // CLMM
            const clmmHits = await connection.getProgramAccounts(new PublicKey(CLMM_PROGRAM_ID), {
                dataSlice: { offset: 0, length: 0 },
                filters: [{ dataSize: 1544 }, { memcmp: { offset: 73, bytes: sorted[0] } }, { memcmp: { offset: 105, bytes: sorted[1] } }],
            })
            if (clmmHits.length > 0) { poolType = "clmm"; poolId = clmmHits[0].pubkey.toBase58() }

            // CPMM
            if (!poolType) {
                for (const [m1, m2] of [[fromToken.mint, toToken.mint], [toToken.mint, fromToken.mint]]) {
                    const hits = await connection.getProgramAccounts(new PublicKey(CPMM_PROGRAM_ID), {
                        dataSlice: { offset: 0, length: 0 },
                        filters: [{ dataSize: 637 }, { memcmp: { offset: 168, bytes: m1 } }, { memcmp: { offset: 200, bytes: m2 } }],
                    })
                    if (hits.length > 0) { poolType = "cpmm"; poolId = hits[0].pubkey.toBase58(); break }
                }
            }

            // Legacy AMM v4
            if (!poolType) {
                for (const [m1, m2] of [[sorted[0], sorted[1]], [sorted[1], sorted[0]]]) {
                    const hits = await connection.getProgramAccounts(new PublicKey(AMM_V4_PROGRAM_ID), {
                        dataSlice: { offset: 0, length: 0 },
                        filters: [{ dataSize: 752 }, { memcmp: { offset: 400, bytes: m1 } }, { memcmp: { offset: 432, bytes: m2 } }],
                    })
                    if (hits.length > 0) { poolType = "amm"; poolId = hits[0].pubkey.toBase58(); break }
                }
            }

            if (!poolType) throw new Error(`No pool found for ${fromToken.symbol}/${toToken.symbol}.`)

            const raydium = await Raydium.load({
                owner: publicKey, connection, cluster: "devnet",
                disableFeatureCheck: true, disableLoadToken: false, signAllTransactions,
            })

            const slippageFraction = parseFloat(slippage) / 100

            // Use chain-fetched decimals, never token state
            const amountIn = new BN(
                new Decimal(amount).mul(new Decimal(10).pow(fromDecimals)).toFixed(0)
            )
            logger.log(`amountIn: ${amountIn.toString()} (${amount} × 10^${fromDecimals})`)

            if (poolType === "clmm") {
                const { poolInfo: _pi, poolKeys, tickData } = await raydium.clmm.getPoolInfoFromRpc(poolId)
                const poolInfo = _pi as any
                const slippageFraction = parseFloat(slippage) / 100
                const poolTickArray = (tickData as any)[poolId]
                const a2b = fromToken.mint === poolInfo.mintA.address

                let minAmountOut;
                let remainingAccounts;

                try {
                    // 🚨 CRITICAL BUG FIX FOR RAYDIUM SDK 🚨
                    // The SDK's 'getFirstInitializedTickArray' function expects 'id' and 'programId' to be PublicKey objects.
                    // However, the API returns them as plain strings. When the SDK tries to generate PDA addresses,
                    // it calls '.toBuffer()' on the string, causing the "e.toBuffer is not a function" crash!
                    // We fix this by injecting properly casted PublicKeys into a cloned poolInfo just for the computation.
                    const safeComputePoolInfo = {
                        ...poolInfo,
                        id: new PublicKey(poolInfo.id),
                        programId: new PublicKey(poolInfo.programId),
                    };

                    const computeRes = await PoolUtils.computeAmountOutFormat({
                        poolInfo: safeComputePoolInfo,
                        tickArrayCache: poolTickArray,
                        amountIn,
                        tokenOut: poolInfo[a2b ? 'mintB' : 'mintA'],
                        slippage: slippageFraction,
                        epochInfo: await connection.getEpochInfo(),
                    });

                    minAmountOut = computeRes.minAmountOut;
                    remainingAccounts = computeRes.remainingAccounts;
                } catch (computeErr: any) {
                    logger.log("CLMM Compute error:", computeErr);
                    throw new Error("Simulation failed: " + (computeErr.message || "Price impact too high for pool depth."));
                }

                // Safely extract the raw output amount based on SDK version structure
                const outMinRaw = (minAmountOut as any)?.amount?.raw ?? (minAmountOut as any)?.raw ?? minAmountOut
                const amountOutMin = new BN(outMinRaw.toString())

                logger.log(`CLMM SDK compute — amountOutMin: ${amountOutMin.toString()}`)

                const { execute } = await raydium.clmm.swap({
                    poolInfo,
                    poolKeys,
                    inputMint: new PublicKey(fromToken.mint),
                    amountIn,
                    amountOutMin,
                    observationId: poolInfo.observationId,
                    remainingAccounts, // The perfectly resolved accounts from computeRes
                    txVersion: TxVersion.V0,
                    ownerInfo: { useSOLBalance: fromToken.symbol === "SOL" || toToken.symbol === "SOL" },
                } as any)

                const result = await execute({ sendAndConfirm: true })
                setTxSig((result as any).txIds?.[0] ?? (result as any).txId)
                notify.success("Transaction confirmed!")

            } else if (poolType === "cpmm") {
                const { poolInfo, rpcData } = await raydium.cpmm.getPoolInfoFromRpc(poolId)
                const baseIn = fromToken.mint === poolInfo.mintA.address
                const swapResult = (CurveCalculator as any).swapBaseInput(
                    baseIn ? rpcData.baseReserve : rpcData.quoteReserve,
                    baseIn ? rpcData.quoteReserve : rpcData.baseReserve,
                    new BN((rpcData as any).configInfo?.tradeFeeRate ?? 2500),
                    amountIn, new BN(0),
                    new BN((rpcData as any).configInfo?.protocolFeeRate ?? 0),
                    new BN((rpcData as any).configInfo?.fundFeeRate ?? 0),
                )
                const { execute } = await raydium.cpmm.swap({
                    poolInfo, baseIn, swapResult, inputAmount: amountIn,
                    ownerInfo: { useSOLBalance: fromToken.symbol === "SOL" || toToken.symbol === "SOL" },
                    txVersion: TxVersion.V0,
                } as any)
                const result = await execute({ sendAndConfirm: true })
                setTxSig((result as any).txIds?.[0] ?? (result as any).txId)
                notify.success("Transaction confirmed!")

            } else {
                const { poolInfo: _pi, poolKeys } = await raydium.liquidity.getPoolInfoFromRpc({ poolId })
                const poolInfo = _pi as any
                const baseIn = fromToken.mint === poolInfo.baseMint.address
                const reserveIn = baseIn ? poolInfo.baseReserve : poolInfo.quoteReserve
                const reserveOut = baseIn ? poolInfo.quoteReserve : poolInfo.baseReserve
                const estOutBN = reserveOut.mul(amountIn).div(reserveIn.add(amountIn))
                const slipBps = Math.floor(slippageFraction * 10000)
                const amountOutMin = estOutBN.muln(10000 - slipBps).divn(10000)
                const { execute } = await raydium.liquidity.swap({
                    poolInfo, poolKeys, amountIn, amountOutMin,
                    inputMint: new PublicKey(fromToken.mint), fixedSide: "in", txVersion: TxVersion.V0,
                    ownerInfo: { useSOLBalance: fromToken.symbol === "SOL" || toToken.symbol === "SOL" },
                } as any)
                const result = await execute({ sendAndConfirm: true })
                setTxSig((result as any).txIds?.[0] ?? (result as any).txId)
                notify.success("Transaction confirmed!")
            }

            setTimeout(() => refetchBalances(), 2000)

        } catch (e: any) {
            let msg: string = e?.message ?? "Swap failed"
            if (e?.logs) {
                const failLog = (e.logs as string[]).find((l: string) => l.includes("Error") || l.includes("failed"))
                if (failLog) msg = failLog
            }
            if (msg.length > 160) msg = msg.slice(0, 160) + "…"
            setSwapError(msg); notify.error(msg)
        } finally {
            setLoading(false)
            window.dispatchEvent(new CustomEvent('quantum-quake', { detail: { active: false } }));
        }
    }

    const buttonLabel = () => {
        if (!connected) return "Connect Wallet to Swap"
        if (tokensResolving) return "Loading tokens…"
        if (loading) return null
        if (!fromAmount || Number(fromAmount) <= 0) return "Enter an amount"
        if (Number(fromAmount) > fromBalance) return `Insufficient ${fromToken.symbol}`
        return "Swap"
    }

    const buttonDisabled = loading || tokensResolving || (connected && (!fromAmount || Number(fromAmount) <= 0))

    return (
        <>
            <div className="w-full max-w-lg">
                <div className="mb-4 flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">Swap AIR</span>
                    <div className="flex items-center gap-3">
                        <button onClick={() => setSlippageOpen(true)}
                            className="flex items-center gap-1.5 rounded-full border border-white/20 bg-secondary/70 dark:bg-secondary/50 px-3 py-1.5 text-xs font-medium text-[var(--neon-teal)] transition-all hover:border-[var(--neon-teal)]/40 hover:bg-[var(--neon-teal)]/5">
                            <Settings className="h-3.5 w-3.5" />{slippage}%
                        </button>
                        <button className="text-muted-foreground transition-colors hover:text-foreground" aria-label="Share link"><Link2 className="h-4 w-4" /></button>
                        <button className="text-muted-foreground transition-colors hover:text-foreground" aria-label="Chart"><BarChart3 className="h-4 w-4" /></button>
                    </div>
                </div>

                <div className="rounded-3xl border border-black/[0.08] dark:border-white/[0.06] bg-[rgba(220,240,232,0.55)] dark:bg-white/[0.02] p-4 sm:p-5 shadow-lg shadow-black/[0.03] dark:shadow-black/20 backdrop-blur-md">
                    <GradientBorderField label="From" token={fromToken} amount={fromAmount}
                        balance={fromBalance}
                        onAmountChange={handleFromAmountChange}
                        onTokenSwitch={lockedTokens ? undefined : () => setSelectingFor("from")}
                        locked={lockedTokens}
                        onMax={() => {
                            const max = fromToken.symbol === "SOL" ? Math.max(0, fromBalance - 0.01) : fromBalance
                            setFromAmount(max.toString()); handleFromAmountChange(max.toString())
                        }} />

                    <div className="relative z-10 flex justify-center -my-3">
                        <button onClick={handleFlipTokens}
                            className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-border/50 bg-card dark:bg-secondary shadow-sm transition-all hover:scale-105 hover:shadow-md active:scale-95">
                            <ArrowDown className="h-4 w-4 text-foreground" />
                        </button>
                    </div>

                    <GradientBorderField label="To" token={toToken} amount={toAmount}
                        balance={toBalance}
                        onAmountChange={setToAmount}
                        onTokenSwitch={lockedTokens ? undefined : () => setSelectingFor("to")}
                        locked={lockedTokens}
                        readOnly />

                    {swapError && (
                        <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
                            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                            <span className="break-all">{swapError}</span>
                        </div>
                    )}

                    {txSig && (
                        <div className="mt-3 flex items-center gap-2 rounded-xl border border-[var(--neon-teal)]/20 bg-[var(--neon-teal)]/5 px-4 py-3 text-sm text-[var(--neon-teal)]">
                            <CheckCircle2 className="h-4 w-4 shrink-0" />
                            <span>Swap confirmed!{" "}
                                <a href={`https://solscan.io/tx/${txSig}?cluster=devnet`} target="_blank" rel="noopener noreferrer"
                                    className="underline underline-offset-2 hover:opacity-80">View on Solscan</a>
                            </span>
                        </div>
                    )}

                    <button onClick={handleSwap} disabled={buttonDisabled}
                        className="mt-5 w-full rounded-2xl bg-foreground py-4 text-center text-base font-semibold text-background transition-all hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2">
                        {loading
                            ? <><Loader2 className="h-5 w-5 animate-spin" />Swapping…</>
                            : tokensResolving
                                ? <><Loader2 className="h-5 w-5 animate-spin" />Loading tokens…</>
                                : buttonLabel()
                        }
                    </button>
                </div>
            </div>

            <SlippageModal isOpen={slippageOpen} onClose={() => setSlippageOpen(false)} value={slippage} onChange={setSlippage} />
            <ConnectWalletModal isOpen={walletModalOpen} onClose={() => setWalletModalOpen(false)} />

            <TokenSelectorModal
                isOpen={selectingFor !== null}
                onClose={() => setSelectingFor(null)}
                onSelectToken={(token) => {
                    if (selectingFor === "from") { if (token.mint === toToken.mint) setToToken(fromToken); setFromToken(token) }
                    if (selectingFor === "to") { if (token.mint === fromToken.mint) setFromToken(toToken); setToToken(token) }
                    setFromAmount(""); setToAmount("")
                    setCurrentPoolPrice(null); setSelectingFor(null)
                }}
                balances={balancesMap}
                balancesLoading={balancesLoading}
                discoveredTokens={discoveredTokens}
            />
        </>
    )
}

export default function SwapCard({ lockedTokens = false }: { lockedTokens?: boolean }) {
    return (
        <Suspense fallback={<div className="w-full max-w-lg h-64 rounded-3xl bg-card/70 animate-pulse" />}>
            <SwapCardInner lockedTokens={lockedTokens} />
        </Suspense>
    )
}