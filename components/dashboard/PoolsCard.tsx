"use client";

import { useState } from "react";
import { RefreshCw, Loader2, Droplets, ExternalLink } from "lucide-react";
import { CopyButton } from "@/components/dashboard/CopyButton";
import { PoolTypeBadge } from "@/components/dashboard/PoolTypeBadge";
import TokenIcon from "@/components/liquidity/TokenIcon";
import { glassCard } from "@/lib/utils";

interface PoolsCardProps {
    pools: any[];
    poolsLoading: boolean;
    positionPoolIds: Set<string>;
    onDeposit: (pool: any) => void;
    onWithdraw: (pool: any) => void;
    onRefresh: () => void;
}

type TabType = "All" | "CLMM" | "Standard" | "Legacy";

function normalizePoolType(type?: string): string {
    const t = (type || "").toLowerCase();
    if (t === "clmm" || t === "concentrated") return "Concentrated";
    if (t === "standard") return "Standard";
    if (t === "legacy") return "Legacy";
    return type || "Concentrated";
}

function matchesType(pool: any, tab: TabType): boolean {
    if (tab === "All") return true;
    const t = normalizePoolType(pool.type).toLowerCase();
    if (tab === "CLMM") return t === "concentrated" || t === "clmm";
    if (tab === "Standard") return t === "standard";
    if (tab === "Legacy") return t === "legacy";
    return true;
}

function matchesSearch(pool: any, query: string): boolean {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    const symA = (pool.mintA?.symbol || pool.symbolA || "").toLowerCase();
    const symB = (pool.mintB?.symbol || pool.symbolB || "").toLowerCase();
    const id = (pool.id || pool.poolId || "").toLowerCase();
    return symA.includes(q) || symB.includes(q) || id.includes(q);
}

function formatFee(pool: any): string {
    if (pool.feeRate) {
        return pool.feeRate < 1
            ? `${(pool.feeRate * 100).toFixed(2)}%`
            : `${(pool.feeRate / 100).toFixed(2)}%`;
    }
    return pool.fee || "0.25%";
}

export function PoolsCard({
    pools, poolsLoading, positionPoolIds, onDeposit, onWithdraw, onRefresh,
}: PoolsCardProps) {
    const [activeTab, setActiveTab] = useState<TabType>("All");
    const [poolSearch, setPoolSearch] = useState("");


    const positionPools = pools.filter((p) => positionPoolIds.has(p.id || p.poolId));
    const filteredPools = positionPools.filter((p) => matchesType(p, activeTab) && matchesSearch(p, poolSearch));

    const tabCounts: Record<TabType, number> = {
        All: positionPools.length,
        CLMM: positionPools.filter((p) => matchesType(p, "CLMM")).length,
        Standard: positionPools.filter((p) => matchesType(p, "Standard")).length,
        Legacy: positionPools.filter((p) => matchesType(p, "Legacy")).length,
    };

    const tabs: TabType[] = ["All", "CLMM", "Standard", "Legacy"];

    return (
        <div className={`${glassCard} p-5 min-h-[600px]`}>
            {/* Card Header */}
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Positions</h3>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--neon-teal)]/10 border border-[var(--neon-teal)]/20 text-[var(--neon-teal)]">Devnet</span>
                </div>
            </div>

            <div className="flex flex-col gap-3 mb-5">
                {/* Filters */}
                <div className="grid grid-cols-2 sm:flex sm:flex-row gap-1 bg-secondary/40 dark:bg-white/5 rounded-xl p-1">
                    {tabs.map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${activeTab === tab ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                        >
                            {tab}
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === tab ? "bg-[var(--neon-teal)]/20 text-[var(--neon-teal)]" : "bg-secondary text-muted-foreground"}`}>
                                {tabCounts[tab]}
                            </span>
                        </button>
                    ))}
                </div>
                {/* Search */}
                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        placeholder="Search pools..."
                        value={poolSearch}
                        onChange={(e) => setPoolSearch(e.target.value)}
                        className="flex-1 px-3 py-1.5 text-xs bg-secondary/40 dark:bg-white/5 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--neon-teal)]"
                    />
                    <button onClick={onRefresh} className="p-1.5 hover:bg-secondary/60 dark:hover:bg-white/10 rounded-lg transition-all text-muted-foreground hover:text-foreground flex-shrink-0">
                        {poolsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            <PoolList
                pools={filteredPools}
                loading={poolsLoading}
                onDeposit={onDeposit}
                onWithdraw={onWithdraw}
                hasAnyPools={pools.length > 0}
            />

            <style dangerouslySetInnerHTML={{ __html: `.custom-scrollbar-teal::-webkit-scrollbar{width:5px}.custom-scrollbar-teal::-webkit-scrollbar-track{background:rgba(255,255,255,0.02);border-radius:8px}.custom-scrollbar-teal::-webkit-scrollbar-thumb{background:rgba(20,241,149,0.35);border-radius:8px}.custom-scrollbar-teal::-webkit-scrollbar-thumb:hover{background:rgba(20,241,149,0.7)}` }} />
        </div>
    );
}

interface PoolListProps {
    pools: any[];
    loading: boolean;
    onDeposit: (pool: any) => void;
    onWithdraw: (pool: any) => void;
    hasAnyPools: boolean;
}

function PoolList({
    pools, loading, onDeposit, onWithdraw, hasAnyPools,
}: PoolListProps) {
    return (
        <>
            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="border border-border/50 rounded-xl p-4 animate-pulse">
                            <div className="flex items-center gap-3">
                                <div className="flex -space-x-1">
                                    <div className="w-7 h-7 rounded-full bg-secondary/60" />
                                    <div className="w-7 h-7 rounded-full bg-secondary/40" />
                                </div>
                                <div className="flex-1">
                                    <div className="h-3.5 w-24 bg-secondary/60 rounded mb-2" />
                                    <div className="h-2.5 w-16 bg-secondary/40 rounded" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : !hasAnyPools ? (
                <div className="py-10 text-center">
                    <div className="w-12 h-12 rounded-full bg-[var(--neon-teal)]/10 border border-[var(--neon-teal)]/20 flex items-center justify-center mx-auto mb-4">
                        <Droplets className="w-6 h-6 text-[var(--neon-teal)]" />
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">No pools found for this wallet.</p>
                </div>
            ) : pools.length === 0 ? (
                <div className="py-10 text-center">
                    <p className="text-sm text-muted-foreground">No pools match the current filters.</p>
                </div>
            ) : (
                <div className="overflow-y-auto max-h-[420px] pr-1 custom-scrollbar-teal">
                    <div className="space-y-3">
                        {pools.map((pool: any, i: number) => {
                            const symA = pool.mintA?.symbol || pool.symbolA || "?";
                            const symB = pool.mintB?.symbol || pool.symbolB || "?";
                            const logoA = pool.mintA?.logoURI || pool.logoA;
                            const logoB = pool.mintB?.logoURI || pool.logoB;
                            const poolId = pool.id || pool.poolId || "";
                            const fee = formatFee(pool);
                            const type = normalizePoolType(pool.type);
                            return (
                                <div key={i} className="border border-border/60 rounded-xl p-4 bg-secondary/10 dark:bg-white/[0.02] hover:bg-secondary/30 dark:hover:bg-white/[0.04] transition-all duration-200">
                                    <div className="flex items-center justify-between gap-4 flex-wrap">
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <div className="flex -space-x-2 flex-shrink-0">
                                                <TokenIcon symbol={symA} logo={logoA} size={28} />
                                                <TokenIcon symbol={symB} logo={logoB} size={28} />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-sm font-bold text-foreground">{symA} / {symB}</div>
                                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                    <PoolTypeBadge type={type} />
                                                    <span className="text-[var(--neon-teal)] text-xs font-semibold">{fee}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 flex-shrink-0">
                                            <span className="text-xs text-muted-foreground font-mono">
                                                {poolId ? `${poolId.slice(0, 6)}...${poolId.slice(-4)}` : "-"}
                                            </span>
                                            {poolId && <CopyButton text={poolId} />}
                                            {poolId && (
                                                <a href={`https://solscan.io/account/${poolId}?cluster=devnet`} target="_blank" rel="noopener noreferrer" className="p-1 hover:bg-secondary/60 dark:hover:bg-white/10 rounded transition-all">
                                                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                                                </a>
                                            )}
                                        </div>
                                        <div className="flex gap-2 w-full sm:w-auto">
                                            <button onClick={() => onDeposit(pool)} className="flex-1 sm:flex-none px-4 py-1.5 rounded-lg border border-[var(--neon-teal)]/50 text-[var(--neon-teal)] text-xs font-semibold hover:bg-[var(--neon-teal)]/10 transition-all duration-200">
                                                Deposit
                                            </button>
                                            <button onClick={() => onWithdraw(pool)} className="flex-1 sm:flex-none px-4 py-1.5 rounded-lg border border-border text-muted-foreground text-xs font-semibold hover:bg-secondary/60 dark:hover:bg-white/5 hover:text-foreground transition-all duration-200">
                                                Withdraw
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </>
    );
}
