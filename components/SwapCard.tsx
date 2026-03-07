"use client"

import { useState, useEffect } from "react"
import { ArrowDown, ChevronDown, Wallet, Settings, Link2, BarChart3, Loader2, CheckCircle2, AlertCircle } from "lucide-react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { useWallet, useConnection } from "@solana/wallet-adapter-react"
import { VersionedTransaction, PublicKey } from "@solana/web3.js"
import { Raydium, TxVersion, DEVNET_PROGRAM_ID } from "@raydium-io/raydium-sdk-v2"
import BN from "bn.js"
import Decimal from "decimal.js"
import Image from "next/image"
import { ConnectWalletModal } from "@/components/ConnectWalletModal"
import { TokenSelectorModal, DEVNET_TOKENS, TokenInfo } from "@/components/liquidity/TokenSelectorModal"
import { useTokenBalances } from "@/hooks/useTokenBalances"

// ── Token Icons ────────────────────────────────────────────
function SwapTokenIcon({ token }: { token: TokenInfo }) {
    const [imgError, setImgError] = useState(false);

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
        );
    }

    // Fallback: colored circle with icon
    if (token.symbol === "SOL") {
        return (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#9945FF] to-[#14F195]">
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                    <path d="M5.5 17.5L8.5 14.5H18.5L15.5 17.5H5.5Z" fill="white" stroke="white" strokeWidth="0.5" />
                    <path d="M5.5 6.5L8.5 9.5H18.5L15.5 6.5H5.5Z" fill="white" stroke="white" strokeWidth="0.5" />
                    <path d="M5.5 12L8.5 9H18.5L15.5 12H5.5Z" fill="white" stroke="white" strokeWidth="0.5" />
                </svg>
            </div>
        );
    }

    return (
        <div className={`flex h-8 w-8 items-center justify-center rounded-full ${token.color}`}>
            <span className="text-lg">{token.icon}</span>
        </div>
    );
}

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

function GradientBorderField({
    label, token, amount, usdValue, balance, onAmountChange, onTokenSwitch, onMax, readOnly,
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
        if (b < 0.001 && b > 0) return "<0.001";
        if (b < 1) return b.toFixed(4);
        return b.toLocaleString(undefined, { maximumFractionDigits: 4 });
    };

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

// ── Slippage Modal ─────────────────────────────────────────
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
                <button onClick={handleSave} className="w-full rounded-xl bg-[var(--neon-teal)] py-3 text-sm font-bold text-black hover:opacity-90 transition-opacity">
                    Save
                </button>
            </DialogContent>
        </Dialog>
    )
}

// ── Main SwapCard ──────────────────────────────────────────
export default function SwapCard() {
    // Added signAllTransactions to intercept the native signing safely!
    const { connected, publicKey, signAllTransactions } = useWallet()
    const { connection } = useConnection()
    const { balances, discoveredTokens, loading: balancesLoading, getBalance, refetch: refetchBalances } = useTokenBalances()

    const defaultFrom = DEVNET_TOKENS.find(t => t.symbol === "SOL") || DEVNET_TOKENS[0]
    const defaultTo = DEVNET_TOKENS.find(t => t.symbol === "PLTR") || DEVNET_TOKENS[1]

    const [fromAmount, setFromAmount] = useState("")
    const [toAmount, setToAmount] = useState("")
    const [fromToken, setFromToken] = useState<TokenInfo>(defaultFrom)
    const [toToken, setToToken] = useState<TokenInfo>(defaultTo)
    const [slippage, setSlippage] = useState<string>("0.5")
    const [slippageOpen, setSlippageOpen] = useState<boolean>(false)
    const [walletModalOpen, setWalletModalOpen] = useState<boolean>(false)
    const [selectingFor, setSelectingFor] = useState<"from" | "to" | null>(null)

    const [loading, setLoading] = useState<boolean>(false)
    const [txSig, setTxSig] = useState<string | null>(null)
    const [swapError, setSwapError] = useState<string | null>(null)

    const fromBalance = getBalance(fromToken.mint)
    const toBalance = getBalance(toToken.mint)

    const balancesMap = new Map<string, number>();
    balances.forEach((tb, mint) => {
        balancesMap.set(mint, tb.balance);
    });

    // We fetch current pool price dynamically when amounts change
    const [currentPoolPrice, setCurrentPoolPrice] = useState<number | null>(null);

    // Dynamic quote fetcher
    useEffect(() => {
        const fetchRealQuote = async () => {
            if (!fromToken || !toToken || fromToken.mint === toToken.mint) return;
            try {
                const res = await fetch(`https://api-v3-devnet.raydium.io/pools/info/mint?mint1=${fromToken.mint}&mint2=${toToken.mint}&poolType=all&poolSortField=liquidity&sortType=desc&pageSize=1&page=1`);
                const json = await res.json();
                const pool = json?.data?.data?.[0];
                if (pool && pool.price) {
                    // Check if mint1 is our "from" token. If not, invert the price.
                    const isMint1 = pool.mintA.address === fromToken.mint;
                    setCurrentPoolPrice(isMint1 ? pool.price : 1 / pool.price);
                } else {
                    setCurrentPoolPrice(null); // No pool found
                }
            } catch (err) {
                console.error("Quote fetch error:", err);
            }
        };

        fetchRealQuote();
    }, [fromToken, toToken]);

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
        if (!val || isNaN(num) || num <= 0) {
            setToAmount("")
            return
        }

        // Apply real pool price if found, otherwise fallback to the visual dummy rate
        const rate = currentPoolPrice !== null
            ? currentPoolPrice
            : (fromToken.symbol === "SOL" ? 50 : fromToken.symbol === toToken.symbol ? 1 : 0.02);

        setToAmount((num * rate).toFixed(6))
    }

    const handleSwap = async () => {
        if (!connected || !publicKey) { setWalletModalOpen(true); return }
        if (!signAllTransactions) { setSwapError("Wallet does not support signing."); return }
        const amount = Number(fromAmount)
        if (!fromAmount || isNaN(amount) || amount <= 0) { setSwapError("Please enter a valid amount."); return }
        if (amount > fromBalance) { setSwapError(`Insufficient ${fromToken.symbol} balance.`); return }

        setLoading(true); setSwapError(null); setTxSig(null)

        try {
            const { DEVNET_PROGRAM_ID } = await import("@raydium-io/raydium-sdk-v2")
            const CLMM_PROGRAM = DEVNET_PROGRAM_ID.CLMM_PROGRAM_ID

            const sortedMints = [fromToken.mint, toToken.mint].sort()
            console.log("📡 Scanning on-chain for pool...", sortedMints[0], sortedMints[1])

            const accounts = await connection.getProgramAccounts(
                new PublicKey(CLMM_PROGRAM),
                {
                    filters: [
                        { dataSize: 1544 },
                        { memcmp: { offset: 73, bytes: sortedMints[0] } },
                        { memcmp: { offset: 105, bytes: sortedMints[1] } },
                    ]
                }
            )

            console.log("📡 Pools found on-chain:", accounts.length)
            if (accounts.length === 0) throw new Error(`No pool found for ${fromToken.symbol}/${toToken.symbol} on-chain.`)

            const poolId = accounts[0].pubkey.toBase58()
            console.log("✅ Pool ID:", poolId)

            const raydium = await Raydium.load({
                owner: publicKey,
                connection,
                cluster: "devnet",
                disableFeatureCheck: true,
                disableLoadToken: false,
                signAllTransactions,
            })
            console.log("✅ Raydium SDK Initialized")
            console.log("🔍 CLMM methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(raydium.clmm)))

            const clmmData = await raydium.clmm.getPoolInfoFromRpc(poolId)
            console.log("🔍 clmmData keys:", Object.keys(clmmData))
            console.log("🔍 poolInfo keys:", Object.keys(clmmData.poolInfo))
            console.log("🔍 tickData:", clmmData.tickData)
            console.log("🔍 computePoolInfo:", JSON.stringify(clmmData.computePoolInfo, null, 2))
            const poolInfo = clmmData.poolInfo
            const poolKeys = clmmData.poolKeys

            const amountIn = new BN(
                new Decimal(amount).mul(new Decimal(10).pow(fromToken.decimals)).toFixed(0)
            )

            const epochInfo = await connection.getEpochInfo()

            const computeRes = await (raydium.clmm as any).computeAmountOut({
                poolInfo: clmmData.poolInfo,
                tickArrayCache: clmmData.tickData,
                baseMint: fromToken.mint,
                quoteMint: toToken.mint,
                amountIn,
                slippage: parseFloat(slippage) / 100,
                epochInfo,
            } as any)

            const { execute } = await raydium.clmm.swap({
                poolInfo,
                poolKeys,
                ownerInfo: { useSOLBalance: fromToken.symbol === "SOL" || toToken.symbol === "SOL" },
                inputMint: new PublicKey(fromToken.mint),
                amountIn,
                amountOutMin: computeRes.minAmountOut,
                observationId: (poolInfo as any).observationId,
                remainingAccounts: computeRes.remainingAccounts,
                txVersion: TxVersion.V0,
            } as any)

            const result = await execute({ sendAndConfirm: true })
            const txId = (result as any).txIds?.[0] || (result as any).txId
            console.log("✅ Swap successful! TxId:", txId)
            setTxSig(txId)
            setTimeout(() => refetchBalances(), 2000)

        } catch (err: any) {
            console.error("❌ Swap Execution Failed:", err)
            const msg = err?.message || "Swap failed"
            setSwapError(msg.length > 120 ? msg.slice(0, 120) + "…" : msg)
        } finally {
            setLoading(false)
        }
    }

    const buttonLabel = () => {
        if (!connected) return "Connect Wallet to Swap"
        if (loading) return null
        if (!fromAmount || Number(fromAmount) <= 0) return "Enter an amount"
        if (Number(fromAmount) > fromBalance) return `Insufficient ${fromToken.symbol}`
        return "Swap"
    }

    const buttonDisabled = loading || (connected && (!fromAmount || Number(fromAmount) <= 0))

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
                            const maxBal = fromToken.symbol === "SOL" ? Math.max(0, fromBalance - 0.01) : fromBalance;
                            setFromAmount(maxBal.toString());
                            handleFromAmountChange(maxBal.toString());
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

                    {/* Error message */}
                    {swapError && (
                        <div className="mt-3 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            {swapError}
                        </div>
                    )}

                    {/* Success message */}
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
                        if (token.mint === toToken.mint) {
                            setToToken(fromToken); // swap them
                        }
                        setFromToken(token);
                    }
                    if (selectingFor === "to") {
                        if (token.mint === fromToken.mint) {
                            setFromToken(toToken); // swap them
                        }
                        setToToken(token);
                    }
                    setFromAmount("");
                    setToAmount("");
                }}
                balances={balancesMap}
                balancesLoading={balancesLoading}
                discoveredTokens={discoveredTokens}
            />
        </>
    )
}