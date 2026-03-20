"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronDown, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { TokenSelectorModal, TokenInfo, DEVNET_TOKENS } from "@/components/liquidity/TokenSelectorModal";
import { DateTimePicker } from "@/components/liquidity/DateTimePicker";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { Raydium, TxVersion, DEVNET_PROGRAM_ID } from "@raydium-io/raydium-sdk-v2";
import BN from "bn.js";
import Decimal from "decimal.js";
import { formatLargeNumber } from "@/lib/utils";
import { useTokenBalances } from "@/hooks/useTokenBalances";
import { createWrappedSignAll } from "@/lib/raydium-execute";

export default function StandardPoolPage() {
    const router = useRouter();
    const { publicKey, signAllTransactions, connected } = useWallet();
    const { connection } = useConnection();

    // Use token balances hook
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

    const [feeTierOpen, setFeeTierOpen] = useState<boolean>(false);
    const [feeTiers, setFeeTiers] = useState<any[]>([]);
    const [selectedFee, setSelectedFee] = useState<any>(null); // full config object

    const [startTime, setStartTime] = useState<"now" | "custom">("now");
    const [customStartTime, setCustomStartTime] = useState<Date>(() => {
        const d = new Date();
        d.setMinutes(d.getMinutes() + 10); // default to 10 mins from now
        return d;
    });

    // NEW STATE: Loading flow
    const [isCreating, setIsCreating] = useState(false);
    const [txError, setTxError] = useState<string | null>(null);
    const [txSig, setTxSig] = useState<string | null>(null);

    // Fetch CPMM configs on mount
    useEffect(() => {
        const fetchConfigs = async () => {
            try {
                const res = await fetch("https://api-v3-devnet.raydium.io/main/cpmm-config");
                const json = await res.json();
                if (json.success && json.data) {
                    setFeeTiers(json.data);
                    // Select default (often the one with tradeFeeRate ~ 2500 for 0.25%)
                    const defaultFee = json.data.find((f: any) => f.tradeFeeRate === 2500) || json.data[0];
                    setSelectedFee(defaultFee);
                }
            } catch (err) {
                console.error("Failed to fetch CPMM configs", err);
            }
        };
        fetchConfigs();
    }, []);

    const handleTokenSelect = (token: TokenInfo) => {
        if (activeSlot === "base") setBaseToken(token);
        if (activeSlot === "quote") setQuoteToken(token);
        setIsTokenModalOpen(false);
    };

    // Derived Balance Lookups
    const baseBalance = baseToken ? (tokenBalances.get(baseToken.mint)?.balance || 0) : 0;
    const quoteBalance = quoteToken ? (tokenBalances.get(quoteToken.mint)?.balance || 0) : 0;

    // --- Clean CPMM Math Handlers ---
    const handleBaseChange = (val: string) => {
        setBaseAmount(val);
        if (!val) return setQuoteAmount("");
        try {
            const b = new Decimal(val);
            const p = new Decimal(initialPrice);
            if (b.gt(0) && p.gt(0)) {
                // Base * Price = Quote
                setQuoteAmount(b.mul(p).toDecimalPlaces(quoteToken?.decimals || 6).toString());
            }
        } catch (e) { /* ignore incomplete math */ }
    };

    const handleQuoteChange = (val: string) => {
        setQuoteAmount(val);
        if (!val) return;
        try {
            const q = new Decimal(val);
            const b = new Decimal(baseAmount);
            if (q.gt(0) && b.gt(0)) {
                // Quote / Base = Price (Using 12 decimals to support micro-cap tokens)
                setInitialPrice(q.div(b).toDecimalPlaces(12).toString());
            }
        } catch (e) { }
    };

    const handlePriceChange = (val: string) => {
        setInitialPrice(val);
        if (!val) return;
        try {
            const p = new Decimal(val);
            const b = new Decimal(baseAmount);
            if (p.gt(0) && b.gt(0)) {
                // Base * Price = Quote
                setQuoteAmount(b.mul(p).toDecimalPlaces(quoteToken?.decimals || 6).toString());
            }
        } catch (e) { }
    };

    const handleSetPercentage = (pct: number, isBase: boolean) => {
        let bal = isBase ? baseBalance : quoteBalance;
        const mint = isBase ? (baseToken?.mint) : (quoteToken?.mint);

        if (mint === "11111111111111111111111111111111" || mint === "So11111111111111111111111111111111111111112") {
            if (pct === 1) bal = Math.max(0, bal - 0.02);
        }

        const val = (bal * pct).toFixed(isBase ? (baseToken?.decimals || 6) : (quoteToken?.decimals || 6));

        // Remove trailing zeroes from the string so it formats cleanly
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
        setIsCreating(true);
        setTxError(null);
        setTxSig(null);

        try {
            let manualTxId = "";
            const wrappedSignAll = await createWrappedSignAll(connection, signAllTransactions, (sig) => { manualTxId = sig; });

            const raydium = await Raydium.load({
                owner: publicKey,
                connection,
                cluster: "devnet",
                disableFeatureCheck: true,
                disableLoadToken: true,
                signAllTransactions: wrappedSignAll,
            });

            const mintA = {
                chainId: 103,
                address: baseToken.mint,
                programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
                logoURI: "",
                symbol: baseToken.symbol,
                name: baseToken.symbol,
                decimals: baseToken.decimals,
                tags: [],
                extensions: {},
            };
            const mintB = {
                chainId: 103,
                address: quoteToken.mint,
                programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
                logoURI: "",
                symbol: quoteToken.symbol,
                name: quoteToken.symbol,
                decimals: quoteToken.decimals,
                tags: [],
                extensions: {},
            };

            const amountA = new BN(new Decimal(baseAmount).mul(10 ** baseToken.decimals).toFixed(0));
            const amountB = new BN(new Decimal(quoteAmount).mul(10 ** quoteToken.decimals).toFixed(0));

            const feeConfig = {
                ...selectedFee,
                id: new PublicKey(selectedFee.id),
                fundOwner: "",
                description: "",
            };

            const startTimeSecs = new BN(
                startTime === "now"
                    ? 0
                    : Math.floor(customStartTime.getTime() / 1000)
            );

            const { execute: createCpmmPool, extInfo } = await raydium.cpmm.createPool({
                programId: DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM,
                poolFeeAccount: DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_FEE_ACC,
                mintA,
                mintB,
                mintAAmount: amountA,
                mintBAmount: amountB,
                startTime: startTimeSecs,
                feeConfig,
                associatedOnly: false,
                ownerInfo: { useSOLBalance: true },
                txVersion: TxVersion.V0,
                computeBudgetConfig: {
                    units: 600_000,
                    microLamports: 5_000,
                },
            });

            try {
                await createCpmmPool({ sendAndConfirm: true });
            } catch (e: any) {
                if (!manualTxId) throw e;
            }
            if (manualTxId) setTxSig(manualTxId);

            const poolIdStr = extInfo.address.poolId.toString();

            // Store custom pool locally so it appears in liquidity list immediately
            const stored = localStorage.getItem("aeroCustomPools");
            let customPools = [];
            try {
                if (stored) customPools = JSON.parse(stored);
            } catch (e) { }

            const newPool = {
                id: poolIdStr,
                name: `${baseToken.symbol}-${quoteToken.symbol}`,
                liquidity: `$${(parseFloat(baseAmount) + parseFloat(quoteAmount)).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                volume: `$0`,
                apr: `0%`,
                fee: `${selectedFee.tradeFeeRate / 10000}%`,
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
                type: "Standard",
            };

            customPools.push(newPool);
            localStorage.setItem("aeroCustomPools", JSON.stringify(customPools));

            // Small delay for UI feedback then redirect
            setTimeout(() => {
                router.push("/liquidity");
            }, 1000);

        } catch (err: any) {
            console.error(err);
            setTxError(err?.message || "Failed to create pool. Check console.");
        } finally {
            setIsCreating(false);
        }
    };

    const canInitialize = baseToken && quoteToken && initialPrice && baseAmount && quoteAmount && selectedFee && !isCreating;

    return (
        <main className="container mx-auto px-4 pt-24 pb-12 flex flex-col items-center min-h-screen text-foreground">
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
                            <span className="w-4 h-4 rounded-full border border-white/40 text-muted-foreground flex items-center justify-center text-[10px] mr-2">!</span>
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
                    <h2 className="text-xl font-bold mb-6">Initialize CPMM pool</h2>

                    <div className="bg-[rgba(220,240,232,0.45)] dark:bg-[rgba(255,255,255,0.03)] backdrop-blur-[6px] border border-black/[0.06] dark:border-[rgba(255,255,255,0.08)] shadow-[0_2px_16px_0_rgba(0,0,0,0.06)] dark:shadow-[0_2px_12px_0_rgba(0,0,0,0.12)] rounded-2xl p-6 flex flex-col gap-5">

                        {/* Initial Liquidity */}
                        <div>
                            <p className="text-sm font-bold mb-3">Initial liquidity</p>

                            {/* Base Token */}
                            <div className="bg-secondary/30 dark:bg-secondary/30 dark:bg-black/20 border border-border rounded-xl p-4 mb-1">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-xs text-muted-foreground">Base token</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground">{formatLargeNumber(baseBalance)}</span>
                                        <button onClick={() => handleSetPercentage(1, true)} className="text-xs bg-secondary dark:bg-white/5 hover:bg-secondary dark:hover:bg-secondary dark:bg-white/10 px-2 py-1 rounded-lg text-muted-foreground transition-all">Max</button>
                                        <button onClick={() => handleSetPercentage(0.5, true)} className="text-xs bg-secondary dark:bg-white/5 hover:bg-secondary dark:hover:bg-secondary dark:bg-white/10 px-2 py-1 rounded-lg text-muted-foreground transition-all">50%</button>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <button
                                        onClick={() => { setActiveSlot("base"); setIsTokenModalOpen(true); }}
                                        className="flex items-center gap-2 bg-secondary dark:bg-white/5 hover:bg-secondary dark:hover:bg-secondary dark:bg-white/10 px-3 py-2 rounded-xl transition-all"
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
                            <div className="flex justify-center my-1 z-10 relative">
                                <div className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground font-bold text-lg">
                                    +
                                </div>
                            </div>

                            {/* Quote Token */}
                            <div className="bg-secondary/30 dark:bg-secondary/30 dark:bg-black/20 border border-border rounded-xl p-4 mt-[-12px]">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-xs text-muted-foreground">Quote token</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground">{formatLargeNumber(quoteBalance)}</span>
                                        <button onClick={() => handleSetPercentage(1, false)} className="text-xs bg-secondary dark:bg-white/5 hover:bg-secondary dark:hover:bg-secondary dark:bg-white/10 px-2 py-1 rounded-lg text-muted-foreground transition-all">Max</button>
                                        <button onClick={() => handleSetPercentage(0.5, false)} className="text-xs bg-secondary dark:bg-white/5 hover:bg-secondary dark:hover:bg-secondary dark:bg-white/10 px-2 py-1 rounded-lg text-muted-foreground transition-all">50%</button>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <button
                                        onClick={() => { setActiveSlot("quote"); setIsTokenModalOpen(true); }}
                                        className="flex items-center gap-2 bg-secondary dark:bg-white/5 hover:bg-secondary dark:hover:bg-secondary dark:bg-white/10 px-3 py-2 rounded-xl transition-all"
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
                            <p className="text-sm font-bold mb-2">Initial price</p>
                            <div className="bg-secondary/30 dark:bg-secondary/30 dark:bg-black/20 border border-border rounded-xl px-4 py-3 flex justify-between items-center">
                                <input
                                    type="number"
                                    placeholder="Enter price"
                                    value={initialPrice}
                                    onChange={(e) => handlePriceChange(e.target.value)}
                                    className="bg-transparent text-lg font-bold text-foreground outline-none flex-1"
                                />
                                <span className="text-xs text-muted-foreground shrink-0">
                                    {quoteToken && baseToken ? `${quoteToken.symbol} per ${baseToken.symbol}` : "—"}
                                </span>
                            </div>
                            {baseToken && quoteToken && initialPrice && (
                                <p className="text-xs text-muted-foreground mt-2 text-right">
                                    Current price: <span className="text-muted-foreground">1 {baseToken.symbol} ≈ {initialPrice} {quoteToken.symbol}</span>
                                </p>
                            )}
                        </div>

                        {/* Fee Tier */}
                        <div>
                            <p className="text-sm font-bold mb-2">Fee Tier</p>
                            <div className="relative">
                                <div
                                    onClick={() => setFeeTierOpen(!feeTierOpen)}
                                    className="w-full bg-secondary/30 dark:bg-secondary/30 dark:bg-black/20 border border-border rounded-xl px-4 py-3 flex justify-between items-center cursor-pointer hover:border-border transition-all"
                                >
                                    <span className={`font-bold ${selectedFee ? "text-foreground" : "text-muted-foreground"}`}>
                                        {selectedFee ? `${selectedFee.tradeFeeRate / 10000}%` : "Loading devnet configs..."}
                                    </span>
                                    <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${feeTierOpen ? "rotate-180" : ""}`} />
                                </div>
                                {feeTierOpen && (
                                    <div className="absolute top-full left-0 w-full mt-1 bg-card border border-border rounded-xl overflow-hidden z-50">
                                        {feeTiers.map((tier, i) => (
                                            <div
                                                key={i}
                                                onClick={() => { setSelectedFee(tier); setFeeTierOpen(false); }}
                                                className="px-4 py-3 cursor-pointer hover:bg-secondary/60 dark:hover:bg-secondary dark:bg-white/5 transition-all font-medium text-foreground/70 hover:text-foreground"
                                            >
                                                {tier.tradeFeeRate / 10000}% ({tier.protocolFeeRate / 10000}% Protocol)
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Start Time */}
                        <div>
                            <p className="text-sm font-bold mb-2">Start time:</p>
                            <div className="flex bg-secondary/40 dark:bg-secondary/40 dark:bg-black/30 border border-border rounded-xl overflow-hidden">
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
                        <p className="text-xs text-yellow-400/80">
                            Note: A creation fee of ~0.2 SOL is required for new pools.{" "}
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
                                {isCreating ? (
                                    <>
                                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                        Creating Pool...
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