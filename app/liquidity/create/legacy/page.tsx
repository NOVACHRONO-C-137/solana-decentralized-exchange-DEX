"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronDown, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { TokenSelectorModal, TokenInfo } from "@/components/liquidity/TokenSelectorModal";
import { DateTimePicker } from "@/components/liquidity/DateTimePicker";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { Raydium, TxVersion, DEVNET_PROGRAM_ID } from "@raydium-io/raydium-sdk-v2";
import BN from "bn.js";
import Decimal from "decimal.js";
import { formatLargeNumber } from "@/lib/utils";
import { useTokenBalances } from "@/hooks/useTokenBalances";

export default function LegacyPoolPage() {
    const router = useRouter();
    const { publicKey, signAllTransactions, connected } = useWallet();
    const { connection } = useConnection();

    const { balances: tokenBalances, discoveredTokens, loading: balancesLoading } = useTokenBalances();
    const balancesMap = new Map<string, number>();
    tokenBalances.forEach((tb, mint) => balancesMap.set(mint, tb.balance));

    const [isTokenModalOpen, setIsTokenModalOpen] = useState<boolean>(false);
    const [activeSlot, setActiveSlot] = useState<"base" | "quote" | null>(null);
    const [baseToken, setBaseToken] = useState<TokenInfo | null>(null);
    const [quoteToken, setQuoteToken] = useState<TokenInfo | null>(null);
    const [baseAmount, setBaseAmount] = useState<string>("");
    const [quoteAmount, setQuoteAmount] = useState<string>("");
    const [initialPrice, setInitialPrice] = useState<string>("");
    const [startTime, setStartTime] = useState<"now" | "custom">("now");
    const [customStartTime, setCustomStartTime] = useState<Date>(() => {
        const d = new Date();
        d.setMinutes(d.getMinutes() + 10);
        return d;
    });

    const [isCreating, setIsCreating] = useState<"idle" | "market" | "pool">("idle");
    const [txError, setTxError] = useState<string | null>(null);
    const [txSig, setTxSig] = useState<string | null>(null);

    const checkExistingLegacyPool = async (tokenA: TokenInfo, tokenB: TokenInfo) => {
        try {
            const res = await fetch(
                `https://api-v3-devnet.raydium.io/pools/info/mint?mint1=${tokenA.mint}&mint2=${tokenB.mint}&poolType=standard&poolSortField=liquidity&sortType=desc&pageSize=1&page=1`
            );
            const data = await res.json();
            const pool = data?.data?.data?.[0];
            if (pool?.price) {
                setInitialPrice(pool.price.toString());
                console.log(`✅ Found existing pool price: ${pool.price}`);
            }
        } catch (err) {
            console.warn("Could not check existing pool:", err);
        }
    };

    const handleTokenSelect = (token: TokenInfo) => {
        let newBase = baseToken;
        let newQuote = quoteToken;
        if (activeSlot === "base") { setBaseToken(token); newBase = token; }
        if (activeSlot === "quote") { setQuoteToken(token); newQuote = token; }
        setIsTokenModalOpen(false);
        if (newBase && newQuote) checkExistingLegacyPool(newBase, newQuote);
    };

    const baseBalance = baseToken ? (tokenBalances.get(baseToken.mint)?.balance || 0) : 0;
    const quoteBalance = quoteToken ? (tokenBalances.get(quoteToken.mint)?.balance || 0) : 0;

    const handleBaseChange = (val: string) => {
        setBaseAmount(val);
        if (!val) return setQuoteAmount("");
        try {
            const b = new Decimal(val);
            const p = new Decimal(initialPrice);
            if (b.gt(0) && p.gt(0)) {
                setQuoteAmount(b.mul(p).toDecimalPlaces(quoteToken?.decimals || 6).toString());
            }
        } catch { }
    };

    const handleQuoteChange = (val: string) => {
        setQuoteAmount(val);
        if (!val) return;
        try {
            const q = new Decimal(val);
            const b = new Decimal(baseAmount);
            if (q.gt(0) && b.gt(0)) {
                setInitialPrice(q.div(b).toDecimalPlaces(12).toString());
            }
        } catch { }
    };

    const handlePriceChange = (val: string) => {
        setInitialPrice(val);
        if (!val) return;
        try {
            const p = new Decimal(val);
            const b = new Decimal(baseAmount);
            if (p.gt(0) && b.gt(0)) {
                setQuoteAmount(b.mul(p).toDecimalPlaces(quoteToken?.decimals || 6).toString());
            }
        } catch { }
    };

    const handleSetPercentage = (pct: number, isBase: boolean) => {
        let bal = isBase ? baseBalance : quoteBalance;
        const mint = isBase ? (baseToken?.mint) : (quoteToken?.mint);

        if (mint === "11111111111111111111111111111111" || mint === "So11111111111111111111111111111111111111112") {
            if (pct === 1) bal = Math.max(0, bal - 0.02);
        }

        const val = (bal * pct).toFixed(isBase ? (baseToken?.decimals || 6) : (quoteToken?.decimals || 6));
        let cleanVal = val;
        if (cleanVal.includes('.')) {
            cleanVal = cleanVal.replace(/\.?0+$/, "");
        }

        if (isBase) {
            handleBaseChange(cleanVal);
        } else {
            handleQuoteChange(cleanVal);
        }
    };

    const handleCreatePool = async () => {
        if (!connected || !publicKey) {
            setTxError("Please connect your wallet first.");
            return;
        }
        if (!canInitialize) return;
        setIsCreating("market");
        setTxError(null);
        setTxSig(null);

        try {
            const raydium = await Raydium.load({
                owner: publicKey,
                connection,
                cluster: "devnet",
                disableFeatureCheck: true,
                disableLoadToken: true,
                signAllTransactions: signAllTransactions as any,
            });

            const mintAInfo = {
                mint: new PublicKey(baseToken.mint),
                decimals: baseToken.decimals,
            };
            const mintBInfo = {
                mint: new PublicKey(quoteToken.mint),
                decimals: quoteToken.decimals,
            };

            // 1. Create Market
            const { execute: createMarket, extInfo: marketExtInfo } = await raydium.marketV2.create({
                baseInfo: mintAInfo,
                quoteInfo: mintBInfo,
                lotSize: 1,
                tickSize: 0.01,
                dexProgramId: DEVNET_PROGRAM_ID.OPEN_BOOK_PROGRAM,
                txVersion: TxVersion.LEGACY,
            });

            const { txIds: marketTxIds } = await createMarket({ sendAndConfirm: true, sequentially: true });
            const marketTxId = marketTxIds[0];
            console.log("✅ Market created:", marketTxId);

            // 2. Create Pool
            setIsCreating("pool");
            const marketId = marketExtInfo.address.marketId;
            const amountA = new BN(new Decimal(baseAmount).mul(10 ** baseToken.decimals).toFixed(0));
            const amountB = new BN(new Decimal(quoteAmount).mul(10 ** quoteToken.decimals).toFixed(0));

            const startTimeSecs = new BN(
                startTime === "now"
                    ? 0
                    : Math.floor(customStartTime.getTime() / 1000)
            );

            const { execute: createPool, extInfo } = await raydium.liquidity.createPoolV4({
                programId: DEVNET_PROGRAM_ID.AMM_V4,
                marketInfo: {
                    marketId,
                    programId: DEVNET_PROGRAM_ID.OPEN_BOOK_PROGRAM,
                },
                baseMintInfo: mintAInfo,
                quoteMintInfo: mintBInfo,
                baseAmount: amountA,
                quoteAmount: amountB,
                startTime: startTimeSecs,
                ownerInfo: {
                    useSOLBalance: true,
                },
                associatedOnly: false,
                txVersion: TxVersion.LEGACY,
                feeDestinationId: DEVNET_PROGRAM_ID.FEE_DESTINATION_ID,
            });

            const { txId: poolTxId } = await createPool({ sendAndConfirm: true });
            setTxSig(poolTxId);

            const poolIdStr = extInfo.address.ammId.toString();
            console.log("✅ Pool created:", poolTxId, "Pool ID:", poolIdStr);

            const stored = localStorage.getItem("aeroCustomPools");
            let customPools = [];
            try {
                if (stored) customPools = JSON.parse(stored);
            } catch (e) { }

            const usdValue = (parseFloat(baseAmount) * parseFloat(initialPrice)) + parseFloat(quoteAmount);
            const newPool = {
                id: poolIdStr,
                name: `${baseToken.symbol}-${quoteToken.symbol}`,
                liquidity: `$${usdValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                volume: `$0`,
                apr: `0%`,
                fee: `0.25%`,
                poolId: `${poolIdStr.slice(0, 6)}...${poolIdStr.slice(-4)}`,
                aprBreakdown: { tradeFees: "0%", yield: "0%" },
                symbolA: baseToken.symbol,
                symbolB: quoteToken.symbol,
                mintA: baseToken.mint,
                mintB: quoteToken.mint,
                decimalsA: baseToken.decimals,
                decimalsB: quoteToken.decimals,
                logoA: baseToken.logoURI,
                logoB: quoteToken.logoURI,
                type: "Legacy",
            };

            customPools.push(newPool);
            localStorage.setItem("aeroCustomPools", JSON.stringify(customPools));

            setIsCreating("idle");
            setTimeout(() => router.push("/liquidity"), 1000);

        } catch (err: any) {
            console.error(err);
            setTxError(err?.message || "Failed to create legacy pool.");
            setIsCreating("idle");
        }
    };

    const canInitialize = baseToken && quoteToken && initialPrice && baseAmount && quoteAmount && isCreating === "idle";

    return (
        <main className="container mx-auto px-4 py-12 flex flex-col items-center min-h-screen text-foreground">
            <div className="w-full max-w-5xl flex flex-col md:flex-row gap-8">

                {/* LEFT SIDEBAR */}
                <div className="w-full md:w-1/3 flex flex-col gap-4">
                    <button
                        onClick={() => router.back()}
                        className="flex items-center text-muted-foreground hover:text-foreground transition-colors w-fit mb-2"
                    >
                        <ChevronLeft className="h-5 w-5 mr-1" /> Back
                    </button>

                    <div className="bg-[rgba(220,240,232,0.45)] dark:bg-[rgba(255,255,255,0.03)] backdrop-blur-[6px] border border-black/[0.06] dark:border-[rgba(255,255,255,0.08)] shadow-[0_2px_16px_0_rgba(0,0,0,0.06)] dark:shadow-[0_2px_12px_0_rgba(0,0,0,0.12)] rounded-2xl p-5">
                        <h4 className="flex items-center text-sm font-bold mb-2">
                            <span className="w-4 h-4 rounded-full border border-border text-muted-foreground flex items-center justify-center text-[10px] mr-2">!</span>
                            Please Note
                        </h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            This tool is for advanced users. For detailed instructions, read the guide for{" "}
                            <span className="text-[var(--neon-teal)] cursor-pointer hover:underline">CLMM</span> or{" "}
                            <span className="text-[var(--neon-teal)] cursor-pointer hover:underline">Standard</span> pools.
                        </p>
                    </div>
                </div>

                {/* RIGHT SIDE */}
                <div className="w-full md:w-2/3">
                    <h2 className="text-xl font-bold mb-6">Initialize AMM v4 pool</h2>

                    <div className="bg-[rgba(220,240,232,0.45)] dark:bg-[rgba(255,255,255,0.03)] backdrop-blur-[6px] border border-black/[0.06] dark:border-[rgba(255,255,255,0.08)] shadow-[0_2px_16px_0_rgba(0,0,0,0.06)] dark:shadow-[0_2px_12px_0_rgba(0,0,0,0.12)] rounded-2xl p-6 flex flex-col gap-5">

                        {/* Initial Liquidity */}
                        <div>
                            <p className="text-sm font-bold mb-3">Initial liquidity</p>

                            {/* Base Token */}
                            <div className="bg-secondary/30 dark:bg-black/20 border border-border rounded-xl p-4 mb-1">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-xs text-muted-foreground">Base token</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground">{formatLargeNumber(baseBalance)}</span>
                                        <button onClick={() => handleSetPercentage(1, true)} className="text-xs bg-secondary/50 dark:bg-white/5 hover:bg-secondary dark:hover:bg-white/10 px-2 py-1 rounded-lg text-muted-foreground transition-all">Max</button>
                                        <button onClick={() => handleSetPercentage(0.5, true)} className="text-xs bg-secondary/50 dark:bg-white/5 hover:bg-secondary dark:hover:bg-white/10 px-2 py-1 rounded-lg text-muted-foreground transition-all">50%</button>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <button
                                        onClick={() => { setActiveSlot("base"); setIsTokenModalOpen(true); }}
                                        className="flex items-center gap-2 bg-secondary/50 dark:bg-white/5 hover:bg-secondary dark:hover:bg-white/10 px-3 py-2 rounded-xl transition-all"
                                    >
                                        {baseToken && (
                                            <div className="w-6 h-6 rounded-full overflow-hidden border">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src={baseToken.logoURI} alt={baseToken.symbol} className="w-full h-full object-cover bg-background" />
                                            </div>
                                        )}
                                        <span className="font-bold text-sm">{baseToken?.symbol || "Select"}</span>
                                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                    </button>
                                    <div className="text-right">
                                        <input
                                            type="number"
                                            placeholder="0"
                                            value={baseAmount}
                                            onChange={(e) => handleBaseChange(e.target.value)}
                                            className="bg-transparent text-2xl font-bold text-foreground outline-none text-right w-36"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Plus divider */}
                            <div className="flex justify-center my-1">
                                <div className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground font-bold text-lg">
                                    +
                                </div>
                            </div>

                            {/* Quote Token */}
                            <div className="bg-secondary/30 dark:bg-black/20 border border-border rounded-xl p-4">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-xs text-muted-foreground">Quote token</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground">{formatLargeNumber(quoteBalance)}</span>
                                        <button onClick={() => handleSetPercentage(1, false)} className="text-xs bg-secondary/50 dark:bg-white/5 hover:bg-secondary dark:hover:bg-white/10 px-2 py-1 rounded-lg text-muted-foreground transition-all">Max</button>
                                        <button onClick={() => handleSetPercentage(0.5, false)} className="text-xs bg-secondary/50 dark:bg-white/5 hover:bg-secondary dark:hover:bg-white/10 px-2 py-1 rounded-lg text-muted-foreground transition-all">50%</button>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <button
                                        onClick={() => { setActiveSlot("quote"); setIsTokenModalOpen(true); }}
                                        className="flex items-center gap-2 bg-secondary/50 dark:bg-white/5 hover:bg-secondary dark:hover:bg-white/10 px-3 py-2 rounded-xl transition-all"
                                    >
                                        {quoteToken && (
                                            <div className="w-6 h-6 rounded-full overflow-hidden border">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src={quoteToken.logoURI} alt={quoteToken.symbol} className="w-full h-full object-cover bg-background" />
                                            </div>
                                        )}
                                        <span className="font-bold text-sm">{quoteToken?.symbol || "Select"}</span>
                                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                    </button>
                                    <div className="text-right">
                                        <input
                                            type="number"
                                            placeholder="0"
                                            value={quoteAmount}
                                            onChange={(e) => handleQuoteChange(e.target.value)}
                                            className="bg-transparent text-2xl font-bold text-foreground outline-none text-right w-36"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Initial Price */}
                        <div>
                            <p className="text-sm font-bold mb-2 flex items-center gap-1">
                                Initial price
                                <span className="text-muted-foreground cursor-pointer hover:text-foreground text-xs">ⓘ</span>
                            </p>
                            <div className="bg-secondary/30 dark:bg-black/20 border border-border rounded-xl px-4 py-3 flex justify-between items-center">
                                <input
                                    type="number"
                                    placeholder="Enter price"
                                    value={initialPrice}
                                    onChange={(e) => handlePriceChange(e.target.value)}
                                    className="bg-transparent text-lg font-bold text-foreground outline-none flex-1"
                                />
                                <span className="text-xs text-muted-foreground shrink-0">
                                    {quoteToken && baseToken ? `${quoteToken.symbol}/${baseToken.symbol}` : "—"}
                                </span>
                            </div>
                            {baseToken && quoteToken && initialPrice && (
                                <p className="text-xs text-muted-foreground mt-2 text-right">
                                    Current price: <span className="text-muted-foreground">1 {baseToken.symbol} ≈ {initialPrice} {quoteToken.symbol}</span>
                                </p>
                            )}
                        </div>

                        {/* Start Time — Legacy has custom date/time display like screenshot */}
                        <div>
                            <p className="text-sm font-bold mb-2">Start time:</p>
                            <div className="flex bg-secondary/40 dark:bg-black/30 border border-border rounded-xl overflow-hidden mb-3">
                                <button
                                    onClick={() => setStartTime("now")}
                                    className={`flex-1 py-2.5 text-sm font-medium transition-all ${startTime === "now" ? "bg-[#0D9B5F]/20 text-foreground dark:bg-white/10 dark:text-white" : "text-muted-foreground hover:text-foreground"}`}
                                >
                                    Start Now
                                </button>
                                <button
                                    onClick={() => setStartTime("custom")}
                                    className={`flex-1 py-2.5 text-sm font-medium transition-all ${startTime === "custom" ? "bg-[#0D9B5F]/20 text-foreground dark:bg-white/10 dark:text-white" : "text-muted-foreground hover:text-foreground"}`}
                                >
                                    Custom
                                </button>
                            </div>

                            {startTime === "custom" && (
                                <DateTimePicker
                                    value={customStartTime}
                                    onChange={(d) => setCustomStartTime(d)}
                                />
                            )}
                        </div>

                        {/* Warning note */}
                        <p className="text-xs text-yellow-400/80 flex items-center gap-1">
                            Note: A creation fee of ~0.45 SOL is required for new pools.
                            <span className="text-muted-foreground cursor-pointer hover:text-foreground">ⓘ</span>
                        </p>

                        <div className="flex flex-col gap-2">
                            {/* Error */}
                            {txError && (
                                <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
                                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                                    {txError}
                                </div>
                            )}

                            {/* Success */}
                            {txSig && (
                                <div className="flex items-center gap-2 rounded-xl border border-[var(--neon-teal)]/20 bg-[var(--neon-teal)]/5 px-4 py-3 text-sm text-[var(--neon-teal)]">
                                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                                    <span>
                                        Pool created!{" "}
                                        <a href={`https://solscan.io/tx/${txSig}?cluster=devnet`} target="_blank" rel="noopener noreferrer"
                                            className="underline underline-offset-2 hover:opacity-80">
                                            View on Solscan
                                        </a>
                                    </span>
                                </div>
                            )}

                            {/* Submit */}
                            <button
                                onClick={handleCreatePool}
                                disabled={!canInitialize}
                                className={`w-full font-bold flex justify-center items-center py-4 rounded-xl transition-all ${canInitialize
                                    ? "bg-[var(--neon-teal)] text-black hover:opacity-90 cursor-pointer"
                                    : "bg-[var(--neon-teal)]/30 text-[var(--neon-teal)]/50 cursor-not-allowed"}`}
                            >
                                {isCreating !== "idle" ? (
                                    <>
                                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                        {isCreating === "market" ? "Creating OpenBook Market..." : "Initializing Pool..."}
                                    </>
                                ) : (
                                    "Initialize Liquidity Pool"
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <TokenSelectorModal
                isOpen={isTokenModalOpen}
                onClose={() => setIsTokenModalOpen(false)}
                onSelectToken={handleTokenSelect}
                balances={balancesMap}
                balancesLoading={balancesLoading}
                discoveredTokens={discoveredTokens}
            />
        </main>
    );
}