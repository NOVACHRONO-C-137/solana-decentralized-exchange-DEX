"use client";

import { useState, useEffect, useCallback } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { RefreshCw, Loader2 } from "lucide-react";

interface NetworkStatsCardProps {
    solPrice: number;
}

export function NetworkStatsCard({ solPrice }: NetworkStatsCardProps) {
    const { connection } = useConnection();
    const [networkStats, setNetworkStats] = useState<{ slot: number; tps: number } | null>(null);
    const [epochInfo, setEpochInfo] = useState<any>(null);
    const [statsLoading, setStatsLoading] = useState(false);

    const fetchNetworkStats = useCallback(async () => {
        setStatsLoading(true);
        try {
            const [slot, perfSamples, epoch] = await Promise.all([
                connection.getSlot(),
                connection.getRecentPerformanceSamples(1),
                connection.getEpochInfo(),
            ]);
            const tps = perfSamples[0]
                ? Math.round(perfSamples[0].numTransactions / perfSamples[0].samplePeriodSecs)
                : 0;
            setNetworkStats({ slot, tps });
            setEpochInfo(epoch);
        } catch { }
        finally { setStatsLoading(false); }
    }, [connection]);

    useEffect(() => { fetchNetworkStats(); }, [fetchNetworkStats]);

    const stats = [
        { label: "Slot", value: networkStats?.slot ? `#${networkStats.slot.toLocaleString()}` : "—", color: "text-[var(--neon-teal)]" },
        { label: "TPS", value: networkStats?.tps ? networkStats.tps.toLocaleString() : "—", color: "text-blue-400" },
        { label: "SOL Price", value: solPrice > 0 ? `$${Number(solPrice).toFixed(2)}` : "—", color: "text-violet-400" },
    ];

    const extraStats = [
        { label: "Epoch", value: epochInfo ? `${epochInfo.slotIndex.toLocaleString()} / ${epochInfo.slotsInEpoch.toLocaleString()}` : "—", color: "text-[var(--neon-teal)]" },
        { label: "Block Time", value: "~400ms", color: "text-blue-400" },
    ];

    const epochPct = epochInfo ? (epochInfo.slotIndex / epochInfo.slotsInEpoch) * 100 : 0;

    return (
        <div className="bg-[rgba(220,240,232,0.45)] dark:bg-[rgba(255,255,255,0.03)] backdrop-blur-[6px] border border-black/[0.06] dark:border-[rgba(255,255,255,0.08)] shadow-[0_2px_16px_0_rgba(0,0,0,0.06)] dark:shadow-[0_2px_12px_0_rgba(0,0,0,0.12)] rounded-2xl p-5 min-h-[160px]">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Network Stats</h3>
                <button onClick={fetchNetworkStats} className="p-1 hover:bg-secondary/60 rounded-lg transition-all text-muted-foreground hover:text-foreground">
                    {statsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
                {stats.map((stat, i) => (
                    <div key={i} className="bg-secondary/30 rounded-xl p-3 text-center">
                        <div className="text-[10px] text-muted-foreground mb-1.5 font-medium uppercase tracking-wide">{stat.label}</div>
                        {statsLoading ? <div className="h-4 w-10 bg-secondary/60 rounded animate-pulse mx-auto" /> : <div className={`text-xs font-bold ${stat.color} truncate`}>{stat.value}</div>}
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
                {extraStats.map((stat, i) => (
                    <div key={i} className="bg-secondary/30 rounded-xl p-3 text-center">
                        <div className="text-[10px] text-muted-foreground mb-1.5 font-medium uppercase tracking-wide">{stat.label}</div>
                        {statsLoading ? <div className="h-4 w-20 bg-secondary/60 rounded animate-pulse mx-auto" /> : <div className={`text-xs font-bold ${stat.color} truncate`}>{stat.value}</div>}
                    </div>
                ))}
            </div>
            <div className="mt-3 pt-3 border-t border-border/50">
                <div className="flex items-center justify-between gap-3 mb-2">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Epoch Progress</span>
                    <span className="text-[10px] text-muted-foreground">{epochInfo ? `${epochPct.toFixed(1)}%` : "—"}</span>
                </div>
                <div className="w-full h-2 rounded-full bg-secondary/50 overflow-hidden">
                    <div className="h-full rounded-full bg-[var(--neon-teal)] transition-all duration-500" style={{ width: `${epochPct}%` }} />
                </div>
            </div>
            <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border/50">
                <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                <span className="text-[10px] text-muted-foreground">Solana Devnet</span>
            </div>
        </div>
    );
}
