"use client";

import { Info } from "lucide-react";
import { formatLargeNumber } from "@/lib/utils";

interface Segment {
    symbol: string;
    pct: number;
    color: string;
}

interface PortfolioCardProps {
    totalUSD: number;
    segments: Segment[];
    pricesLoading: boolean;
    balancesLoading: boolean;
}

export function PortfolioCard({ totalUSD, segments, pricesLoading, balancesLoading }: PortfolioCardProps) {
    return (
        <div className="bg-[rgba(220,240,232,0.45)] dark:bg-[rgba(255,255,255,0.03)] backdrop-blur-[6px] border border-black/[0.06] dark:border-[rgba(255,255,255,0.08)] shadow-[0_2px_16px_0_rgba(0,0,0,0.06)] dark:shadow-[0_2px_12px_0_rgba(0,0,0,0.12)] rounded-2xl p-5 min-h-[180px]">
            <div className="flex items-center justify-between mb-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Portfolio Value</h3>
                <div className="relative group">
                    <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                    <div className="absolute right-0 bottom-6 bg-card border border-border rounded-xl px-3 py-2 text-xs text-muted-foreground w-48 hidden group-hover:block z-10 shadow-xl">
                        Estimated value using live Raydium devnet prices. Not real USD.
                    </div>
                </div>
            </div>
            <div className="mb-5 text-center">
                {pricesLoading || balancesLoading
                    ? <div className="h-10 w-36 bg-secondary/60 rounded-lg animate-pulse mx-auto mb-2" />
                    : <div className="text-4xl font-bold text-foreground mb-1" style={{ textShadow: "0 0 30px var(--neon-teal-glow)" }}>${formatLargeNumber(totalUSD)}</div>
                }
                <span className="text-xs text-muted-foreground">Estimated · Devnet prices</span>
            </div>
            {segments.length > 0 && (
                <div className="space-y-3">
                    <div className="w-full h-2 rounded-full bg-secondary/50 overflow-hidden flex">
                        {segments.map((s, i) => (
                            <div key={i} style={{ width: `${s.pct}%`, background: s.color }} className="transition-all duration-500" />
                        ))}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                        {segments.map((s, i) => (
                            <div key={i} className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                                <span className="text-xs text-muted-foreground">{s.symbol} {s.pct.toFixed(0)}%</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
