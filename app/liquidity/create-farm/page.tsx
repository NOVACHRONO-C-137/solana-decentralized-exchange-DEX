"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Check, Search, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { Raydium, TxVersion, DEVNET_PROGRAM_ID, ApiV3PoolInfoConcentratedItem } from "@raydium-io/raydium-sdk-v2";
import BN from "bn.js";
import Decimal from "decimal.js";
import Image from "next/image";

// ── Gradient color map for tokens without logos ──────────
const TOKEN_GRADIENTS: Record<string, string> = {
    SOL: "from-[#9945FF] to-[#14F195]",
    USDC: "from-[#2775CA] to-[#2775CA]",
    USDT: "from-[#26A17B] to-[#26A17B]",
    JitoSOL: "from-[#10B981] to-[#34D399]",
    mSOL: "from-[#C94DFF] to-[#7B61FF]",
    LHMN: "from-[#7C3AED] to-[#A855F7]",
    PLTR: "from-[#3B82F6] to-[#60A5FA]",
    RAY: "from-[#6366F1] to-[#818CF8]",
};

// ── Token icon component ─────────────────────────────────
function TokenIcon({ logo, symbol, size = 24, className = "" }: { logo?: string; symbol: string; size?: number; className?: string }) {
    const [imgError, setImgError] = useState(false);
    const gradient = TOKEN_GRADIENTS[symbol] || "from-[#6B7280] to-[#9CA3AF]";

    if (logo && !imgError) {
        return (
            <div className={`rounded-full overflow-hidden border border-[#0c0d14] bg-[#1a1b2e] ${className}`}
                style={{ width: size, height: size }}>
                <Image
                    src={logo}
                    alt={symbol}
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
            className={`rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center border border-[#0c0d14] text-white font-bold ${className}`}
            style={{ width: size, height: size, fontSize: size * 0.4 }}
        >
            {symbol ? symbol.charAt(0) : "?"}
        </div>
    );
}

// ── Discover pool IDs from on-chain CLMM positions ───────
async function discoverOnChainPoolIds(
    connection: any,
    walletPubkey: PublicKey
): Promise<string[]> {
    try {
        const CLMM_PROGRAM = DEVNET_PROGRAM_ID.CLMM_PROGRAM_ID;
        const accounts = await connection.getProgramAccounts(
            new PublicKey(CLMM_PROGRAM),
            { filters: [{ dataSize: 188 }] }
        );
        const poolIds = new Set<string>();
        for (const { account } of accounts) {
            try {
                const poolIdBytes = account.data.subarray(40, 72);
                const poolId = new PublicKey(poolIdBytes).toBase58();
                poolIds.add(poolId);
            } catch { }
        }
        return Array.from(poolIds);
    } catch (err) {
        return [];
    }
}

// ── Discover pool IDs by scanning PoolState accounts ──────
async function discoverCreatedPools(
    connection: any,
    walletPubkey: PublicKey
): Promise<string[]> {
    try {
        const CLMM_PROGRAM = DEVNET_PROGRAM_ID.CLMM_PROGRAM_ID;
        const clmmPromise = connection.getProgramAccounts(
            new PublicKey(CLMM_PROGRAM),
            {
                filters: [
                    { dataSize: 1544 },
                    { memcmp: { offset: 41, bytes: walletPubkey.toBase58() } }
                ]
            }
        );
        const clmmAccounts = await clmmPromise.catch(() => []);
        return clmmAccounts.map(({ pubkey }: any) => pubkey.toBase58());
    } catch (err) {
        return [];
    }
}


export default function CreateFarmPage() {
    const router = useRouter();
    const { publicKey, sendTransaction, connected } = useWallet();
    const { connection } = useConnection();

    const [currentStep, setCurrentStep] = useState<number>(1);
    const [poolKind, setPoolKind] = useState<"clmm" | "standard">("clmm");
    const [selectedPoolId, setSelectedPoolId] = useState<string>("");

    // Step 2 state
    const [rewardToken, setRewardToken] = useState<string>("");
    const [rewardAmount, setRewardAmount] = useState<string>("");
    const [farmDays, setFarmDays] = useState<string>("7");

    // Stepper & Transaction states
    const [isCreating, setIsCreating] = useState(false);
    const [txSig, setTxSig] = useState<string | null>(null);
    const [txError, setTxError] = useState<string | null>(null);

    const [customPools, setCustomPools] = useState<any[]>([]);

    const [isLoadingPools, setIsLoadingPools] = useState(true);

    // Standard pool dynamic lookup states
    const [standardPoolData, setStandardPoolData] = useState<any | null>(null);
    const [standardPoolLoading, setStandardPoolLoading] = useState(false);
    const [standardPoolError, setStandardPoolError] = useState<string | null>(null);

    useEffect(() => {
        const loadPools = async () => {
            setIsLoadingPools(true);
            const allIds = new Set<string>();

            // 1. Discover from on-chain (created & deposited)
            if (publicKey && connected && connection) {
                try {
                    const [createdPoolIds, positionPoolIds] = await Promise.all([
                        discoverCreatedPools(connection, publicKey),
                        discoverOnChainPoolIds(connection, publicKey),
                    ]);
                    for (const id of createdPoolIds) allIds.add(id);
                    for (const id of positionPoolIds) allIds.add(id);
                } catch (err) { }
            }

            const idsArray = Array.from(allIds);
            if (idsArray.length === 0) {
                setCustomPools([]);
                setIsLoadingPools(false);
                return;
            }

            // 3. Fetch up-to-date metadata from API
            try {
                const apiUrl = `https://api-v3-devnet.raydium.io/pools/info/ids?ids=${idsArray.join(",")}`;
                const res = await fetch(apiUrl);
                const json = await res.json();

                if (json.data && Array.isArray(json.data)) {
                    // Filter out standard & legacy
                    const validPools = json.data.filter((p: any) => p != null && p.mintA && p.mintB && p.type === "Concentrated");

                    const formattedPools = validPools.map((live: any) => {
                        return {
                            id: live.id,
                            name: `${live.mintA?.symbol || "?"}-${live.mintB?.symbol || "?"}`,
                            symbolA: live.mintA?.symbol || "?",
                            symbolB: live.mintB?.symbol || "?",
                            logoA: live.mintA?.logoURI,
                            logoB: live.mintB?.logoURI,
                            fee: live.feeRate ? `${(live.feeRate < 1 ? live.feeRate * 100 : live.feeRate).toFixed(2)}%` : "0.25%",
                            type: live.type || "Concentrated",
                        };
                    });

                    setCustomPools(formattedPools);
                } else {
                    setCustomPools([]);
                }
            } catch (err) {
                setCustomPools([]);
            } finally {
                setIsLoadingPools(false);
            }
        };

        loadPools();
    }, [connection, publicKey, connected]);

    // Lookup Standard AMM pool when an ID is pasted into step 1
    useEffect(() => {
        const validateAnFetchStandardPool = async () => {
            if (poolKind !== "standard" || !selectedPoolId || selectedPoolId.length < 32 || selectedPoolId.length > 44) {
                setStandardPoolData(null);
                setStandardPoolError(null);
                return;
            }

            try {
                // Quick pre-check for valid Solana Pubkey before querying
                new PublicKey(selectedPoolId);
            } catch {
                setStandardPoolError("Invalid Solana address format.");
                setStandardPoolData(null);
                return;
            }

            setStandardPoolLoading(true);
            setStandardPoolError(null);
            setStandardPoolData(null);

            try {
                // Check Raydium Devnet API first
                const apiUrl = `https://api-v3-devnet.raydium.io/pools/info/ids?ids=${selectedPoolId}`;
                const res = await fetch(apiUrl);
                const json = await res.json();

                if (json.data && Array.isArray(json.data) && json.data.length > 0) {
                    const pool = json.data[0];
                    if (pool.type !== "Standard") {
                        setStandardPoolError(`Found a pool, but its type is '${pool.type}', not Standard AMM (CPMM).`);
                        return;
                    }

                    // Parse what we need for the UI
                    setStandardPoolData({
                        id: pool.id,
                        name: `${pool.mintA?.symbol || "?"}-${pool.mintB?.symbol || "?"}`,
                        symbolA: pool.mintA?.symbol || "?",
                        symbolB: pool.mintB?.symbol || "?",
                        logoA: pool.mintA?.logoURI,
                        logoB: pool.mintB?.logoURI,
                        fee: pool.feeRate ? `${(pool.feeRate < 1 ? pool.feeRate * 100 : pool.feeRate).toFixed(2)}%` : "0.25%",
                        type: "Standard"
                    });
                } else {
                    // Fallback to on-chain quick query to see if it even exists and is CPMM
                    if (connection) {
                        const info = await connection.getAccountInfo(new PublicKey(selectedPoolId));
                        if (!info) {
                            setStandardPoolError("Pool account not found on Devnet.");
                            return;
                        }
                        // Verify CPMM Program owner
                        if (info.owner.toBase58() !== DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM.toBase58()) {
                            setStandardPoolError(`Not a valid CPMM Pool. Account owned by: ${info.owner.toBase58()}`);
                            return;
                        }

                        // We know it is a standard pool but lack API visual metadata
                        setStandardPoolData({
                            id: selectedPoolId,
                            name: "Verified Standard Pool",
                            symbolA: "?",
                            symbolB: "?",
                            fee: "?%",
                            type: "Standard"
                        });
                    } else {
                        setStandardPoolError("Pool not found in API and no connection to check chain.");
                    }
                }
            } catch (err: any) {
                console.error("Standard pool fetch error:", err);
                setStandardPoolError("Failed to verify pool. " + err.message);
            } finally {
                setStandardPoolLoading(false);
            }
        };

        // Add a slight debounce to prevent spamming the endpoint while typing
        const timeoutId = setTimeout(() => validateAnFetchStandardPool(), 600);
        return () => clearTimeout(timeoutId);
    }, [selectedPoolId, poolKind, connection]);

    // Stepper
    const renderStepper = () => (
        <div className="w-full md:w-1/3 flex flex-col gap-4">
            <button
                onClick={() => router.back()}
                className="flex items-center text-white/60 hover:text-white transition-colors w-fit mb-2"
            >
                <ChevronLeft className="h-5 w-5 mr-1" /> Back
            </button>

            <div className="bg-[#161722] border border-white/10 rounded-2xl p-6 flex flex-col gap-6">
                {[
                    { n: 1, label: "Select Pool" },
                    { n: 2, label: "Add Rewards" },
                    { n: 3, label: "Review Farm Detail" },
                ].map(({ n, label }, i, arr) => (
                    <div key={n} className="flex gap-4">
                        <div className="flex flex-col items-center">
                            <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 border-2 transition-all
                                ${currentStep > n ? "bg-[var(--neon-teal)] border-[var(--neon-teal)] text-black" :
                                    currentStep === n ? "border-[var(--neon-teal)] text-[var(--neon-teal)]" :
                                        "border-white/20 text-white/40"}`}>
                                {currentStep > n ? <Check className="h-4 w-4" /> : n}
                            </div>
                            {i < arr.length - 1 && <div className="w-0.5 h-12 bg-white/10 mt-2" />}
                        </div>
                        <div className={`pt-1 ${currentStep < n ? "opacity-40" : ""}`}>
                            <p className={`text-xs font-medium mb-0.5 ${currentStep >= n ? "text-[var(--neon-teal)]" : "text-white/40"}`}>
                                Step {n}
                            </p>
                            <p className={`text-sm font-bold ${currentStep === n ? "text-white" : "text-white/60"}`}>
                                {label}
                            </p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="bg-[#161722] border border-white/10 rounded-2xl p-5">
                <h4 className="flex items-center text-sm font-bold mb-2">
                    <span className="w-4 h-4 rounded-full border border-white/40 text-white/60 flex items-center justify-center text-[10px] mr-2">!</span>
                    Please Note
                </h4>
                <p className="text-xs text-white/50 leading-relaxed">
                    A farm can be created for any pool that is already live. For detailed instructions, read the guide for{" "}
                    <span className="text-[var(--neon-teal)] cursor-pointer hover:underline">CLMM</span> or{" "}
                    <span className="text-[var(--neon-teal)] cursor-pointer hover:underline">Standard</span> farms.
                </p>
            </div>
        </div>
    );

    // Step 1 — Select Pool
    const renderStep1 = () => (
        <div className="w-full md:w-2/3">
            <h2 className="text-xl font-bold mb-6">First, select a pool for farm rewards</h2>

            <div className="bg-[#161722] border border-white/10 rounded-2xl p-6 flex flex-col gap-5">
                <div>
                    <p className="text-sm font-bold mb-3">Select Pool</p>

                    <div className="flex gap-3 mb-5">
                        <button
                            onClick={() => { setPoolKind("clmm"); setSelectedPoolId(""); }}
                            className={`flex items-center gap-2 flex-1 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${poolKind === "clmm"
                                ? "border-[var(--neon-teal)] text-[var(--neon-teal)] bg-[var(--neon-teal)]/5"
                                : "border-white/10 text-white/40 hover:border-white/20"}`}
                        >
                            <div className={`w-3 h-3 rounded-full border-2 flex items-center justify-center ${poolKind === "clmm" ? "border-[var(--neon-teal)]" : "border-white/30"}`}>
                                {poolKind === "clmm" && <div className="w-1.5 h-1.5 rounded-full bg-[var(--neon-teal)]" />}
                            </div>
                            Concentrated Liquidity
                        </button>
                        <button
                            onClick={() => { setPoolKind("standard"); setSelectedPoolId(""); }}
                            className={`flex items-center gap-2 flex-1 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${poolKind === "standard"
                                ? "border-[var(--neon-teal)] text-[var(--neon-teal)] bg-[var(--neon-teal)]/5"
                                : "border-white/10 text-white/40 hover:border-white/20"}`}
                        >
                            <div className={`w-3 h-3 rounded-full border-2 flex items-center justify-center ${poolKind === "standard" ? "border-[var(--neon-teal)]" : "border-white/30"}`}>
                                {poolKind === "standard" && <div className="w-1.5 h-1.5 rounded-full bg-[var(--neon-teal)]" />}
                            </div>
                            Standard AMM
                        </button>
                    </div>

                    {poolKind === "clmm" ? (
                        <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar-green relative">
                            {isLoadingPools && (
                                <div className="absolute inset-0 z-10 bg-[#161722]/80 backdrop-blur-sm flex items-center justify-center rounded-xl">
                                    <Loader2 className="h-6 w-6 text-[var(--neon-teal)] animate-spin" />
                                </div>
                            )}

                            {customPools
                                .filter(p => p.type !== "Legacy" && p.type !== "Standard")
                                .map((p) => (
                                    <button
                                        key={p.id}
                                        onClick={() => setSelectedPoolId(p.id)}
                                        className={`flex items-center justify-between p-4 rounded-xl border text-sm transition-all ${selectedPoolId === p.id
                                            ? "border-[var(--neon-teal)] bg-[var(--neon-teal)]/5 shadow-[0_0_10px_var(--neon-teal-glow)]"
                                            : "border-white/10 bg-black/20 hover:border-white/30 hover:bg-white/5"
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="flex -space-x-2">
                                                <TokenIcon logo={p.logoA} symbol={p.symbolA} size={24} />
                                                <TokenIcon logo={p.logoB} symbol={p.symbolB} size={24} />
                                            </div>
                                            <div className="flex flex-col items-start">
                                                <span className="font-bold">{p.name || `${p.symbolA}-${p.symbolB}`}</span>
                                                <span className="text-[10px] text-white/40">Concentrated · {p.fee || "0.25%"}</span>
                                            </div>
                                        </div>
                                        <span className="text-xs text-white/40 font-mono">
                                            {p.id ? `${p.id.slice(0, 6)}...${p.id.slice(-4)}` : "—"}
                                        </span>
                                    </button>
                                ))}

                            {!isLoadingPools && customPools.filter(p => p.type !== "Legacy" && p.type !== "Standard").length === 0 && (
                                <div className="text-center py-8 px-4 rounded-xl border border-dashed border-white/10 bg-black/10">
                                    <p className="text-sm text-white/60 mb-2">No CLMM pools found for this wallet.</p>
                                    <button
                                        onClick={() => router.push("/liquidity/create/clmm")}
                                        className="text-xs font-medium text-[var(--neon-teal)] bg-[var(--neon-teal)]/10 px-4 py-2 rounded-lg hover:bg-[var(--neon-teal)]/20 transition-all">
                                        Create your first CLMM Pool
                                    </button>
                                </div>
                            )}

                            <style dangerouslySetInnerHTML={{
                                __html: `
                                .custom-scrollbar-green::-webkit-scrollbar {
                                    width: 6px;
                                }
                                .custom-scrollbar-green::-webkit-scrollbar-track {
                                    background: rgba(255, 255, 255, 0.02);
                                    border-radius: 8px;
                                }
                                .custom-scrollbar-green::-webkit-scrollbar-thumb {
                                    background: rgba(45, 212, 191, 0.4); 
                                    border-radius: 8px;
                                    box-shadow: 0 0 10px rgba(45, 212, 191, 0.3);
                                }
                                .custom-scrollbar-green::-webkit-scrollbar-thumb:hover {
                                    background: rgba(45, 212, 191, 0.8);
                                    box-shadow: 0 0 15px rgba(45, 212, 191, 0.6);
                                }
                            `}} />
                        </div>
                    ) : (
                        <>
                            <div className="relative mb-2">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                                <input
                                    type="text"
                                    placeholder="Enter Standard AMM Pool ID"
                                    value={selectedPoolId}
                                    onChange={(e) => setSelectedPoolId(e.target.value)}
                                    className="w-full bg-black/20 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white outline-none focus:border-white/20 placeholder:text-white/30"
                                />
                            </div>

                            {/* Validation / Loading States */}
                            {standardPoolLoading && (
                                <div className="flex items-center gap-2 text-[var(--neon-teal)] text-sm mb-2 mt-1">
                                    <Loader2 className="h-4 w-4 animate-spin" /> Verifying pool on-chain...
                                </div>
                            )}

                            {standardPoolError && (
                                <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-xs mb-2 mt-1">
                                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                                    <span>{standardPoolError}</span>
                                </div>
                            )}

                            {standardPoolData && !standardPoolLoading && (
                                <div className="mb-2 mt-1">
                                    <p className="text-xs text-green-400 font-bold mb-2 flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3" /> Valid Standard Pool Linked</p>
                                    <div className="flex items-center justify-between p-4 rounded-xl border border-[var(--neon-teal)] bg-[var(--neon-teal)]/5 shadow-[0_0_10px_var(--neon-teal-glow)] transition-all">
                                        <div className="flex items-center gap-3">
                                            <div className="flex -space-x-2">
                                                <TokenIcon logo={standardPoolData.logoA} symbol={standardPoolData.symbolA} size={24} />
                                                <TokenIcon logo={standardPoolData.logoB} symbol={standardPoolData.symbolB} size={24} />
                                            </div>
                                            <div className="flex flex-col items-start">
                                                <span className="font-bold">{standardPoolData.name}</span>
                                                <span className="text-[10px] text-white/40">{standardPoolData.type} AMM · {standardPoolData.fee}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <p className="text-xs text-white/40">
                                Paste your Standard AMM pool ID to attach a farm to it. Ensure the address exists on devnet.
                            </p>
                        </>
                    )}

                    <p className="text-xs text-white/40 mt-4">
                        Can&apos;t find what you want?{" "}
                        <span
                            onClick={() => router.push(poolKind === "clmm" ? "/liquidity/create/clmm" : "/liquidity/create/standard")}
                            className="text-[var(--neon-teal)] cursor-pointer hover:underline"
                        >
                            Create a new pool
                        </span>
                    </p>
                </div>

                <button
                    onClick={() => setCurrentStep(2)}
                    disabled={!selectedPoolId || (poolKind === "standard" && (!standardPoolData || standardPoolLoading || !!standardPoolError))}
                    className={`w-full font-bold py-4 rounded-xl transition-all ${(selectedPoolId && (poolKind === "clmm" || (poolKind === "standard" && standardPoolData && !standardPoolError)))
                        ? "bg-[var(--neon-teal)] text-black hover:opacity-90 flex justify-center items-center"
                        : "bg-[var(--neon-teal)]/20 text-[var(--neon-teal)]/50 cursor-not-allowed"}`}
                >
                    Continue
                </button>
            </div>
        </div>
    );

    // Step 2 — Add Rewards
    const renderStep2 = () => (
        <div className="w-full md:w-2/3">
            <h2 className="text-xl font-bold mb-6">Next, add farm rewards</h2>

            <div className="bg-[#161722] border border-white/10 rounded-2xl p-6 flex flex-col gap-5">
                <div>
                    <p className="text-sm font-bold mb-2">Reward Token</p>
                    <input
                        type="text"
                        placeholder="Enter token symbol or address"
                        value={rewardToken}
                        onChange={(e) => setRewardToken(e.target.value)}
                        className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20 placeholder:text-white/30"
                    />
                </div>

                <div>
                    <p className="text-sm font-bold mb-2">Total Reward Amount</p>
                    <input
                        type="number"
                        placeholder="0"
                        value={rewardAmount}
                        onChange={(e) => setRewardAmount(e.target.value)}
                        className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20 placeholder:text-white/30"
                    />
                </div>

                <div>
                    <p className="text-sm font-bold mb-2">Farm Duration (days)</p>
                    <div className="flex gap-2">
                        {["7", "14", "30", "60"].map((d) => (
                            <button
                                key={d}
                                onClick={() => setFarmDays(d)}
                                className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all ${farmDays === d
                                    ? "border-[var(--neon-teal)] text-[var(--neon-teal)] bg-[var(--neon-teal)]/5"
                                    : "border-white/10 text-white/40 hover:border-white/20"}`}
                            >
                                {d}d
                            </button>
                        ))}
                    </div>
                </div>

                {rewardToken && rewardAmount && (
                    <div className="bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-xs text-white/50">
                        Daily rewards: <span className="text-white font-medium">
                            {(parseFloat(rewardAmount) / parseInt(farmDays)).toFixed(4)} {rewardToken}/day
                        </span>
                    </div>
                )}

                <div className="flex gap-3">
                    <button
                        onClick={() => setCurrentStep(1)}
                        className="flex-1 border border-white/10 text-white/60 font-bold py-4 rounded-xl hover:border-white/20 hover:text-white transition-all"
                    >
                        Back
                    </button>
                    <button
                        onClick={() => setCurrentStep(3)}
                        disabled={!rewardToken || !rewardAmount}
                        className={`flex-1 font-bold py-4 rounded-xl transition-all ${rewardToken && rewardAmount
                            ? "bg-[var(--neon-teal)] text-black hover:opacity-90 cursor-pointer"
                            : "bg-[var(--neon-teal)]/20 text-[var(--neon-teal)]/50 cursor-not-allowed"}`}
                    >
                        Continue
                    </button>
                </div>
            </div>
        </div>
    );

    const handleCreateFarm = async () => {
        if (!connected || !publicKey) {
            setTxError("Please connect your wallet first.");
            return;
        }
        setIsCreating(true);
        setTxError(null);
        setTxSig(null);

        try {
            if (poolKind === "standard") {
                throw new Error("Standard farm creation is not supported yet. Please use a CLMM pool.");
            }

            let manualTxId = "";
            const wrappedSignAllTransactions = async <T extends Transaction | VersionedTransaction>(
                txs: T[]
            ): Promise<T[]> => {
                console.log("🔑 Intercepting", txs.length, "txs — sending via wallet adapter...");
                for (const tx of txs) {
                    if ('serialize' in tx && 'feePayer' in tx) {
                        const sig = await sendTransaction(tx as Transaction, connection);
                        console.log("✅ TX sent! Sig:", sig);
                        await connection.confirmTransaction(sig, "confirmed");
                        manualTxId = sig;
                    }
                }
                return [] as unknown as T[];
            };

            const raydium = await Raydium.load({
                owner: publicKey,
                connection,
                cluster: "devnet",
                disableFeatureCheck: true,
                disableLoadToken: true,
                signAllTransactions: wrappedSignAllTransactions,
            });

            console.log("Fetching pool info for", selectedPoolId);
            const poolInfoRaw = await raydium.api.fetchPoolById({ ids: selectedPoolId });
            if (!poolInfoRaw || poolInfoRaw.length === 0) {
                throw new Error("Pool not found. Check ID or connection.");
            }

            const poolInfo = poolInfoRaw[0];

            const durationSeconds = parseInt(farmDays) * 24 * 60 * 60;
            const rewardAmountDecimal = new Decimal(rewardAmount);
            const perSecond = rewardAmountDecimal.div(durationSeconds).toFixed(6);

            const perSecondBN = new BN(new Decimal(perSecond).mul(10 ** 6).toString());
            const openTime = Math.floor(Date.now() / 1000);
            const endTime = openTime + durationSeconds;

            const { execute } = await raydium.clmm.initReward({
                poolInfo: poolInfo as ApiV3PoolInfoConcentratedItem,
                ownerInfo: {
                    useSOLBalance: true,
                },
                rewardInfo: {
                    mint: {
                        chainId: 103, // Devnet
                        address: rewardToken,
                        programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
                        logoURI: "",
                        symbol: "",
                        name: "",
                        decimals: 6,
                        tags: [],
                        extensions: {}
                    },
                    perSecond: new Decimal(perSecond).mul(10 ** 6), // CLMM initReward perSecond takes a Decimal
                    openTime,
                    endTime
                },
                txVersion: TxVersion.LEGACY
            });

            await execute({ sendAndConfirm: true });

            setTxSig(manualTxId);
            setIsCreating(false);
            setTimeout(() => router.push("/liquidity"), 2000);

        } catch (err: any) {
            console.error("Farm creation err", err);
            setTxError(err?.message || "Failed to create farm.");
            setIsCreating(false);
        }
    };

    // Step 3 — Review
    const renderStep3 = () => (
        <div className="w-full md:w-2/3">
            <h2 className="text-xl font-bold mb-6">Review farm details</h2>

            <div className="bg-[#161722] border border-white/10 rounded-2xl p-6 flex flex-col gap-4">
                <div className="flex flex-col gap-3">
                    {[
                        { label: "Pool Type", value: poolKind === "clmm" ? "Concentrated Liquidity (CLMM)" : "Standard AMM" },
                        { label: "Selected Pool ID", value: selectedPoolId ? `${selectedPoolId.slice(0, 6)}...${selectedPoolId.slice(-4)}` : "—" },
                        { label: "Reward Token", value: rewardToken },
                        { label: "Total Rewards", value: `${rewardAmount} ${rewardToken}` },
                        { label: "Duration", value: `${farmDays} days` },
                        { label: "Daily Rate", value: `${(parseFloat(rewardAmount) / parseInt(farmDays)).toFixed(4)} ${rewardToken}/day` },
                    ].map(({ label, value }) => (
                        <div key={label} className="flex justify-between items-center py-2 border-b border-white/5">
                            <span className="text-sm text-white/50">{label}</span>
                            <span className="text-sm font-bold text-white">{value}</span>
                        </div>
                    ))}
                </div>

                <p className="text-xs text-yellow-400/80 mt-2">
                    Note: A creation fee is required to initialize the farm on-chain.
                </p>

                <div className="flex flex-col gap-2 mt-4">
                    {txError && (
                        <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
                            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                            {txError}
                        </div>
                    )}

                    {txSig && (
                        <div className="flex items-center gap-2 rounded-xl border border-[var(--neon-teal)]/20 bg-[var(--neon-teal)]/5 px-4 py-3 text-sm text-[var(--neon-teal)]">
                            <CheckCircle2 className="h-4 w-4 shrink-0" />
                            <span>
                                Farm created!{" "}
                                <a href={`https://solscan.io/tx/${txSig}?cluster=devnet`} target="_blank" rel="noopener noreferrer"
                                    className="underline underline-offset-2 hover:opacity-80">
                                    View on Solscan
                                </a>
                            </span>
                        </div>
                    )}

                    <div className="flex gap-3 mt-2">
                        <button
                            onClick={() => setCurrentStep(2)}
                            disabled={isCreating}
                            className={`flex-1 border border-white/10 text-white/60 font-bold py-4 rounded-xl transition-all ${isCreating ? "opacity-50 cursor-not-allowed" : "hover:border-white/20 hover:text-white"}`}
                        >
                            Back
                        </button>
                        <button
                            onClick={handleCreateFarm}
                            disabled={isCreating}
                            className={`flex-1 flex justify-center items-center bg-[var(--neon-teal)] text-black font-bold py-4 rounded-xl transition-all ${isCreating ? "opacity-70 cursor-not-allowed" : "hover:opacity-90"}`}
                        >
                            {isCreating ? (
                                <>
                                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                "Create Farm"
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <main className="container mx-auto px-4 py-12 flex flex-col items-center min-h-screen text-white">
            <div className="w-full max-w-5xl flex flex-col md:flex-row gap-8">
                {renderStepper()}
                {currentStep === 1 && renderStep1()}
                {currentStep === 2 && renderStep2()}
                {currentStep === 3 && renderStep3()}
            </div>
        </main>
    );
}
