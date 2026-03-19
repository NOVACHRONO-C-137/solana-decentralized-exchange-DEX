"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { PublicKey } from "@solana/web3.js";
import { glassCard } from "@/lib/utils";

interface WalletCardProps {
    publicKey: PublicKey;
    solBalance: number;
    prices: Record<string, number>;
    balancesLoading: boolean;
}

const SOL_PRICE_MINT = "So11111111111111111111111111111111111111112";

export function WalletCard({ publicKey, solBalance, prices, balancesLoading }: WalletCardProps) {
    const [walletCopied, setWalletCopied] = useState(false);
    const addr = publicKey.toBase58();
    const shortAddr = `${addr.slice(0, 4)}...${addr.slice(-4)}`;
    const solPrice = prices[SOL_PRICE_MINT] || 0;

    const copyWallet = () => {
        navigator.clipboard.writeText(addr);
        setWalletCopied(true);
        setTimeout(() => setWalletCopied(false), 2000);
    };

    return (
        <div className={`${glassCard} p-5 min-h-[160px]`}>
            <div className="flex items-center justify-between mb-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Wallet</h3>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[var(--neon-teal)] animate-pulse" />
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-500 dark:text-yellow-400">Devnet</span>
                </div>
            </div>
            <div className="mb-4">
                <div className="flex items-center gap-3 mb-1">
                    <img src="https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png" alt="SOL" width={28} height={28} className="rounded-full flex-shrink-0" />
                    {balancesLoading
                        ? <div className="h-8 w-32 bg-secondary/60 rounded-lg animate-pulse" />
                        : <span className="text-3xl font-bold text-foreground">{solBalance.toFixed(4)}<span className="text-base font-semibold text-muted-foreground ml-2">SOL</span></span>
                    }
                </div>
                {solPrice > 0 && <p className="text-xs text-muted-foreground ml-10">≈ ${(solBalance * solPrice).toFixed(2)}</p>}
            </div>
            <div className="mb-4 pb-4 border-b border-border/50">
                <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground font-mono">{shortAddr}</span>
                    <div className="flex items-center gap-1">
                        <button onClick={copyWallet} className="p-1 hover:bg-secondary/60 dark:hover:bg-white/10 rounded transition-all">
                            {walletCopied ? <Check className="w-3.5 h-3.5 text-[var(--neon-teal)]" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                        </button>
                        <a href={`https://solscan.io/account/${addr}?cluster=devnet`} target="_blank" rel="noopener noreferrer" className="text-[var(--neon-teal)] text-xs hover:underline flex items-center gap-0.5">
                            Solscan <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-yellow-500" />
                <span className="text-xs text-muted-foreground">Network: Devnet</span>
            </div>
        </div>
    );
}
