"use client";

import { useState } from "react";
import { formatLargeNumber } from "@/lib/utils";
import TokenIcon from "@/components/liquidity/TokenIcon";

interface TokenItem {
    mint: string;
    symbol: string;
    name: string;
    logo?: string;
    balance: number;
    usd: number;
}

interface TokenHoldingsCardProps {
    tokenList: TokenItem[];
    balancesLoading: boolean;
}

export function TokenHoldingsCard({ tokenList, balancesLoading }: TokenHoldingsCardProps) {
    const [tokenSearch, setTokenSearch] = useState("");

    const filtered = tokenList.filter(token => {
        if (!tokenSearch.trim()) return true;
        const q = tokenSearch.toLowerCase();
        return token.symbol.toLowerCase().includes(q) || token.name.toLowerCase().includes(q) || token.mint.toLowerCase().includes(q);
    });

    return (
        <div className="bg-[rgba(220,240,232,0.45)] dark:bg-[rgba(255,255,255,0.03)] backdrop-blur-[6px] border border-black/[0.06] dark:border-[rgba(255,255,255,0.08)] shadow-[0_2px_16px_0_rgba(0,0,0,0.06)] dark:shadow-[0_2px_12px_0_rgba(0,0,0,0.12)] rounded-2xl p-5 min-h-[420px]">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Token Holdings</h3>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--neon-teal)]/10 text-[var(--neon-teal)]">{tokenList.length}</span>
            </div>
            {tokenList.length > 4 && (
                <div className="relative mb-3">
                    <input type="text" placeholder="Search tokens..." value={tokenSearch} onChange={e => setTokenSearch(e.target.value)} className="w-full bg-secondary/40 dark:bg-black/30 border border-border rounded-xl py-2 pl-3.5 pr-9 text-sm focus:outline-none focus:border-[var(--neon-teal)] transition-colors placeholder:text-muted-foreground text-foreground" />
                    <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
                </div>
            )}
            {balancesLoading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="flex items-center gap-3 animate-pulse">
                            <div className="w-8 h-8 rounded-full bg-secondary/60" />
                            <div className="flex-1"><div className="h-3 w-16 bg-secondary/60 rounded mb-1.5" /><div className="h-2.5 w-12 bg-secondary/40 rounded" /></div>
                            <div className="text-right"><div className="h-3 w-14 bg-secondary/60 rounded mb-1.5" /><div className="h-2.5 w-10 bg-secondary/40 rounded" /></div>
                        </div>
                    ))}
                </div>
            ) : tokenList.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No tokens found</p>
            ) : (
                <div className="overflow-y-auto max-h-[320px] min-h-[320px] pr-1 custom-scrollbar-teal">
                    {filtered.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">No tokens match your search</p>
                    ) : (
                        <div className="space-y-3">
                            {filtered.map((token, i) => (
                                <div key={i} className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <TokenIcon symbol={token.symbol} logo={token.logo} size={32} />
                                        <div className="min-w-0">
                                            <div className="text-sm font-semibold text-foreground">{token.symbol}</div>
                                            <div className="text-xs text-muted-foreground truncate">{token.name}</div>
                                        </div>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <div className="text-sm font-bold text-foreground">{formatLargeNumber(token.balance)}</div>
                                        <div className="text-xs text-[var(--neon-teal)]">{token.usd > 0 ? `~${formatLargeNumber(token.usd)}` : "—"}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
            <div className="text-xs text-muted-foreground/50 mt-4 pt-4 border-t border-border/50">Prices from Raydium API</div>
            <style dangerouslySetInnerHTML={{ __html: `.custom-scrollbar-teal::-webkit-scrollbar{width:5px}.custom-scrollbar-teal::-webkit-scrollbar-track{background:rgba(255,255,255,0.02);border-radius:8px}.custom-scrollbar-teal::-webkit-scrollbar-thumb{background:rgba(20,241,149,0.35);border-radius:8px}.custom-scrollbar-teal::-webkit-scrollbar-thumb:hover{background:rgba(20,241,149,0.7)}` }} />
        </div>
    );
}
