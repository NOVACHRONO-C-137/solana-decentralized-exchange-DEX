"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Loader2, Droplets, ExternalLink } from "lucide-react";
import { CopyButton } from "@/components/dashboard/CopyButton";
import { PoolTypeBadge } from "@/components/dashboard/PoolTypeBadge";
import TokenIcon from "@/components/liquidity/TokenIcon";
import { glassCard } from "@/lib/utils";

interface PoolsCardProps {
    pools: any[];
    positions: any[];
    poolsLoading: boolean;
    createdPoolIds: Set<string>;
    onDeposit: (pool: any) => void;
    onWithdraw: (pool: any) => void;
    onRefresh: () => void;
}

type TabType = "All" | "CLMM" | "Standard" | "Legacy";

function matchesType(pool: any, tab: TabType): boolean {
    if (tab === "All") return true;
    const t = (pool.type || "").toLowerCase();
    if (tab === "CLMM") return t === "concentrated" || t === "clmm";
    if (tab === "Standard") return t === "standard";
    if (tab === "Legacy") return pool.type === "Legacy";
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
    pools, positions, poolsLoading, createdPoolIds, onDeposit, onWithdraw, onRefresh,
}: PoolsCardProps) {
    const router = useRouter();
    const [mainTab, setMainTab] = useState<"mine" | "other">("mine");
    const [activeTab, setActiveTab] = useState<TabType>("All");
    const [otherActiveTab, setOtherActiveTab] = useState<TabType>("All");
    const [myPoolSearch, setMyPoolSearch] = useState("");
    const [otherPoolSearch, setOtherPoolSearch] = useState("");

    const myPools = pools.filter(p => createdPoolIds.has(p.id || p.poolId));
    const otherPools = pools.filter(p => {
        const id = p.id || p.poolId;
        return !createdPoolIds.has(id) && positions.some(pos => pos.poolId.toString() === id);
    });

    const filteredMyPools = myPools.filter(p => matchesType(p, activeTab) && matchesSearch(p, myPoolSearch));
    const filteredOtherPools = otherPools.filter(p => matchesType(p, otherActiveTab) && matchesSearch(p, otherPoolSearch));

    const myTabCounts: Record<TabType, number> = {
        All: myPools.length,
        CLMM: myPools.filter(p => matchesType(p, "CLMM")).length,
        Standard: myPools.filter(p => matchesType(p, "Standard")).length,
        Legacy: myPools.filter(p => matchesType(p, "Legacy")).length,
    };
    const otherTabCounts: Record<TabType, number> = {
        All: otherPools.length,
        CLMM: otherPools.filter(p => matchesType(p, "CLMM")).length,
        Standard: otherPools.filter(p => matchesType(p, "Standard")).length,
        Legacy: otherPools.filter(p => matchesType(p, "Legacy")).length,
    };

    const TABS: TabType[] = ["All", "CLMM", "Standard", "Legacy"];

    return (
        <div className={`${glassCard} p-5 min-h-[600px]`}>
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-1 bg-secondary/40 dark:bg-white/5 rounded-xl p-1">
                    <button
                        onClick={() => setMainTab("mine")}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${mainTab === "mine" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    >
                        My Pools
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${mainTab === "mine" ? "bg-[var(--neon-teal)]/20 text-[var(--neon-teal)]" : "bg-secondary text-muted-foreground"}`}>
                            {myPools.length}
                        </span>
                    </button>
                    <button
                        onClick={() => setMainTab("other")}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${mainTab === "other" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    >
                        Other Pools
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${mainTab === "other" ? "bg-violet-500/20 text-violet-400" : "bg-secondary text-muted-foreground"}`}>
                            {otherPools.length}
                        </span>
                    </button>
                </div>
                <button onClick={onRefresh} className="p-1.5 hover:bg-secondary/60 dark:hover:bg-white/10 rounded-lg transition-all text-muted-foreground hover:text-foreground">
                    {poolsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                </button>
            </div>

            {mainTab === "mine" ? (
                <PoolList
                    pools={filteredMyPools}
                    allPools={myPools}
                    positions={positions}
                    loading={poolsLoading}
                    tabs={TABS}
                    activeTab={activeTab}
                    tabCounts={myTabCounts}
                    search={myPoolSearch}
                    onTabChange={setActiveTab}
                    onSearchChange={setMyPoolSearch}
                    onDeposit={onDeposit}
                    onWithdraw={onWithdraw}
                    emptyAction={() => router.push("/liquidity/create/clmm")}
                    showDeposit
                />
            ) : (
                <PoolList
                    pools={filteredOtherPools}
                    allPools={otherPools}
                    positions={positions}
                    loading={poolsLoading}
                    tabs={TABS}
                    activeTab={otherActiveTab}
                    tabCounts={otherTabCounts}
                    search={otherPoolSearch}
                    onTabChange={setOtherActiveTab}
                    onSearchChange={setOtherPoolSearch}
                    onDeposit={onDeposit}
                    onWithdraw={onWithdraw}
                    isOther
                />
            )}

            <style dangerouslySetInnerHTML={{ __html: `.custom-scrollbar-teal::-webkit-scrollbar{width:5px}.custom-scrollbar-teal::-webkit-scrollbar-track{background:rgba(255,255,255,0.02);border-radius:8px}.custom-scrollbar-teal::-webkit-scrollbar-thumb{background:rgba(20,241,149,0.35);border-radius:8px}.custom-scrollbar-teal::-webkit-scrollbar-thumb:hover{background:rgba(20,241,149,0.7)}` }} />
        </div>
    );
}

interface PoolListProps {
    pools: any[];
    allPools: any[];
    positions: any[];
    loading: boolean;
    tabs: TabType[];
    activeTab: TabType;
    tabCounts: Record<TabType, number>;
    search: string;
    onTabChange: (t: TabType) => void;
    onSearchChange: (s: string) => void;
    onDeposit: (pool: any) => void;
    onWithdraw: (pool: any) => void;
    emptyAction?: () => void;
    showDeposit?: boolean;
    isOther?: boolean;
}

function PoolList({
    pools, allPools, positions, loading, tabs, activeTab, tabCounts,
    search, onTabChange, onSearchChange, onDeposit, onWithdraw,
    emptyAction, showDeposit, isOther,
}: PoolListProps) {
    return (
        <>
            <div className="flex gap-2 mb-5 pb-5 border-b border-border/50 flex-wrap">
                {tabs.map(tab => (
                    <button
                        key={tab}
                        onClick={() => onTabChange(tab)}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-all duration-200 ${activeTab === tab
                            ? "bg-[#0D9B5F]/15 dark:bg-white/10 text-foreground"
                            : "bg-secondary/50 dark:bg-white/5 text-muted-foreground hover:text-foreground"}`}
                    >
                        {tab}
                        {tabCounts[tab] > 0 && (
                            <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === tab
                                ? isOther ? "bg-violet-500/20 text-violet-400" : "bg-[var(--neon-teal)]/20 text-[var(--neon-teal)]"
                                : "bg-secondary text-muted-foreground"}`}>
                                {tabCounts[tab]}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            <div className="relative mb-4">
                <input
                    type="text"
                    placeholder="Search by token or pool address..."
                    value={search}
                    onChange={e => onSearchChange(e.target.value)}
                    className="w-full bg-secondary/40 dark:bg-black/30 border border-border rounded-xl py-2.5 pl-4 pr-10 text-sm focus:outline-none focus:border-[var(--neon-teal)] transition-colors placeholder:text-muted-foreground text-foreground"
                />
                <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
            </div>

            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map(i => (
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
            ) : allPools.length === 0 && !isOther ? (
                <div className="py-10 text-center">
                    <div className="w-12 h-12 rounded-full bg-[var(--neon-teal)]/10 border border-[var(--neon-teal)]/20 flex items-center justify-center mx-auto mb-4">
                        <Droplets className="w-6 h-6 text-[var(--neon-teal)]" />
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">No pools found for this wallet.</p>
                    {emptyAction && (
                        <button onClick={emptyAction} className="px-4 py-2 rounded-xl bg-[var(--neon-teal)]/10 text-[var(--neon-teal)] text-sm font-semibold hover:bg-[var(--neon-teal)]/20 transition-all border border-[var(--neon-teal)]/20">
                            Create your first pool
                        </button>
                    )}
                </div>
            ) : allPools.length === 0 && isOther ? (
                <div className="py-10 text-center">
                    <p className="text-sm text-muted-foreground">No external pools found with your liquidity.</p>
                </div>
            ) : pools.length === 0 ? (
                <div className="py-10 text-center">
                    <p className="text-sm text-muted-foreground">
                        {search.trim() ? "No pools match your search." : `No ${activeTab} pools found.`}
                    </p>
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
                            const type = pool.type || "Concentrated";
                            const userPosition = positions.find((pos: any) => pos.poolId.toString() === poolId);

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
                                                    {isOther && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-violet-500/20 text-violet-400">Deposited</span>}
                                                    <span className="text-[var(--neon-teal)] text-xs font-semibold">{fee}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 flex-shrink-0">
                                            <span className="text-xs text-muted-foreground font-mono">
                                                {poolId ? `${poolId.slice(0, 6)}...${poolId.slice(-4)}` : "—"}
                                            </span>
                                            {poolId && <CopyButton text={poolId} />}
                                            {poolId && (
                                                <a href={`https://solscan.io/account/${poolId}?cluster=devnet`} target="_blank" rel="noopener noreferrer" className="p-1 hover:bg-secondary/60 dark:hover:bg-white/10 rounded transition-all">
                                                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                                                </a>
                                            )}
                                        </div>
                                        <div className="flex gap-2 w-full sm:w-auto">
                                            {showDeposit && (
                                                <button onClick={() => onDeposit(pool)} className="flex-1 sm:flex-none px-4 py-1.5 rounded-lg border border-[var(--neon-teal)]/50 text-[var(--neon-teal)] text-xs font-semibold hover:bg-[var(--neon-teal)]/10 transition-all duration-200">
                                                    Deposit
                                                </button>
                                            )}
                                            <button onClick={() => onWithdraw(pool)} className="flex-1 sm:flex-none px-4 py-1.5 rounded-lg border border-border text-muted-foreground text-xs font-semibold hover:bg-secondary/60 dark:hover:bg-white/5 hover:text-foreground transition-all duration-200">
                                                Withdraw
                                            </button>
                                        </div>
                                    </div>
                                    {isOther && userPosition && (
                                        <div className="mt-3 pt-3 border-t border-border/40 grid grid-cols-2 gap-3 text-xs">
                                            <div>
                                                <span className="text-muted-foreground">Tick Range</span>
                                                <div className="font-semibold text-foreground mt-0.5">{userPosition.tickLower} → {userPosition.tickUpper}</div>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground">Liquidity</span>
                                                <div className="font-semibold text-[var(--neon-teal)] mt-0.5">{userPosition.liquidity.toString()}</div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </>
    );
}
