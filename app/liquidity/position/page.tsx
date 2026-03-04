"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, RefreshCw, ZoomIn, ZoomOut, Loader2, ArrowDownUp } from "lucide-react";
import Image from "next/image";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { Raydium, TxVersion, ApiV3PoolInfoConcentratedItem } from "@raydium-io/raydium-sdk-v2";
import { DEVNET_PROGRAM_ID } from "@raydium-io/raydium-sdk-v2";
import { DEVNET_TOKENS } from "@/components/liquidity/TokenSelectorModal";
import BN from "bn.js";
import Decimal from "decimal.js";

const QUICK_RANGES = ["±0.1%", "±0.3%", "±0.5%", "±0.8%", "±1%"];

// Mock liquidity bar data
const LIQUIDITY_BARS = [
    { price: 1.017, height: 15 },
    { price: 1.018, height: 45 },
    { price: 1.019, height: 90 },
    { price: 1.0195, height: 100 },
    { price: 1.020, height: 85 },
    { price: 1.0205, height: 70 },
    { price: 1.021, height: 40 },
    { price: 1.0215, height: 20 },
    { price: 1.022, height: 10 },
];

// ── Token Logo Component ──────────────────────────────────
function TokenLogo({ token, size = 28, className = "" }: { token?: { symbol: string; color?: string; icon?: string; logoURI?: string }; size?: number; className?: string }) {
    const [imgError, setImgError] = useState(false);
    if (!token) return <div className={`rounded-full bg-gray-600 ${className}`} style={{ width: size, height: size }} />;

    if (token.logoURI && !imgError) {
        return (
            <div className={`rounded-full overflow-hidden border-2 border-[#161722] ${className}`} style={{ width: size, height: size }}>
                <Image
                    src={token.logoURI}
                    alt={token.symbol}
                    width={size}
                    height={size}
                    className="rounded-full object-cover"
                    onError={() => setImgError(true)}
                    unoptimized
                />
            </div>
        );
    }

    return (
        <div
            className={`rounded-full ${token.color || 'bg-gray-500'} border-2 border-[#161722] flex items-center justify-center text-xs font-bold ${className}`}
            style={{ width: size, height: size }}
        >
            {token.icon || token.symbol[0]}
        </div>
    );
}

function PositionPageInner() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const poolName = searchParams.get("pool") || "SOL / USDC";
    const fee = searchParams.get("fee") || "0.01%";
    const poolId = searchParams.get("poolId") || "";

    const { publicKey, signTransaction, sendTransaction, connected } = useWallet();
    const { connection } = useConnection();

    const [minPrice, setMinPrice] = useState<string>("0.5");
    const [maxPrice, setMaxPrice] = useState<string>("2.0");
    const [depositA, setDepositA] = useState<string>("");
    const [depositB, setDepositB] = useState<string>("");
    const [aprTab, setAprTab] = useState<"24H" | "7D" | "30D">("24H");
    const [priceToggle, setPriceToggle] = useState<"A" | "B">("B");
    const [loading, setLoading] = useState(false);
    const [txError, setTxError] = useState<string | null>(null);
    const [txSig, setTxSig] = useState<string | null>(null);

    // State to handle visual swapping of the tokens in the UI
    const [isInverted, setIsInverted] = useState(false);

    const tokens = poolName.split("-");
    const tokenA = tokens[0] || "TOKEN A";
    const tokenB = tokens[1] || "TOKEN B";

    // Find token info from DEVNET_TOKENS
    const tokenAInfo = DEVNET_TOKENS.find(t => t.symbol === tokenA);
    const tokenBInfo = DEVNET_TOKENS.find(t => t.symbol === tokenB);

    // Dynamic UI Mappings based on inversion state
    const topToken = isInverted ? tokenB : tokenA;
    const topTokenInfo = isInverted ? tokenBInfo : tokenAInfo;
    const topDeposit = isInverted ? depositB : depositA;
    const setTopDeposit = isInverted ? setDepositB : setDepositA;

    const bottomToken = isInverted ? tokenA : tokenB;
    const bottomTokenInfo = isInverted ? tokenAInfo : tokenBInfo;
    const bottomDeposit = isInverted ? depositA : depositB;
    const setBottomDeposit = isInverted ? setDepositA : setDepositB;

    const totalDeposit = (parseFloat(depositA) || 0) + (parseFloat(depositB) || 0);
    const ratioA = totalDeposit > 0 ? (((parseFloat(depositA) || 0) / totalDeposit) * 100).toFixed(0) : "0";
    const ratioB = totalDeposit > 0 ? (100 - parseFloat(ratioA)).toFixed(0) : "0";

    const adjustPrice = (setter: (v: string) => void, current: string, dir: "up" | "down") => {
        const val = parseFloat(current) || 0;
        const step = val * 0.001;
        const next = dir === "up" ? val + step : Math.max(0.0001, val - step);
        setter(next.toFixed(15).replace(/0+$/, "").replace(/\.$/, ""));
    };

    // ── Add Liquidity Handler ──────────────────────────────────
    const handleAddLiquidity = async () => {
        console.log("=== ADD LIQUIDITY START ===");
        if (!publicKey || !connected) {
            setTxError("Please connect your wallet first.");
            return;
        }
        if (!poolId || !tokenAInfo || !tokenBInfo) {
            setTxError("Missing pool or token info.");
            return;
        }
        if (!depositA && !depositB) {
            setTxError("Please enter deposit amounts.");
            return;
        }

        setLoading(true);
        setTxError(null);
        setTxSig(null);

        try {
            let manualTxId: string = "";

            // The manual sending workaround for the SDK bug
            const wrappedSignAllTransactions = async <T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> => {
                console.log("🔑 Intercepting", txs.length, "txs — sending via wallet adapter...");
                for (let i = 0; i < txs.length; i++) {
                    const tx = txs[i];
                    if (tx instanceof Transaction) {
                        const sig = await sendTransaction(tx, connection);
                        console.log("✅ TX sent via wallet adapter! Sig:", sig);
                        await connection.confirmTransaction(sig, "confirmed");
                        manualTxId = sig;
                    }
                }
                throw new Error("__TX_SENT_MANUALLY__");
            };

            const raydium = await Raydium.load({
                owner: publicKey,
                connection,
                cluster: "devnet",
                disableFeatureCheck: true,
                disableLoadToken: true,
                signAllTransactions: wrappedSignAllTransactions,
            });

            // Fetch pool info
            let poolInfo: any;
            try {
                const res = await raydium.api.fetchPoolById({ ids: poolId });
                if (res && res.length > 0) poolInfo = res[0] as ApiV3PoolInfoConcentratedItem;
            } catch (apiErr: any) {
                console.log("Will try manual pool construction...");
            }

            // Determine Authentic MintA / MintB Routing
            let isTokenAMintA = true;
            if (poolInfo && poolInfo.mintA) {
                isTokenAMintA = tokenAInfo.mint === poolInfo.mintA.address;
            } else {
                isTokenAMintA = tokenAInfo.mint < tokenBInfo.mint; // string fallback
            }

            const mintAInfo = isTokenAMintA ? tokenAInfo : tokenBInfo;
            const mintBInfo = isTokenAMintA ? tokenBInfo : tokenAInfo;

            // Manual Fallback construction
            if (!poolInfo) {
                const configRes = await fetch("https://api-v3-devnet.raydium.io/main/clmm-config");
                const configJson = await configRes.json();
                const feeRateNum = Math.round(parseFloat(fee.replace("%", "")) * 10000);
                const matchedConfig = configJson.data.find((c: any) => c.tradeFeeRate === feeRateNum);

                if (!matchedConfig) throw new Error(`No config found for fee ${fee}`);

                poolInfo = {
                    type: "Concentrated",
                    id: poolId,
                    programId: DEVNET_PROGRAM_ID.CLMM_PROGRAM_ID.toString(),
                    price: 1, // Fallback price
                    mintA: { chainId: 103, address: mintAInfo.mint, programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", symbol: mintAInfo.symbol, name: mintAInfo.name, decimals: mintAInfo.decimals, tags: [], extensions: {} },
                    mintB: { chainId: 103, address: mintBInfo.mint, programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", symbol: mintBInfo.symbol, name: mintBInfo.name, decimals: mintBInfo.decimals, tags: [], extensions: {} },
                    config: { ...matchedConfig, id: matchedConfig.id, fundOwner: "", description: "" },
                };
            }

            // Tick range
            const tickSpacing = poolInfo.config?.tickSpacing || 10;
            const MIN_TICK = -443636;
            const MAX_TICK = 443636;
            let tickLower = Math.ceil(MIN_TICK / tickSpacing) * tickSpacing;
            let tickUpper = Math.floor(MAX_TICK / tickSpacing) * tickSpacing;

            // ---- REAL LIFE CLMM ASYMMETRIC DEPOSIT LOGIC ----

            // 1. Map UI Inputs to MintA and MintB
            const valA = parseFloat(depositA || "0");
            const valB = parseFloat(depositB || "0");
            const valMintA = isTokenAMintA ? valA : valB;
            const valMintB = isTokenAMintA ? valB : valA;

            const amountMintA_BN = new BN(Math.floor(valMintA * Math.pow(10, mintAInfo.decimals)));
            const amountMintB_BN = new BN(Math.floor(valMintB * Math.pow(10, mintBInfo.decimals)));

            // 2. Fetch current pool price (1 MintA = X MintB)
            const currentPrice = poolInfo.price || 1;

            // 3. Determine the Bottleneck (Which token is limiting the deposit?)
            // We calculate how much MintB is required to perfectly pair with our MintA
            const requiredMintB = valMintA * currentPrice;

            let baseTokenStr: "MintA" | "MintB";
            let baseAmountBN: BN;
            let otherMaxBN: BN;

            if (valMintB >= requiredMintB) {
                // We have plenty of MintB. MintA is the bottleneck. Anchor to MintA.
                console.log("⚓ Bottleneck is MintA");
                baseTokenStr = "MintA";
                baseAmountBN = amountMintA_BN;
                otherMaxBN = new BN(Math.floor(amountMintB_BN.toNumber() * 1.05)); // 5% slippage on max allowed
            } else {
                // We don't have enough MintB. MintB is the bottleneck. Anchor to MintB.
                console.log("⚓ Bottleneck is MintB");
                baseTokenStr = "MintB";
                baseAmountBN = amountMintB_BN;
                otherMaxBN = new BN(Math.floor(amountMintA_BN.toNumber() * 1.05)); // 5% slippage on max allowed
            }

            // Open position using the dynamically calculated anchor
            const { execute: openPositionExecute } = await raydium.clmm.openPositionFromBase({
                poolInfo: poolInfo as ApiV3PoolInfoConcentratedItem,
                poolKeys: undefined,
                ownerInfo: { useSOLBalance: true },
                tickLower,
                tickUpper,
                base: baseTokenStr,
                baseAmount: baseAmountBN,
                otherAmountMax: otherMaxBN,
                txVersion: TxVersion.LEGACY,
            });

            try {
                await openPositionExecute({ sendAndConfirm: true });
            } catch (execErr: any) {
                if (execErr?.message !== "__TX_SENT_MANUALLY__") throw execErr;
            }

            if (manualTxId) {
                setTxSig(manualTxId);

                // Update localStorage so the liquidity table shows the deposit
                try {
                    const stored = localStorage.getItem("aeroCustomPools");
                    if (stored) {
                        const customPools = JSON.parse(stored);
                        const updated = customPools.map((p: any) => {
                            if (p.id === poolId) {
                                const depA = parseFloat(depositA || "0");
                                const depB = parseFloat(depositB || "0");
                                const existingA = parseFloat(p.depositedA || "0");
                                const existingB = parseFloat(p.depositedB || "0");
                                const totalA = existingA + depA;
                                const totalB = existingB + depB;
                                return {
                                    ...p,
                                    liquidity: `${totalA} ${tokenAInfo.symbol} + ${totalB} ${tokenBInfo.symbol}`,
                                    depositedA: totalA.toString(),
                                    depositedB: totalB.toString(),
                                };
                            }
                            return p;
                        });
                        localStorage.setItem("aeroCustomPools", JSON.stringify(updated));
                    }
                } catch (e) { }

                setDepositA("");
                setDepositB("");
            }
        } catch (err: any) {
            console.error("❌ Add liquidity failed:", err);
            setTxError(err?.message || "Failed to add liquidity. Check console for details.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen text-white bg-[#0d0e14] px-4 py-8">
            <div className="max-w-6xl mx-auto">

                {/* Back */}
                <button
                    onClick={() => router.back()}
                    className="flex items-center text-white/60 hover:text-white transition-colors mb-6"
                >
                    <ChevronLeft className="h-5 w-5 mr-1" /> Back
                </button>

                {/* Header bar */}
                <div className="bg-[#161722] border border-white/10 rounded-2xl px-6 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                        <div className="flex -space-x-2">
                            <TokenLogo token={tokenAInfo} size={32} className="z-10" />
                            <TokenLogo token={tokenBInfo} size={32} />
                        </div>
                        <span className="text-lg font-bold">{tokenA} / {tokenB}</span>
                        <span className="text-xs bg-[var(--neon-teal)]/10 text-[var(--neon-teal)] border border-[var(--neon-teal)]/20 px-2 py-0.5 rounded-full">{fee}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                        {poolId && (
                            <div>
                                <span className="text-white/40">Pool ID </span>
                                <span className="font-mono text-xs text-white/70">{poolId.slice(0, 8)}...{poolId.slice(-6)}</span>
                            </div>
                        )}
                        {!poolId && <span className="text-yellow-400/80 text-xs">⚠ Mock pool — deposit is for real pools only</span>}
                    </div>
                </div>

                {/* Main content */}
                <div className="flex flex-col lg:flex-row gap-6">

                    {/* LEFT — Price Range Chart */}
                    <div className="flex-1 bg-[#161722] border border-white/10 rounded-2xl p-6">
                        <h3 className="text-base font-bold mb-5">Set Price Range</h3>

                        {/* Chart area */}
                        <div className="relative bg-black/20 border border-white/5 rounded-xl p-4 mb-5 h-64">
                            {/* Toolbar */}
                            <div className="absolute top-3 right-3 flex gap-2 z-10">
                                <button className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all">
                                    <RefreshCw className="h-3.5 w-3.5 text-white/50" />
                                </button>
                                <button className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all">
                                    <ZoomIn className="h-3.5 w-3.5 text-white/50" />
                                </button>
                                <button className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all">
                                    <ZoomOut className="h-3.5 w-3.5 text-white/50" />
                                </button>
                            </div>

                            {/* Range labels */}
                            <div className="absolute top-3 left-4 flex gap-4 text-xs text-white/50">
                                <span className="bg-black/40 px-2 py-0.5 rounded">-0.1%</span>
                                <span className="bg-black/40 px-2 py-0.5 rounded ml-16">+0.1%</span>
                            </div>

                            {/* Bar chart */}
                            <div className="absolute bottom-8 left-4 right-4 flex items-end justify-center gap-0.5 h-36">
                                {LIQUIDITY_BARS.map((bar, i) => (
                                    <div
                                        key={i}
                                        className="flex-1 rounded-t-sm transition-all"
                                        style={{
                                            height: `${bar.height}%`,
                                            background: bar.price >= 1.018 && bar.price <= 1.021
                                                ? "rgba(20, 241, 149, 0.5)"
                                                : "rgba(255,255,255,0.1)"
                                        }}
                                    />
                                ))}

                                {/* Current price line */}
                                <div className="absolute bottom-0 top-0 w-px bg-white/60 left-[48%]">
                                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] text-white/60 whitespace-nowrap">▼</div>
                                </div>

                                {/* Min handle */}
                                <div className="absolute bottom-0 top-0 w-px bg-[var(--neon-teal)] left-[25%]">
                                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] text-[var(--neon-teal)]">▼</div>
                                </div>

                                {/* Max handle */}
                                <div className="absolute bottom-0 top-0 w-px bg-[var(--neon-teal)] left-[70%]">
                                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] text-[var(--neon-teal)]">▼</div>
                                </div>
                            </div>

                            {/* Price axis */}
                            <div className="absolute bottom-2 left-4 right-4 flex justify-between text-[10px] text-white/30">
                                {[1.017, 1.018, 1.019, 1.020, 1.021, 1.022].map((p) => (
                                    <span key={p}>{p.toFixed(3)}</span>
                                ))}
                            </div>

                            {/* Legend */}
                            <div className="absolute right-4 top-10 text-[10px] text-white/50 flex flex-col gap-1">
                                <div className="flex items-center gap-1">
                                    <div className="w-4 h-px bg-white/60" />
                                    <span>Current Price</span>
                                </div>
                                <span className="text-white/40 ml-5">1.0 {tokenB} per {tokenA}</span>
                            </div>
                        </div>

                        {/* Min / Max inputs */}
                        <div className="flex gap-4 mb-4">
                            {/* Min */}
                            <div className="flex-1 bg-black/20 border border-white/10 rounded-xl p-3">
                                <p className="text-[10px] text-white/40 mb-2">Min</p>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => adjustPrice(setMinPrice, minPrice, "down")}
                                        className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 font-bold shrink-0"
                                    >
                                        -
                                    </button>
                                    <input
                                        type="number"
                                        value={minPrice}
                                        onChange={(e) => setMinPrice(e.target.value)}
                                        className="bg-transparent text-xs font-medium text-white outline-none w-full text-center"
                                    />
                                    <button
                                        onClick={() => adjustPrice(setMinPrice, minPrice, "up")}
                                        className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 font-bold shrink-0"
                                    >
                                        +
                                    </button>
                                </div>
                                <p className="text-[9px] text-white/30 mt-1 text-center">{tokenB} per {tokenA}</p>
                            </div>

                            {/* Max */}
                            <div className="flex-1 bg-black/20 border border-white/10 rounded-xl p-3">
                                <p className="text-[10px] text-white/40 mb-2">Max</p>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => adjustPrice(setMaxPrice, maxPrice, "down")}
                                        className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 font-bold shrink-0"
                                    >
                                        -
                                    </button>
                                    <input
                                        type="number"
                                        value={maxPrice}
                                        onChange={(e) => setMaxPrice(e.target.value)}
                                        className="bg-transparent text-xs font-medium text-white outline-none w-full text-center"
                                    />
                                    <button
                                        onClick={() => adjustPrice(setMaxPrice, maxPrice, "up")}
                                        className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 font-bold shrink-0"
                                    >
                                        +
                                    </button>
                                </div>
                                <p className="text-[9px] text-white/30 mt-1 text-center">{tokenB} per {tokenA}</p>
                            </div>
                        </div>

                        {/* Quick range + price toggle */}
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex gap-2 flex-wrap">
                                {QUICK_RANGES.map((r) => (
                                    <button
                                        key={r}
                                        className="text-xs px-3 py-1.5 rounded-xl border border-white/10 text-white/50 hover:border-[var(--neon-teal)]/50 hover:text-[var(--neon-teal)] transition-all"
                                    >
                                        {r}
                                    </button>
                                ))}
                                <button className="text-xs px-3 py-1.5 rounded-xl border border-white/10 text-white/40 hover:border-white/20 transition-all">
                                    Reset
                                </button>
                            </div>
                            <button
                                onClick={() => setPriceToggle(priceToggle === "A" ? "B" : "A")}
                                className="text-xs px-3 py-1.5 rounded-xl border border-[var(--neon-teal)]/30 text-[var(--neon-teal)] hover:bg-[var(--neon-teal)]/5 transition-all"
                            >
                                {priceToggle === "B" ? tokenB : tokenA} Price ⇄
                            </button>
                        </div>

                        {/* Estimated APR */}
                        <div className="mt-5 pt-5 border-t border-white/5">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <p className="text-sm font-bold">Estimated APR</p>
                                    <span className="text-white/30 text-xs cursor-pointer hover:text-white">ⓘ</span>
                                </div>
                                <div className="flex bg-black/30 border border-white/10 rounded-lg overflow-hidden">
                                    {(["24H", "7D", "30D"] as const).map((tab) => (
                                        <button
                                            key={tab}
                                            onClick={() => setAprTab(tab)}
                                            className={`px-3 py-1 text-xs font-medium transition-all ${aprTab === tab ? "bg-white/10 text-white" : "text-white/40 hover:text-white"}`}
                                        >
                                            {tab}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <p className="text-2xl font-bold">0%</p>
                                <div className="flex items-center gap-2 text-xs text-white/50">
                                    <div className="w-2 h-2 rounded-full bg-[var(--neon-teal)]" />
                                    <span>Trade fees</span>
                                    <span className="font-bold text-white">0%</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT — Deposit Amount */}
                    <div className="w-full lg:w-80 bg-[#161722] border border-white/10 rounded-2xl p-6 flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-bold">Add Deposit Amount</h3>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-white/40 border border-white/10 px-2 py-1 rounded-lg">⇄ 2.5%</span>
                                <button className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all">
                                    <RefreshCw className="h-3.5 w-3.5 text-white/50" />
                                </button>
                            </div>
                        </div>

                        {/* Top Token */}
                        <div className="bg-black/20 border border-white/10 rounded-xl p-4">
                            <div className="flex justify-between items-center mb-3">
                                <div className="flex items-center gap-2">
                                    <TokenLogo token={topTokenInfo} size={28} className="!border-0" />
                                    <span className="font-bold text-sm">{topToken}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-white/40">0</span>
                                    <button onClick={() => setTopDeposit("0")} className="text-xs bg-white/5 hover:bg-white/10 px-2 py-1 rounded-lg text-white/60 transition-all">Max</button>
                                    <button onClick={() => setTopDeposit("0")} className="text-xs bg-white/5 hover:bg-white/10 px-2 py-1 rounded-lg text-white/60 transition-all">50%</button>
                                </div>
                            </div>
                            <input
                                type="number"
                                placeholder="0"
                                value={topDeposit}
                                onChange={(e) => setTopDeposit(e.target.value)}
                                className="bg-transparent text-2xl font-bold text-white outline-none w-full text-right"
                            />
                            <p className="text-xs text-white/30 text-right mt-1">
                                ~${(parseFloat(topDeposit) || 0).toFixed(2)}
                            </p>
                        </div>

                        {/* Middle Swap Button */}
                        <div className="flex justify-center -my-3 z-10 relative">
                            <button
                                onClick={() => setIsInverted(!isInverted)}
                                className="w-8 h-8 rounded-full bg-[#161722] border border-white/10 flex items-center justify-center text-white/40 hover:text-[var(--neon-teal)] hover:border-[var(--neon-teal)]/30 transition-all shadow-lg"
                            >
                                <ArrowDownUp className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Bottom Token */}
                        <div className="bg-black/20 border border-white/10 rounded-xl p-4">
                            <div className="flex justify-between items-center mb-3">
                                <div className="flex items-center gap-2">
                                    <TokenLogo token={bottomTokenInfo} size={28} className="!border-0" />
                                    <span className="font-bold text-sm">{bottomToken}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-white/40">0</span>
                                    <button onClick={() => setBottomDeposit("0")} className="text-xs bg-white/5 hover:bg-white/10 px-2 py-1 rounded-lg text-white/60 transition-all">Max</button>
                                    <button onClick={() => setBottomDeposit("0")} className="text-xs bg-white/5 hover:bg-white/10 px-2 py-1 rounded-lg text-white/60 transition-all">50%</button>
                                </div>
                            </div>
                            <input
                                type="number"
                                placeholder="0"
                                value={bottomDeposit}
                                onChange={(e) => setBottomDeposit(e.target.value)}
                                className="bg-transparent text-2xl font-bold text-white outline-none w-full text-right"
                            />
                            <p className="text-xs text-white/30 text-right mt-1">
                                ~${(parseFloat(bottomDeposit) || 0).toFixed(2)}
                            </p>
                        </div>

                        {/* Total + Ratio */}
                        <div className="bg-black/20 border border-white/10 rounded-xl px-4 py-3 flex flex-col gap-2">
                            <div className="flex justify-between">
                                <span className="text-sm text-white/60">Total Deposit</span>
                                <span className="text-sm font-bold">${totalDeposit.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-white/60">Deposit Ratio</span>
                                <div className="flex items-center gap-1 text-xs">
                                    <span>{ratioA}%</span>
                                    <span className="text-white/30">/</span>
                                    <span>{ratioB}%</span>
                                    <div className="flex -space-x-1 ml-1">
                                        <TokenLogo token={tokenAInfo} size={14} className="!border" />
                                        <TokenLogo token={tokenBInfo} size={14} className="!border" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Error / Success messages */}
                        {txError && (
                            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-xs text-red-400">
                                ⚠ {txError}
                            </div>
                        )}
                        {txSig && (
                            <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 text-xs text-green-400">
                                ✅ Liquidity added!{" "}
                                <a
                                    href={`https://solscan.io/tx/${txSig}?cluster=devnet`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="underline hover:text-green-300"
                                >
                                    View on Solscan
                                </a>
                            </div>
                        )}

                        {/* Submit */}
                        <button
                            disabled={loading || (!depositA && !depositB) || !poolId}
                            onClick={handleAddLiquidity}
                            className={`w-full font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 ${loading
                                ? "bg-[var(--neon-teal)]/50 text-black/70 cursor-wait"
                                : (depositA || depositB) && poolId
                                    ? "bg-[var(--neon-teal)] text-black hover:opacity-90 cursor-pointer"
                                    : "bg-[var(--neon-teal)]/20 text-[var(--neon-teal)]/50 cursor-not-allowed"
                                }`}
                        >
                            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                            {loading ? "Adding Liquidity..." : !poolId ? "Mock Pool — Cannot Deposit" : (depositA || depositB) ? "Add Liquidity" : "Enter Token Amount"}
                        </button>
                    </div>
                </div>
            </div>
        </main>
    );
}

export default function PositionPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#0d0e14] flex items-center justify-center text-white/40">Loading...</div>}>
            <PositionPageInner />
        </Suspense>
    );
}