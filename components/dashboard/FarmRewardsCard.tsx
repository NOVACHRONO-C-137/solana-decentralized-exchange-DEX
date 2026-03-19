"use client";

import { useRouter } from "next/navigation";
import { Sprout, Loader2 } from "lucide-react";
import { formatLargeNumber, glassCard } from "@/lib/utils";
import TokenIcon from "@/components/liquidity/TokenIcon";
import BN from "bn.js";

interface FarmRewardsCardProps {
    pools: any[];
    positions: any[];
    claimingId: string | null;
    onClaim: (poolId: string, position: any) => void;
    onDeposit: (pool: any) => void;
}

export function FarmRewardsCard({ pools, positions, claimingId, onClaim, onDeposit }: FarmRewardsCardProps) {
    const router = useRouter();
    const farmPools = pools.filter(p => p.rewardDefaultInfos?.length > 0);

    return (
        <div className={`${glassCard} p-5 min-h-[320px]`}>
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Farm Rewards</h3>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-500/20 text-green-500 dark:text-green-400">Devnet</span>
                </div>
                <Sprout className="w-4 h-4 text-muted-foreground" />
            </div>

            {farmPools.length === 0 ? (
                <div className="py-8 text-center">
                    <div className="w-12 h-12 rounded-full bg-[var(--neon-teal)]/10 border border-[var(--neon-teal)]/20 flex items-center justify-center mx-auto mb-4">
                        <Sprout className="w-6 h-6 text-[var(--neon-teal)]" />
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">No active farms found.</p>
                    <button
                        onClick={() => router.push("/liquidity/create-farm")}
                        className="px-4 py-2 rounded-xl bg-[var(--neon-teal)]/10 text-[var(--neon-teal)] text-sm font-semibold hover:bg-[var(--neon-teal)]/20 transition-all border border-[var(--neon-teal)]/20"
                    >
                        Create a Farm
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    {farmPools.map((pool, i) => {
                        const symA = pool.mintA?.symbol || pool.symbolA || "?";
                        const symB = pool.mintB?.symbol || pool.symbolB || "?";
                        const poolIdStr = pool.id || pool.poolId;
                        const userPosition = positions.find(pos => pos.poolId.toString() === poolIdStr);

                        return pool.rewardDefaultInfos.map((reward: any, j: number) => {
                            const sym = reward.mint?.symbol || "?";
                            const logo = reward.mint?.logoURI;
                            const decimals = reward.mint?.decimals || 6;
                            const perSec = parseFloat(reward.perSecond || "0");
                            const perDay = (perSec / Math.pow(10, decimals)) * 86400;
                            const pendingBN: BN = userPosition?.rewardInfos[j]?.pendingReward || new BN(0);
                            const pendingHuman = pendingBN.toNumber() / Math.pow(10, decimals);
                            const hasPending = pendingHuman > 0;
                            const isClaiming = claimingId === userPosition?.nftMint?.toString();

                            return (
                                <div key={`${i}-${j}`} className="flex items-center justify-between gap-4 border border-border/40 bg-secondary/10 rounded-xl p-3">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <TokenIcon symbol={sym} logo={logo} size={32} />
                                        <div className="min-w-0">
                                            <div className="text-sm font-semibold text-foreground">{sym} Rewards</div>
                                            <div className="text-xs text-muted-foreground">{symA}-{symB} Farm</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 flex-shrink-0">
                                        <div className="text-right">
                                            {userPosition ? (
                                                <>
                                                    <div className="text-sm font-bold text-[var(--neon-teal)]">{formatLargeNumber(pendingHuman)} {sym}</div>
                                                    <div className="text-[10px] text-muted-foreground">Unclaimed</div>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="text-sm font-bold text-foreground">~{formatLargeNumber(perDay)}</div>
                                                    <div className="text-[10px] text-muted-foreground">{sym}/day rate</div>
                                                </>
                                            )}
                                        </div>
                                        {userPosition ? (
                                            <button
                                                onClick={() => onClaim(poolIdStr, userPosition)}
                                                disabled={!hasPending || isClaiming}
                                                className={`w-20 py-1.5 rounded-lg text-xs font-semibold transition-all border ${hasPending && !isClaiming
                                                    ? "bg-[var(--neon-teal)]/15 text-[var(--neon-teal)] border-[var(--neon-teal)]/20 hover:bg-[var(--neon-teal)]/25"
                                                    : "bg-secondary/30 text-muted-foreground border-transparent cursor-not-allowed"}`}
                                            >
                                                {isClaiming ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" /> : "Claim"}
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => onDeposit(pool)}
                                                className="w-20 py-1.5 rounded-lg bg-secondary/40 text-muted-foreground text-xs font-semibold hover:bg-secondary/60 transition-all border border-border/50"
                                            >
                                                Deposit
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        });
                    })}
                </div>
            )}

            <div className="text-xs text-muted-foreground/50 mt-4 pt-4 border-t border-border/50">
                Rewards accrue per block · Devnet only
            </div>
        </div>
    );
}
