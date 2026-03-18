"use client";

import { useState, useEffect, useCallback } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { RefreshCw, Loader2, ExternalLink } from "lucide-react";
import { timeAgo } from "@/lib/utils";

interface RecentTransactionsCardProps {
    publicKey: PublicKey;
}

export function RecentTransactionsCard({ publicKey }: RecentTransactionsCardProps) {
    const { connection } = useConnection();
    const [recentTxns, setRecentTxns] = useState<any[]>([]);
    const [txnsLoading, setTxnsLoading] = useState(false);

    const fetchRecentTxns = useCallback(async () => {
        setTxnsLoading(true);
        try {
            const res = await fetch(`https://api-v3-devnet.raydium.io/main/txs?address=${publicKey.toBase58()}&limit=8`);
            const json = await res.json();
            if (json.data && Array.isArray(json.data)) {
                setRecentTxns(json.data);
            } else {
                throw new Error("No data");
            }
        } catch {
            try {
                const sigs = await connection.getSignaturesForAddress(publicKey, { limit: 8 });
                setRecentTxns(sigs.map(s => ({ txId: s.signature, blockTime: s.blockTime, err: s.err, type: "Transaction" })));
            } catch { }
        } finally {
            setTxnsLoading(false);
        }
    }, [publicKey, connection]);

    useEffect(() => { fetchRecentTxns(); }, [fetchRecentTxns]);

    return (
        <div className="bg-[rgba(220,240,232,0.45)] dark:bg-[rgba(255,255,255,0.03)] backdrop-blur-[6px] border border-black/[0.06] dark:border-[rgba(255,255,255,0.08)] shadow-[0_2px_16px_0_rgba(0,0,0,0.06)] dark:shadow-[0_2px_12px_0_rgba(0,0,0,0.12)] rounded-2xl p-5 min-h-[160px]">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Recent Transactions</h3>
                <button onClick={fetchRecentTxns} className="p-1 hover:bg-secondary/60 rounded-lg transition-all text-muted-foreground hover:text-foreground">
                    {txnsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                </button>
            </div>
            {txnsLoading ? (
                <div className="space-y-2.5">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="flex items-center gap-3 animate-pulse">
                            <div className="w-6 h-6 rounded-full bg-secondary/60 flex-shrink-0" />
                            <div className="flex-1">
                                <div className="h-2.5 w-24 bg-secondary/60 rounded mb-1.5" />
                                <div className="h-2 w-16 bg-secondary/40 rounded" />
                            </div>
                            <div className="h-2.5 w-10 bg-secondary/40 rounded" />
                        </div>
                    ))}
                </div>
            ) : recentTxns.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No recent transactions</p>
            ) : (
                <div className="overflow-y-auto max-h-[180px] space-y-1">
                    {recentTxns.map((tx, i) => {
                        const sig = tx.txId || tx.signature || "";
                        const isError = !!tx.err;
                        const label = tx.type || "Transaction";
                        return (
                            <div key={i} className="flex items-center gap-2.5 py-2 px-2 rounded-lg hover:bg-secondary/30 transition-all group">
                                <div className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center ${isError ? "bg-red-500/20" : "bg-[var(--neon-teal)]/15"}`}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${isError ? "bg-red-400" : "bg-[var(--neon-teal)]"}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs font-semibold text-foreground truncate">{label}</div>
                                    <div className="text-[10px] text-muted-foreground font-mono">{sig ? `${sig.slice(0, 8)}...${sig.slice(-4)}` : "—"}</div>
                                </div>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                    <span className="text-[10px] text-muted-foreground">{timeAgo(tx.blockTime)}</span>
                                    {sig && (
                                        <a href={`https://solscan.io/tx/${sig}?cluster=devnet`} target="_blank" rel="noopener noreferrer" className="opacity-0 group-hover:opacity-100 transition-opacity">
                                            <ExternalLink className="w-3 h-3 text-muted-foreground hover:text-[var(--neon-teal)]" />
                                        </a>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            <div className="text-xs text-muted-foreground/50 mt-3 pt-3 border-t border-border/50">Last 8 transactions · Devnet</div>
        </div>
    );
}
