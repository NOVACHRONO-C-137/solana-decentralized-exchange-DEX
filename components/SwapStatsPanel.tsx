'use client';
import { useEffect, useState } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';

interface Props {
    fromToken: string;
    toToken: string;
    fromMint?: string;
    toMint?: string;
}

interface SwapTx {
    sig: string;
    time: number;
    from: string;
    to: string;
}

export default function SwapStatsPanel({ fromToken, toToken, fromMint, toMint }: Props) {
    const { connection } = useConnection();
    const [recentTxs, setRecentTxs] = useState<SwapTx[]>([]);
    const [poolInfo, setPoolInfo] = useState<{ tvl: string; fee: string; poolAddress: string } | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchPoolInfo();
        fetchRecentSwaps();
    }, [fromMint, toMint]);

    async function fetchPoolInfo() {
        try {
            setLoading(true);
            if (!fromMint || !toMint) {
                setPoolInfo(null);
                return;
            }
            // Raydium API is mainnet only — show static devnet info
            setPoolInfo({
                tvl: 'Devnet',
                fee: '0.25%',
                poolAddress: '',
            });
        } catch {
            setPoolInfo(null);
        } finally {
            setLoading(false);
        }
    }

    async function fetchRecentSwaps() {
        if (!fromMint) {
            setRecentTxs([]);
            return;
        }
        try {
            const mint = new PublicKey(fromMint);
            const sigs = await connection.getSignaturesForAddress(mint, { limit: 8 });
            const txs: SwapTx[] = sigs.map((s) => ({
                sig: s.signature,
                time: s.blockTime ?? 0,
                from: fromToken,
                to: toToken,
            }));
            setRecentTxs(txs);
        } catch {
            setRecentTxs([]);
        }
    }

    function timeAgo(unix: number) {
        const diff = Math.floor(Date.now() / 1000) - unix;
        if (diff < 60) return `${diff}s ago`;
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        return `${Math.floor(diff / 3600)}h ago`;
    }

    const cardCls = "rounded-2xl bg-[rgba(220,240,232,0.55)] dark:bg-[rgba(255,255,255,0.02)] backdrop-blur-[6px] border border-black/[0.07] dark:border-[rgba(255,255,255,0.08)] shadow-[0_2px_16px_0_rgba(0,0,0,0.07)] p-5";

    return (
        <div className="flex flex-col gap-4 w-full">

            {/* Pool Info */}
            <div className={cardCls}>
                <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Pool Info</div>
                {loading ? (
                    <div className="space-y-2">
                        {[1, 2, 3].map(i => <div key={i} className="h-4 rounded bg-black/[0.06] dark:bg-white/[0.05] animate-pulse" />)}
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Pair</span>
                            <span className="text-sm font-semibold">{fromToken || '—'} / {toToken || '—'}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Network</span>
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-500 border border-amber-400/20">Devnet</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Fee Tier</span>
                            <span className="text-sm font-mono font-semibold">0.25%</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">TVL</span>
                            <span className="text-sm text-muted-foreground italic">Not available on devnet</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Recent Swaps */}
            <div className={cardCls}>
                <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Recent Activity</div>
                {recentTxs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No recent transactions found.</p>
                ) : (
                    <div className="space-y-2">
                        {recentTxs.map((tx) => (
                            <div key={tx.sig} className="flex items-center justify-between py-2 border-b border-black/[0.04] dark:border-white/[0.04] last:border-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs w-2 h-2 rounded-full bg-emerald-500 dark:bg-[#14f195] inline-block shrink-0" />
                                    <a
                                        href={`https://solscan.io/tx/${tx.sig}?cluster=devnet`}
                                        target="_blank" rel="noopener noreferrer"
                                        className="text-xs font-mono text-emerald-600 dark:text-[#14f195] hover:underline"
                                    >
                                        {tx.sig.slice(0, 8)}...{tx.sig.slice(-4)}
                                    </a>
                                </div>
                                <span className="text-xs text-muted-foreground">{tx.time ? timeAgo(tx.time) : '—'}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

        </div>
    );
}
