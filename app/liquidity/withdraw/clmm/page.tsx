"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { Transaction, VersionedTransaction } from "@solana/web3.js";
import { Raydium, TxVersion, DEVNET_PROGRAM_ID } from "@raydium-io/raydium-sdk-v2";
import BN from "bn.js";
import { ChevronLeft, Loader2, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { formatLargeNumber } from "@/lib/utils";
import TokenIcon from "@/components/liquidity/TokenIcon";

// ── Position card ─────────────────────────────────────────
interface PositionInfo {
    nftMint: string;
    poolId: string;
    tickLower: number;
    tickUpper: number;
    liquidity: BN;
    liquidityHuman: number;
    tokenFeeAmountA: BN;
    tokenFeeAmountB: BN;
    raw: any;
}

export default function WithdrawCLMMPage() {
    const router = useRouter();
    const params = useSearchParams();
    const { publicKey, sendTransaction, connected, signAllTransactions } = useWallet();
    const { connection } = useConnection();

    // ── URL params ────────────────────────────────────────
    const poolId = params.get("poolId") || "";
    const symbolA = params.get("symbolA") || "Token A";
    const symbolB = params.get("symbolB") || "Token B";
    const logoA = params.get("logoA") || undefined;
    const logoB = params.get("logoB") || undefined;
    const fee = params.get("fee") || "0.25%";

    // ── State ─────────────────────────────────────────────
    const [positions, setPositions] = useState<PositionInfo[]>([]);
    const [poolInfo, setPoolInfo] = useState<any>(null);
    const [poolKeys, setPoolKeys] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
    const [txError, setTxError] = useState<string | null>(null);
    const [txSig, setTxSig] = useState<string | null>(null);

    // ── Load positions ────────────────────────────────────
    const loadPositions = useCallback(async () => {
        if (!publicKey || !connected || !poolId) return;
        setLoading(true);
        setTxError(null);
        try {
            const raydium = await Raydium.load({
                owner: publicKey,
                connection,
                cluster: "devnet",
                disableFeatureCheck: true,
                disableLoadToken: false,
            });

            // Fetch pool info from RPC (devnet — API doesn't index devnet CLMM)
            const { poolInfo: info, poolKeys: keys } = await raydium.clmm.getPoolInfoFromRpc(poolId);

            setPoolInfo(info);
            setPoolKeys(keys);

            // Fetch all owner positions and filter by this pool
            const allPositions = await raydium.clmm.getOwnerPositionInfo({
                programId: DEVNET_PROGRAM_ID.CLMM_PROGRAM_ID,
            });

            console.log("[CLMM Withdraw] All positions:", allPositions.length);
            console.log("[CLMM Withdraw] Raw all positions:", JSON.stringify(allPositions.map((p: any) => ({
                nftMint: p.nftMint?.toString(),
                poolId: p.poolId?.toString(),
                liquidity: p.liquidity?.toString(),
                tickLower: p.tickLower,
                tickUpper: p.tickUpper,
                tokenFeeAmountA: p.tokenFeeAmountA?.toString(),
                tokenFeeAmountB: p.tokenFeeAmountB?.toString(),
            }))));
            const poolPositions = allPositions.filter(
                (p: any) => p.poolId.toString() === poolId
            );
            console.log("[CLMM Withdraw] Positions for this pool:", poolPositions.length);
            console.log("[CLMM Withdraw] Filtered positions for pool", poolId, ":", poolPositions.length);
            poolPositions.forEach((p: any, i: number) => {
                console.log(`[CLMM Withdraw] Position ${i}:`, {
                    nftMint: p.nftMint?.toString(),
                    liquidity: p.liquidity?.toString(),
                    isZero: p.liquidity?.isZero(),
                    tickLower: p.tickLower,
                    tickUpper: p.tickUpper,
                });
            });

            const formatted: PositionInfo[] = poolPositions.map((p: any) => ({
                nftMint: p.nftMint.toString(),
                poolId: p.poolId.toString(),
                tickLower: p.tickLower,
                tickUpper: p.tickUpper,
                liquidity: p.liquidity,
                liquidityHuman: p.liquidity.toNumber() / 1e6,
                tokenFeeAmountA: p.tokenFeeAmountA || new BN(0),
                tokenFeeAmountB: p.tokenFeeAmountB || new BN(0),
                raw: p,
            }));

            setPositions(formatted);
        } catch (err: any) {
            console.error("[CLMM Withdraw] Load error:", err);
            setTxError(err?.message || "Failed to load positions from chain.");
        } finally {
            setLoading(false);
        }
    }, [publicKey, connected, poolId, connection]);

    useEffect(() => { loadPositions(); }, [loadPositions]);

    // ── Withdraw a position ───────────────────────────────
    const handleWithdraw = async (position: PositionInfo) => {
        if (!connected || !publicKey || !poolInfo || !poolKeys) return;
        if (position.liquidity.isZero()) {
            setTxError("This position has no liquidity to withdraw.");
            return;
        }

        console.log("[CLMM Withdraw] Attempting withdraw:", {
            nftMint: position.nftMint,
            liquidity: position.liquidity.toString(),
            isZero: position.liquidity.isZero(),
            poolId: poolInfo.id,
        });

        setWithdrawingId(position.nftMint);
        setTxError(null);
        setTxSig(null);

        try {
            let lastTxId = "";

            const wrappedSignAll = async <T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> => {
                console.log("[CLMM Withdraw] Intercepting", txs.length, "txs");
                for (const tx of txs) {
                    if ("version" in tx) {
                        // VersionedTransaction — sign then send raw
                        console.log("[CLMM Withdraw] Versioned TX — signing with wallet...");
                        if (!signAllTransactions) throw new Error("signAllTransactions not available");
                        const [signed] = await signAllTransactions([tx as VersionedTransaction]);
                        const raw = (signed as VersionedTransaction).serialize();
                        const sig = await connection.sendRawTransaction(raw, { skipPreflight: true, maxRetries: 3 });
                        console.log("[CLMM Withdraw] Versioned TX sent:", sig);
                        await connection.confirmTransaction(sig, "confirmed");
                        lastTxId = sig;
                    } else {
                        // Legacy
                        console.log("[CLMM Withdraw] Legacy TX — sending via wallet adapter...");
                        const sig = await sendTransaction(tx as Transaction, connection, {
                            skipPreflight: true,
                            preflightCommitment: "confirmed",
                            maxRetries: 3,
                        });
                        await connection.confirmTransaction(sig, "confirmed");
                        lastTxId = sig;
                        console.log("[CLMM Withdraw] Legacy TX confirmed:", sig);
                    }
                }
                return [];
            };

            const raydium = await Raydium.load({
                owner: publicKey,
                connection,
                cluster: "devnet",
                disableFeatureCheck: true,
                disableLoadToken: false,
                signAllTransactions: wrappedSignAll,
            });

            // 🚨 FIX THE RAYDIUM SDK BUG:
            // Trick the SDK into passing the required accounts by forcing ended rewards (2) back to active (1)
            const hackedPoolInfo = {
                ...poolInfo,
                rewardInfos: poolInfo.rewardInfos.map((r: any) => ({
                    ...r,
                    rewardState: r.rewardState === 2 ? 1 : r.rewardState
                }))
            };

            const { execute } = await raydium.clmm.decreaseLiquidity({
                poolInfo: hackedPoolInfo, // <-- Pass the hacked state here instead of poolInfo
                poolKeys,
                ownerPosition: position.raw,
                ownerInfo: {
                    useSOLBalance: true,
                    closePosition: false, // never collect rewards on close — causes error 6035 on finished farms
                } as any,
                liquidity: position.liquidity,
                amountMinA: new BN(0), // 0 = accept any amount (max slippage)
                amountMinB: new BN(0),
                txVersion: TxVersion.LEGACY,
            });

            console.log("[CLMM Withdraw] execute function built successfully, calling execute...");

            try {
                await execute({ sendAndConfirm: true });
            } catch (e: any) {
                if (lastTxId) {
                    setTxSig(lastTxId);
                } else {
                    throw e;
                }
            }

            if (lastTxId) {
                setTxSig(lastTxId);
                // Reload positions after success
                setTimeout(() => loadPositions(), 2000);
            }

        } catch (err: any) {
            console.error("[CLMM Withdraw] Full error:", err);
            console.error("[CLMM Withdraw] Error name:", err?.name);
            console.error("[CLMM Withdraw] Error message:", err?.message);
            console.error("[CLMM Withdraw] Error logs:", err?.logs);
            console.error("[CLMM Withdraw] Error code:", err?.code);
            setTxError(err?.message || "Withdrawal failed. Check console.");
        } finally {
            setWithdrawingId(null);
        }
    };

    // ── Format tick range as price ────────────────────────
    const formatTick = (tick: number) => {
        const price = Math.pow(1.0001, tick);
        return price < 0.0001
            ? price.toExponential(2)
            : price < 1
                ? price.toFixed(6)
                : price > 100000
                    ? price.toExponential(2)
                    : price.toFixed(4);
    };

    // ── UI ────────────────────────────────────────────────
    if (!connected || !publicKey) {
        return (
            <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
                <p className="text-muted-foreground">Connect your wallet to withdraw liquidity.</p>
            </div>
        );
    }

    return (
        <main className="container mx-auto px-4 py-12 max-w-2xl text-foreground">
            {/* Back */}
            <button onClick={() => router.back()}
                className="flex items-center text-muted-foreground hover:text-foreground transition-colors mb-6">
                <ChevronLeft className="h-5 w-5 mr-1" /> Back
            </button>

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="flex -space-x-2">
                        <TokenIcon symbol={symbolA} logo={logoA} size={36} />
                        <TokenIcon symbol={symbolB} logo={logoB} size={36} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold">{symbolA} / {symbolB}</h1>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs bg-violet-500/20 text-violet-400 px-2 py-0.5 rounded font-bold">CLMM</span>
                            <span className="text-xs text-[var(--neon-teal)] font-semibold">{fee}</span>
                        </div>
                    </div>
                </div>
                <button onClick={loadPositions}
                    disabled={loading}
                    className="p-2 hover:bg-secondary/60 dark:hover:bg-white/10 rounded-lg transition-all text-muted-foreground hover:text-foreground">
                    <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                </button>
            </div>

            {/* Tx Error */}
            {txError && (
                <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400 mb-4">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    {txError}
                </div>
            )}

            {/* Tx Success */}
            {txSig && (
                <div className="flex items-center gap-2 rounded-xl border border-[var(--neon-teal)]/20 bg-[var(--neon-teal)]/5 px-4 py-3 text-sm text-[var(--neon-teal)] mb-4">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>
                        Withdrawal successful!{" "}
                        <a href={`https://solscan.io/tx/${txSig}?cluster=devnet`}
                            target="_blank" rel="noopener noreferrer"
                            className="underline underline-offset-2 hover:opacity-80">
                            View on Solscan
                        </a>
                    </span>
                </div>
            )}

            {/* Loading */}
            {loading ? (
                <div className="bg-[rgba(220,240,232,0.45)] dark:bg-[rgba(255,255,255,0.03)] backdrop-blur-[6px] border border-black/[0.06] dark:border-[rgba(255,255,255,0.08)] shadow-[0_2px_16px_0_rgba(0,0,0,0.06)] dark:shadow-[0_2px_12px_0_rgba(0,0,0,0.12)] rounded-2xl p-10 flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-[var(--neon-teal)]" />
                    <p className="text-sm text-muted-foreground">Loading your positions from chain...</p>
                </div>
            ) : positions.length === 0 ? (
                <div className="bg-[rgba(220,240,232,0.45)] dark:bg-[rgba(255,255,255,0.03)] backdrop-blur-[6px] border border-black/[0.06] dark:border-[rgba(255,255,255,0.08)] shadow-[0_2px_16px_0_rgba(0,0,0,0.06)] dark:shadow-[0_2px_12px_0_rgba(0,0,0,0.12)] rounded-2xl p-10 flex flex-col items-center gap-4 text-center">
                    <div className="w-12 h-12 rounded-full bg-[var(--neon-teal)]/10 border border-[var(--neon-teal)]/20 flex items-center justify-center">
                        <TokenIcon symbol={symbolA} logo={logoA} size={28} />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-foreground mb-1">No positions found</p>
                        <p className="text-xs text-muted-foreground max-w-xs">
                            You don't have any open positions in this {symbolA}/{symbolB} pool.
                        </p>
                    </div>
                    <button onClick={() => router.push(`/liquidity/position/clmm?poolId=${poolId}&symbolA=${symbolA}&symbolB=${symbolB}&fee=${fee}`)}
                        className="px-4 py-2 rounded-xl bg-[var(--neon-teal)]/10 text-[var(--neon-teal)] text-sm font-semibold hover:bg-[var(--neon-teal)]/20 transition-all border border-[var(--neon-teal)]/20">
                        Add Liquidity
                    </button>
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    <p className="text-sm text-muted-foreground">
                        You have <span className="text-foreground font-semibold">{positions.length}</span> open position{positions.length > 1 ? "s" : ""} in this pool.
                    </p>
                    {positions.map((pos, i) => (
                        <div key={pos.nftMint} className="bg-[rgba(220,240,232,0.45)] dark:bg-[rgba(255,255,255,0.03)] backdrop-blur-[6px] border border-black/[0.06] dark:border-[rgba(255,255,255,0.08)] shadow-[0_2px_16px_0_rgba(0,0,0,0.06)] dark:shadow-[0_2px_12px_0_rgba(0,0,0,0.12)] rounded-2xl p-5 flex flex-col gap-4">
                            {/* Position header */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-foreground">Position #{i + 1}</span>
                                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${pos.liquidity.isZero()
                                        ? "bg-secondary/50 text-muted-foreground"
                                        : "bg-[var(--neon-teal)]/10 text-[var(--neon-teal)]"
                                        }`}>
                                        {pos.liquidity.isZero() ? "Empty" : "Active"}
                                    </span>
                                </div>
                                <span className="text-xs text-muted-foreground font-mono">
                                    {pos.nftMint.slice(0, 6)}...{pos.nftMint.slice(-4)}
                                </span>
                            </div>

                            {/* Price range */}
                            <div className="bg-white/50 dark:bg-black/20 border border-black/[0.08] dark:border-white/[0.06] rounded-xl px-4 py-3 grid grid-cols-2 gap-3">
                                <div>
                                    <p className="text-xs text-muted-foreground mb-1">Min Price</p>
                                    <p className="text-sm font-bold text-foreground">{formatTick(pos.tickLower)}</p>
                                    <p className="text-[10px] text-muted-foreground">{symbolB} per {symbolA}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground mb-1">Max Price</p>
                                    <p className="text-sm font-bold text-foreground">{formatTick(pos.tickUpper)}</p>
                                    <p className="text-[10px] text-muted-foreground">{symbolB} per {symbolA}</p>
                                </div>
                            </div>

                            {/* Liquidity */}
                            <div className="bg-white/50 dark:bg-black/20 border border-black/[0.08] dark:border-white/[0.06] rounded-xl px-4 py-3">
                                <p className="text-xs text-muted-foreground mb-1">Liquidity</p>
                                <p className="text-lg font-bold text-foreground">
                                    {formatLargeNumber(pos.liquidity.toNumber())}
                                    <span className="text-sm font-normal text-muted-foreground ml-1">units</span>
                                </p>
                            </div>

                            {/* Fees earned */}
                            {(!pos.tokenFeeAmountA.isZero() || !pos.tokenFeeAmountB.isZero()) && (
                                <div className="bg-[var(--neon-teal)]/5 border border-[var(--neon-teal)]/20 rounded-xl px-4 py-3">
                                    <p className="text-xs text-[var(--neon-teal)] font-semibold mb-2">Uncollected Fees</p>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">{symbolA}</span>
                                        <span className="font-bold text-foreground">
                                            {formatLargeNumber(pos.tokenFeeAmountA.toNumber() / Math.pow(10, 6))}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-sm mt-1">
                                        <span className="text-muted-foreground">{symbolB}</span>
                                        <span className="font-bold text-foreground">
                                            {formatLargeNumber(pos.tokenFeeAmountB.toNumber() / Math.pow(10, 6))}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-3">
                                <button
                                    onClick={() => handleWithdraw(pos)}
                                    disabled={!!withdrawingId || pos.liquidity.isZero()}
                                    className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 border ${pos.liquidity.isZero()
                                        ? "border-border text-muted-foreground cursor-not-allowed opacity-50"
                                        : "border-[var(--neon-teal)]/50 text-[var(--neon-teal)] hover:bg-[var(--neon-teal)]/10 cursor-pointer"
                                        }`}
                                >
                                    {withdrawingId === pos.nftMint ? (
                                        <><Loader2 className="h-4 w-4 animate-spin" /> Withdrawing...</>
                                    ) : (
                                        "Withdraw Liquidity"
                                    )}
                                </button>
                                <button
                                    onClick={() => handleWithdraw(pos)}
                                    disabled={!!withdrawingId || pos.liquidity.isZero()}
                                    className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${pos.liquidity.isZero()
                                        ? "bg-secondary/30 text-muted-foreground cursor-not-allowed opacity-50"
                                        : "bg-[var(--neon-teal)] text-black hover:opacity-90 cursor-pointer"
                                        }`}
                                >
                                    {withdrawingId === pos.nftMint ? (
                                        <><Loader2 className="h-4 w-4 animate-spin" /> Withdrawing...</>
                                    ) : (
                                        "Withdraw Liquidity"
                                    )}
                                </button>
                            </div>
                            <p className="text-xs text-muted-foreground text-center">
                                Withdrawing will return your tokens to your wallet. The position NFT will remain in your wallet.
                            </p>
                        </div>
                    ))}
                </div>
            )}
        </main>
    );
}