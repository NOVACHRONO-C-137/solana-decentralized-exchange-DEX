// app/liquidity/create/clmm/page.tsx


"use client";


import { useState } from "react";
import { ChevronDown, Minus, Plus, Pencil, Loader2, CheckCircle2, AlertCircle, Check } from "lucide-react";
import { StepperSidebar } from "@/components/liquidity/StepperSidebar";
import { useRouter } from "next/navigation";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { Raydium, TxVersion, DEVNET_PROGRAM_ID, TickUtils, ApiV3Token } from "@raydium-io/raydium-sdk-v2"
import Decimal from "decimal.js";
import BN from "bn.js";
import { formatLargeNumber } from "@/lib/utils";
import { TokenSelectorModal, TokenInfo } from "@/components/liquidity/TokenSelectorModal"
import { useTokenBalances } from "@/hooks/useTokenBalances"
import TokenIcon from "@/components/liquidity/TokenIcon";
import { notify } from "@/lib/toast";
import { createWrappedSignAll } from "@/lib/raydium-execute";


// ── Fee tier config ───────────────────────────────────────
// label shown in UI → fee rate in bps (hundredths of a percent × 100)
const FEE_TIERS = [
    { label: "0.01%", bps: 100 },
    { label: "0.05%", bps: 500 },
    { label: "0.25%", bps: 2500 },
]

// ─────────────────────────────────────────────────────────
export default function CreatePoolPage() {
    const router = useRouter();
    const { publicKey, sendTransaction, signAllTransactions, connected } = useWallet();
    const { connection } = useConnection();
    const { balances: tokenBalances, discoveredTokens, loading: balancesLoading } = useTokenBalances();
    const balancesMap = new Map<string, number>();
    tokenBalances.forEach((tb, mint) => balancesMap.set(mint, tb.balance));

    const [currentStep, setCurrentStep] = useState<number>(1);

    // Step 1 state
    const [isTokenModalOpen, setIsTokenModalOpen] = useState<boolean>(false);
    const [activeSelectionSlot, setActiveSelectionSlot] = useState<"base" | "quote" | null>(null);
    const [baseToken, setBaseToken] = useState<TokenInfo | null>(null);
    const [quoteToken, setQuoteToken] = useState<TokenInfo | null>(null);
    const [feeTierOpen, setFeeTierOpen] = useState<boolean>(false);
    const [selectedFee, setSelectedFee] = useState(FEE_TIERS[2]); // default 0.04%

    // Step 2 state
    const [priceBase, setPriceBase] = useState<"base" | "quote">("base");
    const [initialPrice, setInitialPrice] = useState<string>("1");
    const [priceRangeMode, setPriceRangeMode] = useState<"full" | "custom">("full");
    const [minPrice, setMinPrice] = useState<string>("0.5000");
    const [maxPrice, setMaxPrice] = useState<string>("2.0000");

    // Step 3 state
    const [depositA, setDepositA] = useState<string>("");
    const [depositB, setDepositB] = useState<string>("");

    // Tx state
    const [loading, setLoading] = useState<boolean>(false);
    const [txError, setTxError] = useState<string | null>(null);
    const [txSig, setTxSig] = useState<string | null>(null);

    // ── Helpers ─────────────────────────────────────────────
    const handleTokenSelect = (token: TokenInfo) => {
        if (activeSelectionSlot === "base") setBaseToken(token)
        if (activeSelectionSlot === "quote") setQuoteToken(token)
        setIsTokenModalOpen(false)
    }

    const adjustPrice = (setter: (v: string) => void, current: string, dir: "up" | "down") => {
        const val = parseFloat(current) || 0;
        const step = Math.max(val * 0.1, 0.0001);
        const next = dir === "up" ? val + step : Math.max(0.0001, val - step);
        setter(next.toFixed(8).replace(/\.?0+$/, "").slice(0, 12));
    };

    const priceLabel = priceBase === "base"
        ? `${quoteToken?.symbol} per ${baseToken?.symbol}`
        : `${baseToken?.symbol} per ${quoteToken?.symbol}`;

    const step1Ready = !!(baseToken && quoteToken);
    const step1ButtonLabel = !baseToken ? "Select Base token" : !quoteToken ? "Select Quote token" : "Continue";

    // CLMM correct ratio calculation
    function calculateCLMMRatio(currentPrice: number, minPrice: number, maxPrice: number) {
        if (currentPrice <= minPrice) return { ratioA: 1, ratioB: 0 }
        if (currentPrice >= maxPrice) return { ratioA: 0, ratioB: 1 }
        const sqrtPc = Math.sqrt(currentPrice)
        const sqrtPa = Math.sqrt(minPrice)
        const sqrtPb = Math.sqrt(maxPrice)
        const amountA = (sqrtPb - sqrtPc) / (sqrtPc * sqrtPb)
        const amountB = sqrtPc - sqrtPa
        const valueA = amountA * currentPrice
        const valueB = amountB
        const total = valueA + valueB
        if (total === 0) return { ratioA: 0.5, ratioB: 0.5 }
        return { ratioA: valueA / total, ratioB: valueB / total }
    }

    const currentPrice = parseFloat(initialPrice || "1")
    const rangeMin = priceRangeMode === "full" ? currentPrice * 0.000001 : parseFloat(minPrice || "0")
    const rangeMax = priceRangeMode === "full" ? currentPrice * 1000000 : parseFloat(maxPrice || "999999")

    const { ratioA: rA, ratioB: rB } = calculateCLMMRatio(currentPrice, rangeMin, rangeMax)

    // USD values — each token's USD value
    const usdA = (parseFloat(depositA) || 0) * currentPrice  // base token in USD (priced in quote)
    const usdB = (parseFloat(depositB) || 0)                  // quote token is worth face value
    const totalDeposit = usdA + usdB

    const ratioA = (rA * 100).toFixed(1)
    const ratioB = (rB * 100).toFixed(1)

    // ── Create Pool ──────────────────────────────────────────
    const handleCreatePool = async () => {
        if (!connected || !publicKey) {
            const msg = "Please connect your wallet first.";
            setTxError(msg);
            notify.error(msg);
            return;
        }
        if (!baseToken || !quoteToken) return;
        if (!depositA && !depositB) {
            const msg = "Please enter deposit amounts.";
            setTxError(msg);
            notify.error(msg);
            return;
        }

        setLoading(true);
        setTxError(null);
        setTxSig(null);

        try {
            // 1. Init Raydiu            // 1. Init Raydium SDK on devnet
            // Use createWrappedSignAll to properly sign and send transactions
            let lastManualTxId = "";
            const wrappedSignAll = await createWrappedSignAll(connection, signAllTransactions, (sig) => { lastManualTxId = sig; });

            const raydium = await Raydium.load({
                owner: publicKey,
                connection,
                cluster: "devnet",
                disableFeatureCheck: true,
                disableLoadToken: true,
                signAllTransactions: wrappedSignAll,
            });

            // 2. Fetch available CLMM fee configs and match selected tier
            const configRes = await fetch("https://api-v3-devnet.raydium.io/main/clmm-config")
            const json = await configRes.json()
            const configs = json.data
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const matchedConfig = configs.find((c: any) => c.tradeFeeRate === selectedFee.bps)
            if (!matchedConfig) throw new Error(`No devnet CLMM config found for fee tier ${selectedFee.label}. Try 0.04%.`)

            const ammConfig = {
                ...matchedConfig,
                id: new PublicKey(matchedConfig.id),
                fundOwner: "",
                description: "",
            }

            const price = new Decimal(initialPrice);

            const mint1: ApiV3Token = {
                chainId: 103,
                address: baseToken.mint,
                programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
                logoURI: "",
                symbol: baseToken.symbol,
                name: baseToken.symbol,
                decimals: baseToken.decimals,
                tags: [],
                extensions: {},
            }

            const mint2: ApiV3Token = {
                chainId: 103,
                address: quoteToken.mint,
                programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
                logoURI: "",
                symbol: quoteToken.symbol,
                name: quoteToken.symbol,
                decimals: quoteToken.decimals,
                tags: [],
                extensions: {},
            }

            const { execute: createPoolExecute, extInfo } = await raydium.clmm.createPool({
                programId: DEVNET_PROGRAM_ID.CLMM_PROGRAM_ID,
                mint1,
                mint2,
                ammConfig,
                initialPrice: price,
                txVersion: TxVersion.V0,
                computeBudgetConfig: {
                    units: 600_000,
                    microLamports: 5_000,
                },
            })

            // Execute createPool
            let createTxId = "";
            try {
                await createPoolExecute({ sendAndConfirm: true });
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (e: any) {
                if (!lastManualTxId) throw e;
            }
            if (lastManualTxId) createTxId = lastManualTxId;

            const poolIdStr = extInfo.address.id.toString();

            // Save pool to localStorage IMMEDIATELY so it shows in the table
            const newPool = {
                id: poolIdStr,
                name: `${baseToken.symbol}-${quoteToken.symbol}`,
                liquidity: "$0",
                volume: "$0",
                fees: "$0",
                apr: "0%",
                fee: selectedFee.label,
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
                creator: publicKey.toBase58(),
                createdAt: new Date().toISOString(),
            };
            const stored = localStorage.getItem("aeroCustomPools");
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let customPools: any[] = [];
            try {
                if (stored) customPools = JSON.parse(stored);
            } catch { /* ignore */ }
            customPools.push(newPool);
            localStorage.setItem("aeroCustomPools", JSON.stringify(customPools));

            // 4. Try to open position with initial liquidity (optional step)
            const hasDeposit = (parseFloat(depositA || "0") > 0) || (parseFloat(depositB || "0") > 0);

            if (hasDeposit) {
                try {
                    // Wait for pool to be available on-chain — retry up to 10 times
                    let clmmPoolInfo: any = null;
                    for (let attempt = 0; attempt < 10; attempt++) {
                        await new Promise(resolve => setTimeout(resolve, 3000));
                        try {
                            const result = await raydium.clmm.getPoolInfoFromRpc(poolIdStr);
                            if (result?.poolInfo) { clmmPoolInfo = result; break; }
                        } catch {
                            // pool not ready yet, will retry
                        }
                    }

                    if (!clmmPoolInfo) {
                        throw new Error("Pool created but not yet available on-chain. Add liquidity from the pool page.");
                    }

                    const tickSpacing = matchedConfig.tickSpacing;
                    let tickLower: number;
                    let tickUpper: number;

                    if (priceRangeMode === "full") {
                        tickLower = Math.ceil(-443636 / tickSpacing) * tickSpacing;
                        tickUpper = Math.floor(443636 / tickSpacing) * tickSpacing;
                    } else {
                        const { tick: tl } = TickUtils.getPriceAndTick({
                            poolInfo: clmmPoolInfo as any,
                            price: new Decimal(minPrice),
                            baseIn: true,
                        });
                        const { tick: tu } = TickUtils.getPriceAndTick({
                            poolInfo: clmmPoolInfo as any,
                            price: new Decimal(maxPrice),
                            baseIn: true,
                        });
                        tickLower = tl;
                        tickUpper = tu;
                    }

                    const amountA = new BN(Math.floor(parseFloat(depositA || "0") * Math.pow(10, baseToken.decimals)));
                    const amountB = new BN(Math.floor(parseFloat(depositB || "0") * Math.pow(10, quoteToken.decimals)));

                    const { execute: openPositionExecute } = await raydium.clmm.openPositionFromBase({
                        poolInfo: clmmPoolInfo.poolInfo as any,
                        poolKeys: clmmPoolInfo.poolKeys as any,
                        ownerInfo: { useSOLBalance: true },
                        tickLower,
                        tickUpper,
                        base: "MintA",
                        baseAmount: amountA,
                        otherAmountMax: new BN(Math.floor(amountB.toNumber() * 1.05)), // 5% slippage
                        txVersion: TxVersion.V0,
                        computeBudgetConfig: {
                            units: 600_000,
                            microLamports: 5_000,
                        },
                    });

                    try {
                        await openPositionExecute({ sendAndConfirm: true });
                    } catch (e: any) {
                        if (!lastManualTxId) throw e;
                    }
                    if (lastManualTxId) setTxSig(lastManualTxId);

                } catch (posErr: any) {
                    setTxSig(createTxId);
                    notify.success("Transaction confirmed!");
                    const msg = `Pool created! But adding initial liquidity failed: ${posErr?.message}. Add liquidity later from the pool page.`;
                    setTxError(msg);
                    notify.error(msg);
                }
            } else if (createTxId) {
                setTxSig(createTxId);
                notify.success("Transaction confirmed!");
            }

            setDepositA("");
            setDepositB("");
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            const msg = err?.message || "Pool creation failed. Check console for details.";
            setTxError(msg);
            notify.error(msg);
        } finally {
            setLoading(false);
        }
    };

    // ── PAIR BAR ─────────────────────────────────────────────
    const PairBar = ({ onEdit }: { onEdit: () => void }) => (
        <div className="flex items-center justify-between bg-secondary/30 dark:bg-black/20 border border-border rounded-xl px-4 py-3 mb-4">
            <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                    <TokenIcon symbol={baseToken?.symbol} logo={baseToken?.logoURI} size={24} />
                    <TokenIcon symbol={quoteToken?.symbol} logo={quoteToken?.logoURI} size={24} />
                </div>
                <span className="font-bold text-sm">{baseToken?.symbol} / {quoteToken?.symbol}</span>
                <span className="text-xs bg-[var(--neon-teal)]/10 text-[var(--neon-teal)] border border-[var(--neon-teal)]/20 px-2 py-0.5 rounded-full">Fee {selectedFee.label}</span>
            </div>
            <button onClick={onEdit} className="text-muted-foreground hover:text-foreground transition-colors">
                <Pencil className="h-4 w-4" />
            </button>
        </div>
    );

    // ── STEP 1 ────────────────────────────────────────────────
    const renderStep1 = () => (
        <div className="w-full md:w-2/3 pt-10">
            <h2 className="text-xl font-bold mb-6">First, select tokens & fee tier</h2>
            <div className="bg-[rgba(220,240,232,0.45)] dark:bg-[rgba(255,255,255,0.03)] backdrop-blur-[6px] border border-black/[0.06] dark:border-[rgba(255,255,255,0.08)] shadow-[0_2px_16px_0_rgba(0,0,0,0.06)] dark:shadow-[0_2px_12px_0_rgba(0,0,0,0.12)] rounded-2xl p-6">
                <p className="text-sm font-bold mb-4">Tokens</p>
                <div className="flex gap-4 mb-6">
                    <div onClick={() => { setActiveSelectionSlot("base"); setIsTokenModalOpen(true); }}
                        className={`flex-1 border rounded-xl p-4 cursor-pointer transition-all flex justify-between items-center group ${baseToken ? "bg-card border-[var(--neon-teal)]/50" : "bg-secondary/30 dark:bg-black/20 border-border hover:border-[#0D9B5F]/40 dark:hover:border-white/30"}`}>
                        <div className="flex items-center gap-2">
                            {baseToken && <TokenIcon symbol={baseToken?.symbol} logo={baseToken?.logoURI} size={24} />}
                            <div className="flex flex-col">
                                <span className="text-[10px] text-muted-foreground">Base token</span>
                                <span className={`font-bold text-sm ${baseToken ? "text-foreground" : "text-muted-foreground"}`}>{baseToken?.symbol || "Select"}</span>
                            </div>
                        </div>
                        <ChevronDown className="text-muted-foreground group-hover:text-foreground transition-colors h-4 w-4" />
                    </div>
                    <div onClick={() => { setActiveSelectionSlot("quote"); setIsTokenModalOpen(true); }}
                        className={`flex-1 border rounded-xl p-4 cursor-pointer transition-all flex justify-between items-center group ${quoteToken ? "bg-card border-[var(--neon-teal)]/50" : "bg-secondary/30 dark:bg-black/20 border-border hover:border-[#0D9B5F]/40 dark:hover:border-white/30"}`}>
                        <div className="flex items-center gap-2">
                            {quoteToken && <TokenIcon symbol={quoteToken?.symbol} logo={quoteToken?.logoURI} size={24} />}
                            <div className="flex flex-col">
                                <span className="text-[10px] text-muted-foreground">Quote token</span>
                                <span className={`font-bold text-sm ${quoteToken ? "text-foreground" : "text-muted-foreground"}`}>{quoteToken?.symbol || "Select"}</span>
                            </div>
                        </div>
                        <ChevronDown className="text-muted-foreground group-hover:text-foreground transition-colors h-4 w-4" />
                    </div>
                </div>

                <p className="text-sm font-bold mb-4">Fee Tier</p>
                <div className="relative w-full mb-8">
                    <div onClick={() => setFeeTierOpen(!feeTierOpen)}
                        className="w-full bg-secondary/30 dark:bg-black/20 border border-border rounded-xl p-4 flex justify-between items-center cursor-pointer hover:border-border transition-all">
                        <span className="font-bold">{selectedFee.label}</span>
                        <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${feeTierOpen ? "rotate-180" : ""}`} />
                    </div>
                    {feeTierOpen && (
                        <div className="absolute top-full left-0 w-full mt-1 bg-card border border-border rounded-xl overflow-hidden z-50">
                            {FEE_TIERS.map((tier) => (
                                <div key={tier.label} onClick={() => { setSelectedFee(tier); setFeeTierOpen(false); }}
                                    className="flex justify-between items-center px-4 py-3 cursor-pointer hover:bg-secondary/60 dark:hover:bg-white/5 transition-all">
                                    <div className="flex flex-col">
                                        <span className={`font-medium ${selectedFee.label === tier.label ? "text-foreground" : "text-muted-foreground"}`}>{tier.label}</span>
                                        <span className="text-[10px] text-muted-foreground">{tier.bps} bps</span>
                                    </div>
                                    {selectedFee.label === tier.label && <Check className="h-5 w-5 text-cyan-400" />}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <button disabled={!step1Ready} onClick={() => step1Ready && setCurrentStep(2)}
                    className={`w-full font-bold py-4 rounded-xl transition-all ${step1Ready
                        ? "bg-[var(--neon-teal)] text-black cursor-pointer hover:opacity-90"
                        : "bg-[var(--neon-teal)]/20 text-[var(--neon-teal)]/60 cursor-not-allowed"}`}>
                    {step1ButtonLabel}
                </button>
            </div>
        </div>
    );

    // ── STEP 2 ────────────────────────────────────────────────
    const renderStep2 = () => (
        <div className="w-full md:w-2/3 pt-10">
            <h2 className="text-xl font-bold mb-6">Next, set initial token price & position price range</h2>
            <div className="bg-[rgba(220,240,232,0.45)] dark:bg-[rgba(255,255,255,0.03)] backdrop-blur-[6px] border border-black/[0.06] dark:border-[rgba(255,255,255,0.08)] shadow-[0_2px_16px_0_rgba(0,0,0,0.06)] dark:shadow-[0_2px_12px_0_rgba(0,0,0,0.12)] rounded-2xl p-6 flex flex-col gap-6">
                <PairBar onEdit={() => setCurrentStep(1)} />
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-bold">Price Setting</p>
                        <div className="flex bg-secondary/40 dark:bg-black/30 border border-border rounded-lg overflow-hidden">
                            <button onClick={() => {
                                if (priceBase !== "base") {
                                    const current = parseFloat(initialPrice || "1")
                                    if (current > 0) setInitialPrice((1 / current).toFixed(6))
                                    setPriceBase("base")
                                }
                            }}
                                className={`px-3 py-1.5 text-xs font-medium transition-all ${priceBase === "base" ? "bg-[var(--neon-teal)]/20 text-[var(--neon-teal)]" : "text-muted-foreground hover:text-foreground"}`}>
                                {baseToken?.symbol} price
                            </button>
                            <button onClick={() => {
                                if (priceBase !== "quote") {
                                    const current = parseFloat(initialPrice || "1")
                                    if (current > 0) setInitialPrice((1 / current).toFixed(6))
                                    setPriceBase("quote")
                                }
                            }}
                                className={`px-3 py-1.5 text-xs font-medium transition-all ${priceBase === "quote" ? "bg-[var(--neon-teal)]/20 text-[var(--neon-teal)]" : "text-muted-foreground hover:text-foreground"}`}>
                                {quoteToken?.symbol} price
                            </button>
                        </div>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">Initial price</p>
                    <div className="bg-secondary/30 dark:bg-black/20 border border-border rounded-xl px-4 py-3 flex justify-between items-center">
                        <input type="number" value={initialPrice} onChange={(e) => setInitialPrice(e.target.value)}
                            className="bg-transparent text-lg font-bold text-foreground outline-none w-48" />
                        <span className="text-xs text-muted-foreground">{priceLabel}</span>
                    </div>
                </div>
                <div>
                    <p className="text-sm font-bold mb-3">Price range</p>
                    <div className="flex bg-secondary/40 dark:bg-black/30 border border-border rounded-xl overflow-hidden mb-4">
                        <button onClick={() => setPriceRangeMode("full")}
                            className={`flex-1 py-2.5 text-sm font-medium transition-all ${priceRangeMode === "full" ? "bg-[#0D9B5F]/15 text-foreground dark:bg-white/10 dark:text-white" : "text-muted-foreground hover:text-foreground"}`}>
                            Full Range
                        </button>
                        <button onClick={() => setPriceRangeMode("custom")}
                            className={`flex-1 py-2.5 text-sm font-medium transition-all ${priceRangeMode === "custom" ? "bg-[#0D9B5F]/15 text-foreground dark:bg-white/10 dark:text-white" : "text-muted-foreground hover:text-foreground"}`}>
                            Custom
                        </button>
                    </div>
                    {priceRangeMode === "custom" && (
                        <div className="flex gap-4">
                            {[{ label: "Min", val: minPrice, setter: setMinPrice }, { label: "Max", val: maxPrice, setter: setMaxPrice }].map(({ label, val, setter }) => (
                                <div key={label} className="flex-1 bg-secondary/30 dark:bg-black/20 border border-border rounded-xl p-4">
                                    <p className="text-[10px] text-muted-foreground mb-3">{label}</p>
                                    <div className="flex items-center justify-between gap-2">
                                        <button onClick={() => adjustPrice(setter, val, "down")}
                                            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-secondary dark:hover:bg-white/10 flex items-center justify-center transition-all shrink-0">
                                            <Minus className="h-3 w-3" />
                                        </button>
                                        <input type="number" value={val} onChange={(e) => setter(e.target.value)}
                                            className="bg-transparent text-center font-bold text-foreground outline-none w-full text-sm" />
                                        <button onClick={() => adjustPrice(setter, val, "up")}
                                            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-secondary dark:hover:bg-white/10 flex items-center justify-center transition-all shrink-0">
                                            <Plus className="h-3 w-3" />
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-2 text-center">{priceLabel}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <button onClick={() => setCurrentStep(3)}
                    className="w-full bg-[var(--neon-teal)] text-black font-bold py-4 rounded-xl hover:opacity-90 transition-all">
                    Continue
                </button>
            </div>
        </div>
    );

    // ── Auto-calculate paired token ─────────────────────────
    const handleDepositAChange = (val: string) => {
        setDepositA(val)
        const amount = parseFloat(val)
        if (!isNaN(amount) && amount > 0 && rA > 0 && rB > 0) {
            const valueA = amount * currentPrice
            const valueB = valueA * (rB / rA)
            setDepositB(valueB.toFixed(6))
        } else {
            setDepositB("")
        }
    }

    const handleDepositBChange = (val: string) => {
        setDepositB(val)
        const amount = parseFloat(val)
        if (!isNaN(amount) && amount > 0 && rA > 0 && rB > 0) {
            const valueB = amount
            const valueA = (valueB * (rA / rB)) / currentPrice
            setDepositA(valueA.toFixed(6))
        } else {
            setDepositA("")
        }
    }

    // ── STEP 3 ────────────────────────────────────────────────
    const renderStep3 = () => (
        <div className="w-full md:w-2/3 pt-10">
            <h2 className="text-xl font-bold mb-6">Last, please enter token deposit amount</h2>
            <div className="bg-[rgba(220,240,232,0.45)] dark:bg-[rgba(255,255,255,0.03)] backdrop-blur-[6px] border border-black/[0.06] dark:border-[rgba(255,255,255,0.08)] shadow-[0_2px_16px_0_rgba(0,0,0,0.06)] dark:shadow-[0_2px_12px_0_rgba(0,0,0,0.12)] rounded-2xl p-6 flex flex-col gap-4">
                <PairBar onEdit={() => setCurrentStep(1)} />
                <div className="bg-secondary/30 dark:bg-black/20 border border-border rounded-xl px-4 py-3 flex justify-between items-start">
                    <div className="flex flex-col gap-1">
                        <p className="text-xs text-muted-foreground">
                            Initial price: <span className="text-foreground font-medium">{initialPrice} {priceLabel}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Price range:{" "}
                            <span className="text-foreground font-medium">
                                {priceRangeMode === "full" ? "Full Range" : `${minPrice} – ${maxPrice} ${priceLabel}`}
                            </span>
                        </p>
                    </div>
                    <button onClick={() => setCurrentStep(2)} className="text-muted-foreground hover:text-foreground transition-colors">
                        <Pencil className="h-4 w-4" />
                    </button>
                </div>

                {/* Base token deposit */}
                {[
                    { token: baseToken, val: depositA, setter: setDepositA },
                    { token: quoteToken, val: depositB, setter: setDepositB },
                ].map(({ token, val }, idx) => (
                    <div key={idx}>
                        {idx === 1 && (
                            <div className="flex justify-center my-1">
                                <div className="w-8 h-8 rounded-full bg-secondary dark:bg-white/5 border border-border flex items-center justify-center">
                                    <Plus className="h-4 w-4 text-muted-foreground" />
                                </div>
                            </div>
                        )}
                        <div className="bg-secondary/30 dark:bg-black/20 border border-border rounded-xl p-4">
                            <div className="flex justify-between items-center mb-3">
                                <div className="flex items-center gap-2">
                                    <TokenIcon symbol={token?.symbol} logo={token?.logoURI} size={28} />
                                    <span className="font-bold">{token?.symbol}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">
                                        {idx === 0
                                            ? formatLargeNumber(tokenBalances.get(baseToken?.mint || "")?.balance || 0)
                                            : formatLargeNumber(tokenBalances.get(quoteToken?.mint || "")?.balance || 0)
                                        }
                                    </span>
                                    <button onClick={() => {
                                        const bal = idx === 0
                                            ? (tokenBalances.get(baseToken?.mint || "")?.balance || 0)
                                            : (tokenBalances.get(quoteToken?.mint || "")?.balance || 0);
                                        const valStr = String(bal);
                                        if (idx === 0) handleDepositAChange(valStr); else handleDepositBChange(valStr);
                                    }} className="text-xs bg-white/5 hover:bg-secondary dark:hover:bg-white/10 px-2 py-1 rounded-lg text-muted-foreground transition-all">Max</button>
                                    <button onClick={() => {
                                        const bal = idx === 0
                                            ? (tokenBalances.get(baseToken?.mint || "")?.balance || 0)
                                            : (tokenBalances.get(quoteToken?.mint || "")?.balance || 0);
                                        const valStr = String(bal * 0.5);
                                        if (idx === 0) handleDepositAChange(valStr); else handleDepositBChange(valStr);
                                    }} className="text-xs bg-white/5 hover:bg-secondary dark:hover:bg-white/10 px-2 py-1 rounded-lg text-muted-foreground transition-all">50%</button>
                                </div>
                            </div>
                            <input type="number" placeholder="0" value={val}
                                onChange={(e) => idx === 0 ? handleDepositAChange(e.target.value) : handleDepositBChange(e.target.value)}
                                className={`bg-transparent font-bold text-foreground outline-none w-full ${String(val).length > 10 ? 'text-lg md:text-xl text-right' : 'text-2xl text-right'}`} />
                            <p className="text-xs text-muted-foreground mt-1 text-right">~${formatLargeNumber(idx === 0 ? ((parseFloat(val) || 0) * currentPrice) : (parseFloat(val) || 0))}</p>
                        </div>
                    </div>
                ))}

                {/* Total + ratio */}
                <div className="bg-secondary/30 dark:bg-black/20 border border-border rounded-xl px-4 py-3 flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-foreground/70">Total Deposit</span>
                        <span className="text-sm font-bold">${formatLargeNumber(totalDeposit)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-foreground/70">Deposit Ratio</span>
                        <div className="flex items-center gap-1.5 text-sm font-medium">
                            <div className={`w-2 h-2 rounded-full ${baseToken?.color || "bg-blue-400"}`} />
                            <span>{ratioA}%</span>
                            <span className="text-muted-foreground">/</span>
                            <span>{ratioB}%</span>
                            <div className="flex -space-x-1 ml-1">
                                <TokenIcon symbol={baseToken?.symbol} logo={baseToken?.logoURI} size={16} />
                                <TokenIcon symbol={quoteToken?.symbol} logo={quoteToken?.logoURI} size={16} />
                            </div>
                        </div>
                    </div>
                </div>

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

                {/* Create Pool button */}
                <button
                    onClick={handleCreatePool}
                    disabled={loading || (!depositA && !depositB)}
                    className={`w-full font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 ${depositA || depositB
                        ? "bg-[var(--neon-teal)] text-black hover:opacity-90 cursor-pointer"
                        : "bg-[var(--neon-teal)]/30 text-[var(--neon-teal)]/60 cursor-not-allowed"
                        } disabled:opacity-60 disabled:cursor-not-allowed`}
                >
                    {loading ? (
                        <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Creating Pool…
                        </>
                    ) : depositA || depositB ? (
                        "Create Pool"
                    ) : (
                        `Enter ${baseToken?.symbol} & ${quoteToken?.symbol} amounts`
                    )}
                </button>
            </div>
        </div>
    );

    // ── MAIN ─────────────────────────────────────────────────
    return (
        <main className="container mx-auto px-4 pt-24 pb-12 flex flex-col items-center min-h-screen text-foreground">
            <div className="w-full max-w-5xl flex flex-col md:flex-row gap-8">
                <StepperSidebar
                    currentStep={currentStep}
                    steps={[
                        { n: 1, label: "Select token & fee tier" },
                        { n: 2, label: "Set initial price & range" },
                        { n: 3, label: "Enter deposit amount" },
                    ]}
                    note={<>This tool is for advanced users. For detailed instructions, read the guide for <span className="text-[var(--neon-teal)] cursor-pointer hover:underline">CLMM</span> or <span className="text-[var(--neon-teal)] cursor-pointer hover:underline">Standard</span> pools.</>}
                />
                {currentStep === 1 && renderStep1()}
                {currentStep === 2 && renderStep2()}
                {currentStep === 3 && renderStep3()}
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
