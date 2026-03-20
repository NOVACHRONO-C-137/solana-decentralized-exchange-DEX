"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, CheckCircle2, AlertCircle, ArrowLeft, Plus } from "lucide-react";
import { StepperSidebar } from "@/components/liquidity/StepperSidebar";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { Raydium, TxVersion } from "@raydium-io/raydium-sdk-v2";
import Decimal from "decimal.js";
import { TokenInfo, TokenSelectorModal } from "@/components/liquidity/TokenSelectorModal";
import { DateTimePicker } from "@/components/liquidity/DateTimePicker";
import { useTokenBalances } from "@/hooks/useTokenBalances";
import TokenIcon from "@/components/liquidity/TokenIcon";
import { notify } from "@/lib/toast";
import { discoverOnChainPoolIds, discoverCreatedPools } from "@/lib/pool-discovery";
import { createWrappedSignAll } from "@/lib/raydium-execute";
import { parseTokenAccountResp } from "@raydium-io/raydium-sdk-v2";
import { formatLargeNumber } from "@/lib/utils";

type RewardConfig = {
    id: string;
    token: TokenInfo | null;
    amount: string;
    startDate: Date;
    durationDays: string;
    isDatePickerOpen: boolean;
    hasSelectedPeriod: boolean;
};

export default function CreateFarmPage() {
    const router = useRouter();
    const { publicKey, sendTransaction, signAllTransactions, connected } = useWallet();
    const { connection } = useConnection();

    // Core state
    const [currentStep, setCurrentStep] = useState<number>(1);
    const [selectedPoolId, setSelectedPoolId] = useState<string>("");

    const getInitialRewardDate = () => {
        const d = new Date();
        d.setMinutes(d.getMinutes() + 5);
        return d;
    };

    const [rewards, setRewards] = useState<RewardConfig[]>([
        { id: "1", token: null, amount: "", startDate: getInitialRewardDate(), durationDays: "7", isDatePickerOpen: false, hasSelectedPeriod: false }
    ]);

    const [isTokenSelectorOpen, setIsTokenSelectorOpen] = useState(false);
    const [editingTokenIndex, setEditingTokenIndex] = useState<number | null>(null);

    // Transaction states
    const [isCreating, setIsCreating] = useState(false);
    const [txSig, setTxSig] = useState<string | null>(null);
    const [txError, setTxError] = useState<string | null>(null);

    const { balances: tokenBalances, discoveredTokens, loading: balancesLoading } = useTokenBalances();
    const balancesMap = new Map<string, number>();
    tokenBalances?.forEach((tb: { balance: number }, mint: string) => balancesMap.set(mint, tb.balance));
    const [customPools, setCustomPools] = useState<any[]>([]);
    const [isLoadingPools, setIsLoadingPools] = useState<boolean>(true);

    // Fetch User's CLMM Pools
    useEffect(() => {
        const loadPools = async () => {
            setIsLoadingPools(true);
            const allIds = new Set<string>();

            if (publicKey && connected && connection) {
                try {
                    const [createdPoolIds, positionPoolIds] = await Promise.all([
                        discoverCreatedPools(connection, publicKey),
                        discoverOnChainPoolIds(connection, publicKey),
                    ]);
                    for (const id of createdPoolIds) allIds.add(id);
                    for (const id of positionPoolIds) allIds.add(id);
                } catch (err) { console.error("Error discovering pools", err); }
            }

            const idsArray = Array.from(allIds);
            if (idsArray.length === 0) {
                setCustomPools([]);
                setIsLoadingPools(false);
                return;
            }

            try {
                const apiUrl = `https://api-v3-devnet.raydium.io/pools/info/ids?ids=${idsArray.join(",")}`;
                const res = await fetch(apiUrl);
                const json = await res.json();

                if (json.data && Array.isArray(json.data)) {
                    // Strictly filter for CLMM only
                    const validPools = json.data.filter((p: any) => p != null && p.mintA && p.mintB && p.type === "Concentrated");
                    const formattedPools = validPools.map((live: any) => ({
                        id: live.id,
                        name: `${live.mintA?.symbol || "?"}-${live.mintB?.symbol || "?"}`,
                        symbolA: live.mintA?.symbol || "?",
                        symbolB: live.mintB?.symbol || "?",
                        logoA: live.mintA?.logoURI,
                        logoB: live.mintB?.logoURI,
                        fee: live.feeRate ? `${(live.feeRate < 1 ? live.feeRate * 100 : live.feeRate).toFixed(2)}%` : "0.25%",
                        type: "Concentrated",
                    }));
                    setCustomPools(formattedPools);
                }
            } catch (err) {
                console.error("API Fetch Error", err);
            } finally {
                setIsLoadingPools(false);
            }
        };

        loadPools();
    }, [connection, publicKey, connected]);

    // ==========================================
    // EXECUTION: CLMM FARM CREATION LOGIC
    // ==========================================
    const handleCreateFarm = async () => {
        if (!publicKey || !signAllTransactions) {
            notify.error("Wallet not connected");
            return;
        }

        setIsCreating(true);
        setTxSig(null);
        setTxError(null);

        try {
            let manualTxId = "";
            const wrappedSignAll = await createWrappedSignAll(connection, signAllTransactions, (sig) => { manualTxId = sig; });
            const sdk = await Raydium.load({
                connection,
                owner: publicKey,
                cluster: "devnet",
                disableFeatureCheck: true,
                disableLoadToken: false,
                signAllTransactions: wrappedSignAll,
            });
            const rewardsToProcess = [...rewards].filter((r) => r.token && parseFloat(r.amount) > 0);
            if (rewardsToProcess.length === 0) throw new Error("No valid rewards selected.");

            console.log("Fetching CLMM pool info for", selectedPoolId);
            const poolInfoRaw = await sdk.api.fetchPoolById({ ids: selectedPoolId });
            if (!poolInfoRaw || poolInfoRaw.length === 0) {
                throw new Error("CLMM Pool not found. Check ID or connection.");
            }
            const poolInfo = poolInfoRaw[0];

            let lastTx = "";

            // The Stable Loop: Initialize one by one
            for (let i = 0; i < rewardsToProcess.length; i++) {
                const r = rewardsToProcess[i];
                if (!r.token) continue;

                const durationSeconds = (parseInt(r.durationDays || "7") * 24 * 60 * 60) + 1;
                const rewardAmountRaw = new Decimal(r.amount || "0").mul(10 ** r.token.decimals);

                // The crucial .floor() fix to prevent fractional revert bugs
                const perSecondRaw = rewardAmountRaw.div(durationSeconds).floor();

                let openTime = Math.floor(r.startDate.getTime() / 1000);
                const currentUnix = Math.floor(Date.now() / 1000);

                // Push time into the future to avoid "past time" block errors
                if (openTime <= currentUnix + 15) openTime = currentUnix + 30;

                console.log(`Executing CLMM reward ${i + 1} for token ${r.token.mint}`);

                const { execute } = await sdk.clmm.initRewards({
                    poolInfo: poolInfo as any,
                    poolKeys: undefined,
                    ownerInfo: { useSOLBalance: true },
                    rewardInfos: [{
                        mint: {
                            chainId: 103,
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
                        endTime: openTime + durationSeconds
                    }],
                    txVersion: TxVersion.LEGACY
                });

                const { txId } = await execute({ sendAndConfirm: true });
                lastTx = txId;
                setTxSig(txId);
                notify.success(`Reward ${r.token.symbol} initialized!`);
            }

            if (manualTxId) {
                setTxSig(manualTxId);
                notify.success("Farm created!");
                setTimeout(() => router.push("/liquidity"), 2000);
            }

            setCurrentStep(4);

        } catch (error: any) {
            console.error("Failed to create farm:", error);
            setTxError(error.message || "Transaction failed");
            notify.error(error.message || "Failed to create farm");
        } finally {
            setIsCreating(false);
        }
    };

    // ==========================================
    // UI RENDERS
    // ==========================================

    const renderStep1 = () => (
        <div className="w-full md:w-2/3">
            <h2 className="text-xl font-bold mb-6">First, select a pool for farm rewards</h2>
            <div className="bg-[rgba(220,240,232,0.45)] dark:bg-[rgba(255,255,255,0.03)] backdrop-blur-[6px] border border-black/[0.06] dark:border-[rgba(255,255,255,0.08)] rounded-2xl p-6 flex flex-col gap-5 shadow-[0_2px_16px_0_rgba(0,0,0,0.06)]">
                <p className="text-sm font-bold">Select CLMM Pool</p>

                <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar-teal relative">
                    {isLoadingPools && (
                        <div className="absolute inset-0 z-10 bg-card/80 backdrop-blur-sm flex items-center justify-center rounded-xl">
                            <Loader2 className="h-6 w-6 text-[var(--neon-teal)] animate-spin" />
                        </div>
                    )}

                    {customPools.map((p) => (
                        <button
                            key={p.id}
                            onClick={() => setSelectedPoolId(p.id)}
                            className={`flex items-center justify-between p-4 rounded-xl border text-sm transition-all ${selectedPoolId === p.id
                                ? "border-[var(--neon-teal)] bg-[var(--neon-teal)]/5 shadow-[0_0_10px_var(--neon-teal-glow)]"
                                : "border-border bg-secondary/30 dark:bg-black/20 hover:border-[#0D9B5F]/40 hover:bg-secondary/60"
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <div className="flex -space-x-2">
                                    <TokenIcon logo={p.logoA} symbol={p.symbolA} size={24} />
                                    <TokenIcon logo={p.logoB} symbol={p.symbolB} size={24} />
                                </div>
                                <div className="flex flex-col items-start">
                                    <span className="font-bold">{p.name}</span>
                                    <span className="text-[10px] text-muted-foreground">Concentrated · {p.fee}</span>
                                </div>
                            </div>
                            <span className="text-xs text-muted-foreground font-mono">
                                {p.id.slice(0, 6)}...{p.id.slice(-4)}
                            </span>
                        </button>
                    ))}

                    {!isLoadingPools && customPools.length === 0 && (
                        <div className="text-center py-8 px-4 rounded-xl border border-dashed border-border">
                            <p className="text-sm text-muted-foreground mb-2">No CLMM pools found for this wallet.</p>
                        </div>
                    )}
                </div>

                <button
                    disabled={!selectedPoolId}
                    onClick={() => setCurrentStep(2)}
                    className="w-full mt-4 py-3 rounded-xl font-bold bg-[var(--neon-teal)] text-black hover:bg-[#0D9B5F] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Continue
                </button>
            </div>
        </div>
    );

    const renderStep2 = () => (
        <div className="w-full md:w-2/3">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Next, enter rewards for the farm</h2>
            </div>
            <div className="flex flex-col gap-6">
                {rewards.map((reward, i) => {
                    const durationInt = parseInt(reward.durationDays) || 0;
                    const endDate = new Date(reward.startDate.getTime() + durationInt * 24 * 60 * 60 * 1000);
                    const weeklyEstimate = (parseFloat(reward.amount || "0") / durationInt) * 7;
                    return (
                        <div key={reward.id} className="bg-[rgba(220,240,232,0.45)] dark:bg-[rgba(255,255,255,0.03)] backdrop-blur-[6px] border border-black/[0.06] dark:border-[rgba(255,255,255,0.08)] shadow-[0_2px_16px_0_rgba(0,0,0,0.06)] dark:shadow-[0_2px_12px_0_rgba(0,0,0,0.12)] rounded-2xl p-6 flex flex-col gap-5 relative">
                            <div>
                                <h3 className="text-base font-bold">Reward Token {i + 1}</h3>
                                <p className="text-sm text-muted-foreground mt-1">You can add up to 3 reward tokens.</p>
                            </div>
                            {/* Token Select & Amount */}
                            <div className="bg-secondary/30 dark:bg-black/20 border border-border rounded-xl p-4 flex justify-between items-center">
                                <button
                                    onClick={() => { setEditingTokenIndex(i); setIsTokenSelectorOpen(true); }}
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
                                            {reward.token ? formatLargeNumber(balancesMap.get(reward.token.mint) || 0) : 0}
                                        </div>
                                        {reward.token && (
                                            <>
                                                <button onClick={() => { const newR = [...rewards]; newR[i].amount = String(balancesMap.get(reward.token!.mint) || 0); setRewards(newR); }} className="text-xs bg-secondary/50 dark:bg-white/5 hover:bg-secondary dark:hover:bg-white/10 px-2 rounded text-muted-foreground transition-all">Max</button>
                                                <button onClick={() => { const newR = [...rewards]; newR[i].amount = String((balancesMap.get(reward.token!.mint) || 0) * 0.5); setRewards(newR); }} className="text-xs bg-secondary/50 dark:bg-white/5 hover:bg-secondary dark:hover:bg-white/10 px-2 rounded text-muted-foreground transition-all">50%</button>
                                            </>
                                        )}
                                    </div>
                                    <input
                                        type="number"
                                        placeholder="0"
                                        value={reward.amount}
                                        onChange={(e) => { const newR = [...rewards]; newR[i].amount = e.target.value; setRewards(newR); }}
                                        className="bg-transparent text-right text-2xl font-bold text-foreground outline-none w-full placeholder:text-muted-foreground/30"
                                    />
                                    <span className="text-xs text-muted-foreground mt-1">~$0</span>
                                </div>
                            </div>
                            {/* Duration & Dates */}
                            <div className="bg-secondary/30 dark:bg-black/20 border border-border rounded-xl p-4 flex justify-between items-center relative">
                                <div className="flex flex-col">
                                    <span className="text-xs text-muted-foreground">Farming starts</span>
                                    {!reward.hasSelectedPeriod ? (
                                        <span className="text-base font-bold my-1 text-white/20">--/--/--</span>
                                    ) : (
                                        <>
                                            <span className="text-base font-bold my-1 text-foreground/80">{reward.startDate.getUTCFullYear()}/{reward.startDate.getUTCMonth() + 1}/{reward.startDate.getUTCDate()}</span>
                                            <span className="text-xs text-muted-foreground">{String(reward.startDate.getUTCHours()).padStart(2, '0')}:{String(reward.startDate.getUTCMinutes()).padStart(2, '0')} (UTC)</span>
                                        </>
                                    )}
                                </div>
                                <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
                                    {!reward.hasSelectedPeriod ? (
                                        <button
                                            onClick={() => { const newR = [...rewards]; newR[i].isDatePickerOpen = true; setRewards(newR); }}
                                            className="bg-secondary/50 dark:bg-[#1a1b2e] hover:bg-secondary border border-border text-foreground text-sm font-bold py-1.5 px-6 rounded-lg transition-all"
                                        >Select</button>
                                    ) : (
                                        <div className="bg-secondary/50 dark:bg-[#1a1b2e] border border-border rounded-lg flex items-center px-1 cursor-pointer" onClick={() => { const newR = [...rewards]; newR[i].isDatePickerOpen = true; setRewards(newR); }}>
                                            <input
                                                type="number" min={7} max={90}
                                                value={reward.durationDays}
                                                onChange={(e) => { const newR = [...rewards]; newR[i].durationDays = e.target.value; setRewards(newR); }}
                                                onClick={(e) => e.stopPropagation()}
                                                className="bg-transparent w-8 text-center text-sm font-bold outline-none py-1.5 text-foreground"
                                            />
                                            <span className="text-sm font-bold pr-2 text-foreground">Days</span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-xs text-muted-foreground">Farming ends</span>
                                    {!reward.hasSelectedPeriod ? (
                                        <span className="text-base font-bold my-1 text-white/20">--/--/--</span>
                                    ) : (
                                        <>
                                            <span className="text-base font-bold my-1 text-foreground/80">{endDate.getUTCFullYear()}/{endDate.getUTCMonth() + 1}/{endDate.getUTCDate()}</span>
                                            <span className="text-xs text-muted-foreground">{String(endDate.getUTCHours()).padStart(2, '0')}:{String(endDate.getUTCMinutes()).padStart(2, '0')} (UTC)</span>
                                        </>
                                    )}
                                </div>
                                {reward.isDatePickerOpen && (
                                    <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-50 shadow-2xl">
                                        <DateTimePicker
                                            inline={true}
                                            value={reward.startDate}
                                            onChange={(d) => {
                                                const newR = [...rewards];
                                                newR[i] = { ...newR[i], startDate: d, hasSelectedPeriod: true, isDatePickerOpen: false };
                                                setRewards(newR);
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
                            {/* Estimate */}
                            <div className="bg-secondary/30 dark:bg-black/20 border border-border rounded-xl p-4 flex justify-between items-center text-sm">
                                <span className="text-muted-foreground text-xs">Estimated rewards / week</span>
                                <span className="font-bold text-lg text-foreground/90">{isFinite(weeklyEstimate) && durationInt > 0 ? weeklyEstimate.toFixed(2) : "0"} {reward.token?.symbol || ""}</span>
                            </div>
                        </div>
                    );
                })}
                <div className="flex gap-3 pt-2">
                    <button onClick={() => setCurrentStep(1)} className="w-1/3 border border-border text-muted-foreground font-bold py-4 rounded-xl hover:text-foreground transition-all">Back</button>
                    <button
                        onClick={() => setCurrentStep(3)}
                        disabled={!rewards.every(r => r.token && r.amount && parseFloat(r.amount) > 0 && r.hasSelectedPeriod)}
                        className={`w-2/3 font-bold py-4 rounded-xl transition-all ${rewards.every(r => r.token && r.amount && parseFloat(r.amount) > 0 && r.hasSelectedPeriod) ? "bg-[var(--neon-teal)] text-[#0c0d14] hover:opacity-90" : "bg-[var(--neon-teal)]/10 text-[var(--neon-teal)]/30 cursor-not-allowed"}`}
                    >Next Step</button>
                </div>
            </div>
            <TokenSelectorModal
                isOpen={isTokenSelectorOpen}
                onClose={() => setIsTokenSelectorOpen(false)}
                onSelectToken={(token) => {
                    if (editingTokenIndex !== null) { const newR = [...rewards]; newR[editingTokenIndex].token = token; setRewards(newR); }
                    setIsTokenSelectorOpen(false);
                    setEditingTokenIndex(null);
                }}
                balances={balancesMap}
                balancesLoading={balancesLoading}
                discoveredTokens={discoveredTokens}
            />
        </div>
    );

    const renderStep3 = () => (
        <div className="w-full md:w-2/3">
            <h2 className="text-xl font-bold mb-6">Review & Submit</h2>

            <div className="bg-[rgba(220,240,232,0.45)] dark:bg-[rgba(255,255,255,0.03)] backdrop-blur-[6px] border border-black/[0.06] dark:border-[rgba(255,255,255,0.08)] rounded-2xl p-6 shadow-[0_2px_16px_0_rgba(0,0,0,0.06)]">
                <div className="mb-4">
                    <p className="text-xs text-muted-foreground">Selected Pool ID</p>
                    <p className="font-mono text-sm break-all">{selectedPoolId}</p>
                </div>

                {rewards.map((r, i) => r.token && (
                    <div key={i} className="mt-4 p-4 rounded-xl bg-gradient-to-r from-[var(--neon-teal)]/10 to-transparent border border-[var(--neon-teal)]/20">
                        <div className="flex items-center gap-3 mb-3">
                            <TokenIcon logo={r.token.logoURI} symbol={r.token.symbol} size={32} />
                            <div>
                                <p className="text-sm font-bold">{r.token.symbol}</p>
                                <p className="text-[10px] text-muted-foreground">{r.token.name}</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <p className="text-[10px] text-muted-foreground">Total Amount</p>
                                <p className="font-mono text-sm font-bold text-[var(--neon-teal)]">{r.amount} {r.token.symbol}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-muted-foreground">Est. Rate</p>
                                <p className="font-mono text-sm font-bold text-[var(--neon-teal)]">
                                    {r.amount && r.durationDays
                                        ? (parseFloat(r.amount) / parseInt(r.durationDays) * 7).toFixed(2)
                                        : "0.00"} {r.token.symbol}/wk
                                </p>
                            </div>
                            <div className="col-span-2">
                                <p className="text-[10px] text-muted-foreground">Duration</p>
                                <p className="font-mono text-sm font-bold">{r.durationDays} Days</p>
                            </div>
                        </div>
                    </div>
                ))}

                {txError && (
                    <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex gap-2">
                        <AlertCircle className="w-4 h-4 mt-0.5" />
                        <p>{txError}</p>
                    </div>
                )}

                <div className="flex gap-3 mt-6">
                    <button
                        onClick={() => setCurrentStep(2)}
                        disabled={isCreating}
                        className={`flex-1 border border-border text-muted-foreground font-bold py-4 rounded-xl transition-all ${isCreating ? "opacity-50 cursor-not-allowed" : "hover:text-foreground"}`}
                    >
                        Back
                    </button>
                    <button
                        onClick={handleCreateFarm}
                        disabled={isCreating}
                        className={`flex-1 flex justify-center items-center bg-[var(--neon-teal)] text-black font-bold py-4 rounded-xl transition-all ${isCreating ? "opacity-70 cursor-not-allowed" : "hover:opacity-90"}`}
                    >
                        {isCreating && <Loader2 className="h-5 w-5 mr-2 animate-spin" />}
                        {isCreating ? "Creating..." : "Confirm & Create Farm"}
                    </button>
                </div>
            </div>
        </div>
    );

    const renderStep4 = () => (
        <div className="w-full md:w-2/3 flex flex-col items-center justify-center text-center py-12">
            <CheckCircle2 className="w-20 h-20 text-[var(--neon-teal)] mb-6" />
            <h2 className="text-3xl font-bold mb-2">Farm Successfully Created!</h2>
            <p className="text-muted-foreground mb-8">Your reward emissions are locked and initialized.</p>

            <div className="flex gap-4">
                <button
                    onClick={() => window.open(`https://solscan.io/tx/${txSig}?cluster=devnet`, "_blank")}
                    className="px-6 py-3 rounded-xl font-bold border border-border hover:border-[var(--neon-teal)] transition-all"
                >
                    View on Solscan
                </button>
                <button
                    onClick={() => router.push("/liquidity")}
                    className="px-6 py-3 rounded-xl font-bold bg-[var(--neon-teal)] text-black hover:bg-[#0D9B5F] transition-all"
                >
                    Return to Pools
                </button>
            </div>
        </div>
    );

    return (
        <main className="container mx-auto px-4 pt-28 pb-12 flex flex-col items-center min-h-screen text-foreground">
            <div className="w-full max-w-5xl flex flex-col md:flex-row gap-8">
                <StepperSidebar
                    steps={[{ n: 1, label: "Select Pool" }, { n: 2, label: "Add Rewards" }, { n: 3, label: "Review Farm Detail" }]}
                    currentStep={currentStep > 3 ? 3 : currentStep}
                    note={<>A farm can be created for any CLMM pool.</>}
                />
                {currentStep === 1 && renderStep1()}
                {currentStep === 2 && renderStep2()}
                {currentStep === 3 && renderStep3()}
                {currentStep === 4 && renderStep4()}

                <TokenSelectorModal
                    isOpen={isTokenSelectorOpen}
                    onClose={() => setIsTokenSelectorOpen(false)}
                    onSelectToken={(token) => {
                        if (editingTokenIndex !== null) {
                            const newRewards = [...rewards];
                            newRewards[editingTokenIndex].token = token;
                            setRewards(newRewards);
                        }
                        setIsTokenSelectorOpen(false);
                    }}
                    balances={balancesMap}
                    balancesLoading={balancesLoading}
                    discoveredTokens={discoveredTokens}
                />
            </div>
        </main>
    );
}