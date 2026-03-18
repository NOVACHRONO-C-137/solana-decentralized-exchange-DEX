"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Check, Search, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { Raydium, TxVersion, DEVNET_PROGRAM_ID, ApiV3PoolInfoConcentratedItem, ApiV3PoolInfoStandardItem } from "@raydium-io/raydium-sdk-v2";
import BN from "bn.js";
import Decimal from "decimal.js";
import Image from "next/image";
import { TokenInfo, TokenSelectorModal } from "@/components/liquidity/TokenSelectorModal";
import { DateTimePicker } from "@/components/liquidity/DateTimePicker";
import { useTokenBalances } from "@/hooks/useTokenBalances";
import { formatLargeNumber } from "@/lib/utils";
import { TOKEN_GRADIENTS } from "@/lib/tokens";
import TokenIcon from "@/components/liquidity/TokenIcon";

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
    const { publicKey, sendTransaction, signAllTransactions, connected } = useWallet();
    const { connection } = useConnection();

    const [currentStep, setCurrentStep] = useState<number>(1);
    const [poolKind, setPoolKind] = useState<"clmm" | "standard">("clmm");
    const [selectedPoolId, setSelectedPoolId] = useState<string>("");

    // Step 2 state (Multiple Rewards)
    type RewardConfig = {
        id: string;
        token: TokenInfo | null;
        amount: string;
        startDate: Date;
        durationDays: string;
        isDatePickerOpen: boolean;
        hasSelectedPeriod: boolean;
    };

    const getInitialRewardDate = () => {
        const d = new Date();
        d.setMinutes(d.getMinutes() + 5); // Default 5 mins in future
        return d;
    };

    const [rewards, setRewards] = useState<RewardConfig[]>([
        { id: "1", token: null, amount: "", startDate: getInitialRewardDate(), durationDays: "7", isDatePickerOpen: false, hasSelectedPeriod: false }
    ]);

    const [isTokenSelectorOpen, setIsTokenSelectorOpen] = useState(false);
    const [editingTokenIndex, setEditingTokenIndex] = useState<number | null>(null);

    // Stepper & Transaction states
    const [isCreating, setIsCreating] = useState(false);
    const [txSig, setTxSig] = useState<string | null>(null);
    const [txError, setTxError] = useState<string | null>(null);

    const { balances: tokenBalances, discoveredTokens, loading: balancesLoading } = useTokenBalances();
    const balancesMap = new Map<string, number>();
    tokenBalances.forEach((tb, mint) => balancesMap.set(mint, tb.balance));

    // Custom data filtering hooks
    const [customPools, setCustomPools] = useState<any[]>([]);
    const [isLoadingPools, setIsLoadingPools] = useState<boolean>(true);

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
                className="flex items-center text-muted-foreground hover:text-foreground transition-colors w-fit mb-2"
            >
                <ChevronLeft className="h-5 w-5 mr-1" /> Back
            </button>

            <div className="bg-[rgba(220,240,232,0.45)] dark:bg-[rgba(255,255,255,0.03)] backdrop-blur-[6px] border border-black/[0.06] dark:border-[rgba(255,255,255,0.08)] shadow-[0_2px_16px_0_rgba(0,0,0,0.06)] dark:shadow-[0_2px_12px_0_rgba(0,0,0,0.12)] rounded-2xl p-6 flex flex-col gap-6">
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
                                        "border-border text-muted-foreground"}`}>
                                {currentStep > n ? <Check className="h-4 w-4" /> : n}
                            </div>
                            {i < arr.length - 1 && <div className="w-0.5 h-12 bg-border mt-2" />}
                        </div>
                        <div className={`pt-1 ${currentStep < n ? "opacity-40" : ""}`}>
                            <p className={`text-xs font-medium mb-0.5 ${currentStep >= n ? "text-[var(--neon-teal)]" : "text-muted-foreground"}`}>
                                Step {n}
                            </p>
                            <p className={`text-sm font-bold ${currentStep === n ? "text-foreground" : "text-muted-foreground"}`}>
                                {label}
                            </p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="bg-[rgba(220,240,232,0.45)] dark:bg-[rgba(255,255,255,0.03)] backdrop-blur-[6px] border border-black/[0.06] dark:border-[rgba(255,255,255,0.08)] shadow-[0_2px_16px_0_rgba(0,0,0,0.06)] dark:shadow-[0_2px_12px_0_rgba(0,0,0,0.12)] rounded-2xl p-5">
                <h4 className="flex items-center text-sm font-bold mb-2">
                    <span className="w-4 h-4 rounded-full border border-white/40 text-muted-foreground flex items-center justify-center text-[10px] mr-2">!</span>
                    Please Note
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
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

            <div className="bg-[rgba(220,240,232,0.45)] dark:bg-[rgba(255,255,255,0.03)] backdrop-blur-[6px] border border-black/[0.06] dark:border-[rgba(255,255,255,0.08)] shadow-[0_2px_16px_0_rgba(0,0,0,0.06)] dark:shadow-[0_2px_12px_0_rgba(0,0,0,0.12)] rounded-2xl p-6 flex flex-col gap-5">
                <div>
                    <p className="text-sm font-bold mb-3">Select Pool</p>

                    <div className="flex gap-3 mb-5">
                        <button
                            onClick={() => { setPoolKind("clmm"); setSelectedPoolId(""); }}
                            className={`flex items-center gap-2 flex-1 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${poolKind === "clmm"
                                ? "border-[var(--neon-teal)] text-[var(--neon-teal)] bg-[var(--neon-teal)]/5"
                                : "border-border text-muted-foreground hover:border-border"}`}
                        >
                            <div className={`w-3 h-3 rounded-full border-2 flex items-center justify-center ${poolKind === "clmm" ? "border-[var(--neon-teal)]" : "border-border"}`}>
                                {poolKind === "clmm" && <div className="w-1.5 h-1.5 rounded-full bg-[var(--neon-teal)]" />}
                            </div>
                            Concentrated Liquidity
                        </button>
                        <button
                            onClick={() => { setPoolKind("standard"); setSelectedPoolId(""); }}
                            className={`flex items-center gap-2 flex-1 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${poolKind === "standard"
                                ? "border-[var(--neon-teal)] text-[var(--neon-teal)] bg-[var(--neon-teal)]/5"
                                : "border-border text-muted-foreground hover:border-border"}`}
                        >
                            <div className={`w-3 h-3 rounded-full border-2 flex items-center justify-center ${poolKind === "standard" ? "border-[var(--neon-teal)]" : "border-border"}`}>
                                {poolKind === "standard" && <div className="w-1.5 h-1.5 rounded-full bg-[var(--neon-teal)]" />}
                            </div>
                            Standard AMM
                        </button>
                    </div>

                    {poolKind === "clmm" ? (
                        <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar-green relative">
                            {isLoadingPools && (
                                <div className="absolute inset-0 z-10 bg-card/80 backdrop-blur-sm flex items-center justify-center rounded-xl">
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
                                            : "border-border bg-secondary/30 dark:bg-black/20 hover:border-[#0D9B5F]/40 dark:hover:border-border hover:bg-secondary/60 dark:hover:bg-white/5"
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="flex -space-x-2">
                                                <TokenIcon logo={p.logoA} symbol={p.symbolA} size={24} />
                                                <TokenIcon logo={p.logoB} symbol={p.symbolB} size={24} />
                                            </div>
                                            <div className="flex flex-col items-start">
                                                <span className="font-bold">{p.name || `${p.symbolA}-${p.symbolB}`}</span>
                                                <span className="text-[10px] text-muted-foreground">Concentrated · {p.fee || "0.25%"}</span>
                                            </div>
                                        </div>
                                        <span className="text-xs text-muted-foreground font-mono">
                                            {p.id ? `${p.id.slice(0, 6)}...${p.id.slice(-4)}` : "—"}
                                        </span>
                                    </button>
                                ))}

                            {!isLoadingPools && customPools.filter(p => p.type !== "Legacy" && p.type !== "Standard").length === 0 && (
                                <div className="text-center py-8 px-4 rounded-xl border border-dashed border-border bg-secondary/20 dark:bg-black/10">
                                    <p className="text-sm text-muted-foreground mb-2">No CLMM pools found for this wallet.</p>
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
                                .animate-duration-pop {
                                    animation: fadeScaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                                }
                                @keyframes fadeScaleIn {
                                    0% { opacity: 0; transform: scale(0.95); }
                                    100% { opacity: 1; transform: scale(1); }
                                }
                            `}} />
                        </div>
                    ) : (
                        <>
                            <div className="relative mb-2">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder="Enter Standard AMM Pool ID"
                                    value={selectedPoolId}
                                    onChange={(e) => setSelectedPoolId(e.target.value)}
                                    className="w-full bg-white/60 dark:bg-black/20 border border-border rounded-xl pl-10 pr-4 py-3 text-sm text-foreground outline-none focus:border-[var(--neon-teal)]/50 placeholder:text-muted-foreground"
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
                                                <span className="text-[10px] text-muted-foreground">{standardPoolData.type} AMM · {standardPoolData.fee}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <p className="text-xs text-muted-foreground">
                                Paste your Standard AMM pool ID to attach a farm to it. Ensure the address exists on devnet.
                            </p>
                        </>
                    )}

                    <p className="text-xs text-muted-foreground mt-4">
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
    const addReward = () => {
        if (rewards.length >= 3) return;
        setRewards([...rewards, {
            id: Date.now().toString(),
            token: null,
            amount: "",
            startDate: getInitialRewardDate(),
            durationDays: "7",
            isDatePickerOpen: false,
            hasSelectedPeriod: false
        }]);
    };

    const removeReward = (id: string) => {
        setRewards(rewards.filter(r => r.id !== id));
    };

    const updateReward = (id: string, field: keyof RewardConfig, value: any) => {
        setRewards(prevRewards => prevRewards.map(r => r.id === id ? { ...r, [field]: value } : r));
    };

    const openTokenSelector = (index: number) => {
        setEditingTokenIndex(index);
        setIsTokenSelectorOpen(true);
    };

    const handleTokenSelect = (token: TokenInfo) => {
        if (editingTokenIndex !== null && editingTokenIndex >= 0 && editingTokenIndex < rewards.length) {
            updateReward(rewards[editingTokenIndex].id, "token", token);
        }
        setIsTokenSelectorOpen(false);
        setEditingTokenIndex(null);
    };

    const isStep2Valid = rewards.every(r => r.token !== null && r.amount !== "" && parseFloat(r.amount) > 0 && parseInt(r.durationDays) > 0 && r.hasSelectedPeriod);

    const renderStep2 = () => (
        <div className="w-full md:w-2/3">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Next, enter rewards for the farm</h2>
                {rewards.length < 3 && (
                    <button
                        onClick={addReward}
                        className="text-[var(--neon-teal)] text-sm font-medium hover:underline flex items-center gap-1"
                    >
                        <span className="text-lg leading-none">+</span> Add another
                    </button>
                )}
            </div>

            <div className="flex flex-col gap-6">
                {rewards.map((reward, i) => {
                    const durationInt = parseInt(reward.durationDays) || 0;
                    const endDate = new Date(reward.startDate.getTime() + durationInt * 24 * 60 * 60 * 1000);
                    const weeklyEstimate = (parseFloat(reward.amount || "0") / durationInt) * 7;

                    return (
                        <div key={reward.id} className="bg-[rgba(220,240,232,0.45)] dark:bg-[rgba(255,255,255,0.03)] backdrop-blur-[6px] border border-black/[0.06] dark:border-[rgba(255,255,255,0.08)] shadow-[0_2px_16px_0_rgba(0,0,0,0.06)] dark:shadow-[0_2px_12px_0_rgba(0,0,0,0.12)] rounded-2xl p-6 flex flex-col gap-5 relative">
                            <div className="flex justify-between items-center mb-2">
                                <div>
                                    <h3 className="text-base font-bold">Reward Token {i + 1}</h3>
                                    {i === 0 && <p className="text-sm text-muted-foreground mt-1">You can add up to 3 reward tokens.</p>}
                                </div>
                                {rewards.length > 1 && (
                                    <button onClick={() => removeReward(reward.id)} className="text-muted-foreground hover:text-red-400 transition-colors p-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                                    </button>
                                )}
                            </div>

                            {/* Token Select & Amount */}
                            <div className="bg-secondary/30 dark:bg-black/20 border border-border rounded-xl p-4 flex justify-between items-center">
                                <button
                                    onClick={() => openTokenSelector(i)}
                                    className="flex items-center gap-2 bg-secondary/50 dark:bg-[#1a1b2e] hover:bg-secondary border border-border rounded-xl px-3 py-2 transition-colors shrink-0"
                                >
                                    {reward.token ? (
                                        <>
                                            <TokenIcon logo={reward.token.logoURI} symbol={reward.token.symbol} size={24} />
                                            <span className="font-bold text-lg">{reward.token.symbol}</span>
                                        </>
                                    ) : (
                                        <span className="font-bold text-lg text-muted-foreground px-2">Select Token</span>
                                    )}
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground ml-1"><polyline points="6 9 12 15 18 9" /></svg>
                                </button>

                                <div className="flex flex-col items-end w-full ml-4">
                                    <div className="flex items-center justify-end gap-2 w-full mb-1">
                                        <div className="flex items-center gap-1 text-muted-foreground text-xs">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></svg>
                                            {reward.token ? formatLargeNumber(balancesMap.get(reward.token.mint) || 0) : 0}
                                        </div>
                                        {reward.token && (
                                            <>
                                                <button onClick={() => updateReward(reward.id, "amount", String(balancesMap.get(reward.token!.mint) || 0))} className="text-xs bg-secondary/50 dark:bg-white/5 hover:bg-secondary dark:hover:bg-white/10 px-2 rounded text-muted-foreground transition-all">Max</button>
                                                <button onClick={() => updateReward(reward.id, "amount", String((balancesMap.get(reward.token!.mint) || 0) * 0.5))} className="text-xs bg-secondary/50 dark:bg-white/5 hover:bg-secondary dark:hover:bg-white/10 px-2 rounded text-muted-foreground transition-all">50%</button>
                                            </>
                                        )}
                                    </div>
                                    <input
                                        type="number"
                                        placeholder="0"
                                        value={reward.amount}
                                        onChange={(e) => updateReward(reward.id, "amount", e.target.value)}
                                        className="bg-transparent text-right text-2xl font-bold text-foreground outline-none w-full placeholder:text-muted-foreground/30"
                                    />
                                    <span className="text-xs text-muted-foreground mt-1">~$0</span>
                                </div>
                            </div>

                            {/* Duration & Dates */}
                            <div className="bg-secondary/30 dark:bg-black/20 border border-border rounded-xl p-4 flex justify-between items-center relative">
                                {/* Left: Start Date */}
                                <div className="flex flex-col">
                                    <span className="text-xs text-muted-foreground">Farming starts</span>
                                    {!reward.hasSelectedPeriod ? (
                                        <span className="text-base font-bold my-1 text-white/20">--/--/--</span>
                                    ) : (
                                        <>
                                            <span className="text-base font-bold my-1 text-foreground/80">
                                                {reward.startDate.getUTCFullYear()}/{reward.startDate.getUTCMonth() + 1}/{reward.startDate.getUTCDate()}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                {String(reward.startDate.getUTCHours()).padStart(2, '0')}:{String(reward.startDate.getUTCMinutes()).padStart(2, '0')} (UTC)
                                            </span>
                                        </>
                                    )}
                                </div>

                                {/* Middle: Select Button OR Days Input */}
                                <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
                                    <div className="h-[1px] w-8 lg:w-12 bg-white/10 border-t border-dashed border-border hidden sm:block"></div>

                                    {!reward.hasSelectedPeriod ? (
                                        <button
                                            onClick={() => updateReward(reward.id, "isDatePickerOpen", true)}
                                            className="bg-secondary/50 dark:bg-[#1a1b2e] hover:bg-secondary border border-border text-foreground text-sm font-bold py-1.5 px-6 rounded-lg transition-all"
                                        >
                                            Select
                                        </button>
                                    ) : (
                                        <div
                                            className="bg-secondary/50 dark:bg-[#1a1b2e] hover:border-[#0D9B5F]/40 dark:hover:border-border border border-border rounded-lg flex items-center px-1 cursor-pointer transition-all animate-duration-pop"
                                            onClick={() => updateReward(reward.id, "isDatePickerOpen", true)}
                                        >
                                            <input
                                                type="number"
                                                min={7}
                                                max={90}
                                                value={reward.durationDays}
                                                onChange={(e) => {
                                                    let val = e.target.value;
                                                    // Instantly block numbers higher than 90 while typing
                                                    if (parseInt(val) > 90) {
                                                        val = "90";
                                                    }
                                                    updateReward(reward.id, "durationDays", val);
                                                }}
                                                onBlur={(e) => {
                                                    let val = parseInt(e.target.value);
                                                    // When they click away, if it's blank or less than 7, snap it to 7
                                                    if (isNaN(val) || val < 7) val = 7;
                                                    updateReward(reward.id, "durationDays", val.toString());
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                                className="bg-transparent w-8 text-center text-sm font-bold outline-none py-1.5 text-foreground"
                                            />
                                            <span className="text-sm font-bold pr-2 text-foreground">Days</span>
                                        </div>
                                    )}

                                    <div className="h-[1px] w-8 lg:w-12 bg-white/10 border-t border-dashed border-border hidden sm:block"></div>
                                </div>

                                {/* Right: End Date */}
                                <div className="flex flex-col items-end">
                                    <span className="text-xs text-muted-foreground">Farming ends</span>
                                    {!reward.hasSelectedPeriod ? (
                                        <span className="text-base font-bold my-1 text-white/20">--/--/--</span>
                                    ) : (
                                        <>
                                            <span className="text-base font-bold my-1 text-foreground/80">
                                                {endDate.getUTCFullYear()}/{endDate.getUTCMonth() + 1}/{endDate.getUTCDate()}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                {String(endDate.getUTCHours()).padStart(2, '0')}:{String(endDate.getUTCMinutes()).padStart(2, '0')} (UTC)
                                            </span>
                                        </>
                                    )}
                                </div>

                                {/* Date Picker Overlay - Now opens directly without the extra wrapper */}
                                {reward.isDatePickerOpen && (
                                    <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-50 shadow-2xl">
                                        <DateTimePicker
                                            inline={true}
                                            value={reward.startDate}
                                            onChange={(d) => {
                                                setRewards(prev => prev.map(r => r.id === reward.id ? {
                                                    ...r,
                                                    startDate: d,
                                                    hasSelectedPeriod: true,
                                                    isDatePickerOpen: false
                                                } : r));
                                            }}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Estimates */}
                            <div className="bg-secondary/30 dark:bg-black/20 border border-border rounded-xl p-4 flex justify-between items-center text-sm">
                                <span className="text-muted-foreground text-xs">Estimated rewards / week</span>
                                <span className="font-bold text-lg text-foreground/90">
                                    {isFinite(weeklyEstimate) && durationInt > 0 ? weeklyEstimate.toFixed(2) : "0"} {reward.token?.symbol || ""}
                                </span>
                            </div>
                        </div>
                    );
                })}


                <div className="flex gap-3 pt-2">
                    <button
                        onClick={() => setCurrentStep(1)}
                        className="w-1/3 border border-border text-muted-foreground font-bold py-4 rounded-xl hover:border-border hover:text-foreground transition-all"
                    >
                        Back
                    </button>
                    <button
                        onClick={() => setCurrentStep(3)}
                        disabled={!isStep2Valid}
                        className={`w-2/3 font-bold py-4 rounded-xl transition-all ${isStep2Valid
                            ? "bg-[var(--neon-teal)] text-[#0c0d14] hover:opacity-90 shadow-[0_0_15px_rgba(45,212,191,0.2)]"
                            : "bg-[var(--neon-teal)]/10 text-[var(--neon-teal)]/30 cursor-not-allowed"}`}
                    >
                        Next Step
                    </button>
                </div>
            </div>

            <TokenSelectorModal
                isOpen={isTokenSelectorOpen}
                onClose={() => setIsTokenSelectorOpen(false)}
                onSelectToken={handleTokenSelect}
                balances={balancesMap}
                balancesLoading={balancesLoading}
                discoveredTokens={discoveredTokens}
            />
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
            // Initialize Raydium SDK first
            const raydium = await Raydium.load({
                owner: publicKey,
                connection,
                cluster: "devnet",
                disableFeatureCheck: true,
                disableLoadToken: false,
                signAllTransactions,
            });

            if (poolKind === "standard") {
                // Fetch pool type first
                const res = await fetch(
                    `https://api-v3-devnet.raydium.io/pools/info/ids?ids=${selectedPoolId}`
                );
                const json = await res.json();
                const pool = json?.data?.[0];

                if (!pool) {
                    throw new Error("Pool not found.");
                }

                // Check program ID to determine if Legacy or CPMM
                const LEGACY_PROGRAM = DEVNET_PROGRAM_ID.AMM_V4.toBase58();
                const CPMM_PROGRAM = DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM.toBase58();

                if (pool.programId === CPMM_PROGRAM) {
                    // CPMM — SDK doesn't support this yet
                    throw new Error(
                        "CPMM farm creation is not yet available. Please use a CLMM pool to create a permissionless farm."
                    );
                }

                if (pool.programId === LEGACY_PROGRAM) {
                    // Legacy AMM v4 — use farm.create
                    const poolInfoRaw = await raydium.api.fetchPoolById({ ids: selectedPoolId });
                    if (!poolInfoRaw || poolInfoRaw.length === 0) {
                        throw new Error("Pool not found.");
                    }

                    const durationSeconds = parseInt(rewards[0].durationDays) * 24 * 60 * 60;
                    const rewardAmountRaw = new Decimal(rewards[0].amount)
                        .mul(10 ** (rewards[0].token?.decimals || 9));
                    const perSecond = rewardAmountRaw.div(durationSeconds).floor();
                    const openTime = Math.floor(rewards[0].startDate.getTime() / 1000);
                    const endTime = openTime + durationSeconds;

                    const { execute } = await raydium.farm.create({
                        poolInfo: poolInfoRaw[0] as ApiV3PoolInfoStandardItem,
                        rewardInfos: [{
                            mint: new PublicKey(rewards[0].token!.mint),
                            perSecond: perSecond.toString(),
                            openTime,
                            endTime,
                            rewardType: "Standard SPL"
                        }],
                        txVersion: TxVersion.LEGACY
                    });

                    const { txId } = await execute({ sendAndConfirm: true });
                    setTxSig(txId);
                    setIsCreating(false);
                    setTimeout(() => router.push("/liquidity"), 2000);
                    return;
                }

                throw new Error("Unknown pool type. Cannot create farm.");
            }

            console.log("Fetching pool info for", selectedPoolId);
            const poolInfoRaw = await raydium.api.fetchPoolById({ ids: selectedPoolId });
            if (!poolInfoRaw || poolInfoRaw.length === 0) {
                throw new Error("Pool not found. Check ID or connection.");
            }

            const poolInfo = poolInfoRaw[0];

            // Get existing rewards from on-chain state (more reliable than API)
            let existingRewardMints: string[] = [];
            try {
                const rpcPoolInfos = await raydium.clmm.getRpcClmmPoolInfos({ poolIds: [selectedPoolId] });
                const rpcPool = rpcPoolInfos[selectedPoolId];
                if (rpcPool && rpcPool.rewardInfos) {
                    existingRewardMints = rpcPool.rewardInfos
                        .filter((r: any) => r.tokenMint && r.tokenMint.toString() !== "11111111111111111111111111111111")
                        .map((r: any) => r.tokenMint.toString().toLowerCase());
                    console.log("On-chain existing rewards:", existingRewardMints);
                }
            } catch (rpcErr) {
                console.log("Failed to get RPC pool info, falling back to API:", rpcErr);
                // Fallback to API data
                existingRewardMints = (poolInfo.rewardDefaultInfos || []).map(
                    (r: any) => r.mint?.address?.toLowerCase()
                );
            }
            console.log("Existing rewards on pool:", existingRewardMints);

            let activeTxSig = "";

            // Filter out rewards that are already on the pool
            let rewardsToProcess = [...rewards].filter((r) => {
                if (!r.token) return false;
                const tokenMint = r.token.mint.toLowerCase();
                const isDuplicate = existingRewardMints.includes(tokenMint);
                if (isDuplicate) {
                    console.log(`Skipping ${r.token.symbol} - already exists on pool`);
                }
                return !isDuplicate;
            });

            console.log(`Processing ${rewardsToProcess.length} new rewards (filtered from ${rewards.length})`);

            if (rewardsToProcess.length === 0) {
                setTxError("All selected rewards are already added to this pool.");
                setIsCreating(false);
                return;
            }

            // --- THE RAYDIUM "SLOT 2" RULE FIX ---
            // Raydium Error 6032: Third-party tokens MUST go into the 3rd slot (index 2).
            // Slots 0 & 1 are reserved for pool's native tokens (mintA or mintB).
            // Pool: BIET/USDC, so BIET and USDC can use slots 0 & 1, but PLTR must go to slot 2
            const poolMintA = poolInfo.mintA?.address?.toLowerCase();
            const poolMintB = poolInfo.mintB?.address?.toLowerCase();

            const isThirdParty = rewardsToProcess.some(r =>
                r.token &&
                r.token.mint.toLowerCase() !== poolMintA &&
                r.token.mint.toLowerCase() !== poolMintB
            );

            if (isThirdParty) {
                console.log("Third-party token detected! Forcing SDK to target Slot 2...");

                // Count actual taken slots from on-chain
                let takenSlots = existingRewardMints.length;

                // Pad the array so SDK skips to Slot 2
                if (!poolInfo.rewardDefaultInfos) poolInfo.rewardDefaultInfos = [];

                // Ensure we have enough padding to reach slot 2 (index 2)
                while (poolInfo.rewardDefaultInfos.length < Math.max(2, takenSlots)) {
                    // Use a minimal padding object - the SDK will use this to determine slot assignment
                    (poolInfo.rewardDefaultInfos as any[]).push({
                        mint: { address: "11111111111111111111111111111111" }, // dummy
                        perSecond: "0",
                        startTime: "0",
                        endTime: "0",
                        isPadding: true
                    });
                }
                console.log("Padded rewardDefaultInfos to length:", poolInfo.rewardDefaultInfos.length);
            }
            // ------------------------------------------

            // Build ALL rewards into a single array (batch approach)
            // This avoids stale pool state issues when sending multiple separate transactions
            const rewardInfos: {
                mint: {
                    chainId: number;
                    address: string;
                    programId: string;
                    logoURI: string;
                    symbol: string;
                    name: string;
                    decimals: number;
                    tags: string[];
                    extensions: Record<string, unknown>;
                };
                perSecond: Decimal;
                openTime: number;
                endTime: number;
            }[] = [];

            for (const r of rewardsToProcess) {
                if (!r.token) continue;

                const durationSeconds = parseInt(r.durationDays || "7") * 24 * 60 * 60;
                const rewardAmountRaw = new Decimal(r.amount || "0").mul(10 ** r.token.decimals);
                const perSecondRaw = rewardAmountRaw.div(durationSeconds).floor();

                let openTime = Math.floor(r.startDate.getTime() / 1000);
                const currentUnix = Math.floor(Date.now() / 1000);

                if (openTime <= currentUnix + 15) {
                    openTime = currentUnix + 30; // 30 second safe buffer
                }
                const endTime = openTime + durationSeconds;

                rewardInfos.push({
                    mint: {
                        chainId: 103, // Devnet
                        address: r.token.mint,
                        programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
                        logoURI: r.token.logoURI || "",
                        symbol: r.token.symbol,
                        name: r.token.name,
                        decimals: r.token.decimals,
                        tags: [],
                        extensions: {}
                    },
                    perSecond: perSecondRaw,
                    openTime,
                    endTime
                });
            }

            if (rewardInfos.length === 0) {
                setTxError("No valid rewards to add to the farm.");
                setIsCreating(false);
                return;
            }

            // Get pool keys for proper transaction construction
            console.log("Fetching pool keys...");
            const poolKeys = await raydium.clmm.getClmmPoolKeys(selectedPoolId);
            console.log("Pool keys fetched:", poolKeys ? "Success" : "Failed");

            console.log(`Executing batch initRewards for ${rewardInfos.length} reward(s)`);
            console.log("Reward infos:", JSON.stringify(rewardInfos, null, 2));

            try {
                // Execute SINGLE transaction with ALL rewards
                const { execute } = await raydium.clmm.initRewards({
                    poolInfo: poolInfo as any,
                    poolKeys: poolKeys as any,
                    ownerInfo: {
                        useSOLBalance: true
                    },
                    rewardInfos: rewardInfos,
                    txVersion: TxVersion.LEGACY
                });

                console.log("Transaction built, executing...");
                const { txId } = await execute({ sendAndConfirm: true });
                activeTxSig = txId;
                setTxSig(txId);
            } catch (execErr: any) {
                console.error("Execution error:", execErr);
                throw execErr;
            }

            setIsCreating(false);
            setTimeout(() => router.push("/liquidity"), 2000);

        } catch (err: any) {
            console.error("Farm creation err", err);
            // If the user rejected the transaction
            setTxError(err?.message || "Failed to create farm.");
            setIsCreating(false);
        }
    };

    // Step 3 — Review
    const renderStep3 = () => (
        <div className="w-full md:w-2/3">
            <h2 className="text-xl font-bold mb-6">Review farm details</h2>

            <div className="bg-[rgba(220,240,232,0.45)] dark:bg-[rgba(255,255,255,0.03)] backdrop-blur-[6px] border border-black/[0.06] dark:border-[rgba(255,255,255,0.08)] shadow-[0_2px_16px_0_rgba(0,0,0,0.06)] dark:shadow-[0_2px_12px_0_rgba(0,0,0,0.12)] rounded-2xl p-6 flex flex-col gap-4">
                <div className="flex flex-col gap-3">
                    <div className="flex justify-between items-center py-2 border-b border-border/50">
                        <span className="text-sm text-muted-foreground">Pool Type</span>
                        <span className="text-sm font-bold text-foreground">{poolKind === "clmm" ? "Concentrated Liquidity (CLMM)" : "Standard AMM"}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border/50">
                        <span className="text-sm text-muted-foreground">Selected Pool ID</span>
                        <span className="text-sm font-bold text-foreground">{selectedPoolId ? `${selectedPoolId.slice(0, 6)}...${selectedPoolId.slice(-4)}` : "—"}</span>
                    </div>

                    {rewards.map((r, i) => {
                        const durationInt = parseInt(r.durationDays) || 0;
                        const endDate = new Date(r.startDate.getTime() + durationInt * 24 * 60 * 60 * 1000);
                        const dailyRate = durationInt > 0 ? (parseFloat(r.amount || "0") / durationInt) : 0;

                        const formatDate = (date: Date) => {
                            return `${date.getUTCFullYear()}/${date.getUTCMonth() + 1}/${date.getUTCDate()} ${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')} (UTC)`;
                        };

                        return (
                            <div key={r.id} className="mt-4 border border-[var(--neon-teal)]/30 bg-gradient-to-b from-[var(--neon-teal)]/5 to-transparent rounded-xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.2)]">
                                {/* Card Header */}
                                <div className="bg-[var(--neon-teal)]/10 px-4 py-3 border-b border-[var(--neon-teal)]/20 flex justify-between items-center">
                                    <h4 className="text-[var(--neon-teal)] text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                                        Reward {i + 1}
                                    </h4>
                                    {r.token && <TokenIcon logo={r.token.logoURI} symbol={r.token.symbol} size={20} />}
                                </div>

                                {/* Card Body */}
                                <div className="p-4 flex flex-col gap-3">
                                    {/* Amounts */}
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs text-muted-foreground">Total Amount</span>
                                        <span className="text-sm font-bold text-foreground">{r.amount} {r.token?.symbol}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs text-muted-foreground">Estimated Rate</span>
                                        <span className="text-sm font-bold text-[var(--neon-teal)]">~{dailyRate.toFixed(4)} {r.token?.symbol} / day</span>
                                    </div>

                                    <div className="h-[1px] w-full bg-border my-1"></div>

                                    {/* Dates */}
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs text-muted-foreground">Start Date</span>
                                        <span className="text-xs font-medium text-foreground/80">{formatDate(r.startDate)}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs text-muted-foreground">End Date</span>
                                        <span className="text-xs font-medium text-foreground/80">{formatDate(endDate)}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs text-muted-foreground">Duration</span>
                                        <span className="text-xs font-medium text-foreground/80">{r.durationDays} Days</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
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
                            className={`flex-1 border border-border text-muted-foreground font-bold py-4 rounded-xl transition-all ${isCreating ? "opacity-50 cursor-not-allowed" : "hover:border-border hover:text-foreground"}`}
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
        <main className="container mx-auto px-4 py-12 flex flex-col items-center min-h-screen text-foreground">
            <div className="w-full max-w-5xl flex flex-col md:flex-row gap-8">
                {renderStepper()}
                {currentStep === 1 && renderStep1()}
                {currentStep === 2 && renderStep2()}
                {currentStep === 3 && renderStep3()}
            </div>
        </main>
    );
}
