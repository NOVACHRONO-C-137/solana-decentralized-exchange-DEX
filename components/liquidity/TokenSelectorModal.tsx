"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, ExternalLink, Copy, Check, Wallet } from "lucide-react";

export type TokenInfo = {
    symbol: string;
    name: string;
    mint: string;
    decimals: number;
    color: string;
    icon: string;
    logoURI?: string;
};

// ── Your real devnet tokens ───────────────────────────────
export const DEVNET_TOKENS: TokenInfo[] = [
    {
        symbol: "SOL",
        name: "Solana",
        mint: "So11111111111111111111111111111111111111112",
        decimals: 9,
        color: "bg-gradient-to-br from-[#9945FF] to-[#14F195]",
        icon: "◎",
        logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
    },
    {
        symbol: "LHMN",
        name: "Lockheed Martin",
        mint: "6BNJtUnoB71BDVKh3g1bGUzU6yNgSig8pyqsUA75qnG5",
        decimals: 9,
        color: "bg-purple-500",
        icon: "✈️",
        logoURI: "https://img-v1-devnet.raydium.io/icon/6BNJtUnoB71BDVKh3g1bGUzU6yNgSig8pyqsUA75qnG5.png",
    },
    {
        symbol: "PLTR",
        name: "Palantir",
        mint: "4DUiEzJG2Z6Seuh1SYRjHnfaHDp86M21brBnDG8W8Wuq",
        decimals: 9,
        color: "bg-blue-500",
        icon: "🔷",
        logoURI: "https://img-v1-devnet.raydium.io/icon/4DUiEzJG2Z6Seuh1SYRjHnfaHDp86M21brBnDG8W8Wuq.png",
    },
];

// ── Token Logo Component ──────────────────────────────────
function TokenLogo({ token, size = 36 }: { token: TokenInfo; size?: number }) {
    const [imgError, setImgError] = useState(false);

    // SOL special case — gradient icon with Solana logo
    if (token.symbol === "SOL" && !token.logoURI) {
        return (
            <div
                className="rounded-full bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center"
                style={{ width: size, height: size }}
            >
                <svg viewBox="0 0 24 24" fill="none" style={{ width: size * 0.6, height: size * 0.6 }}>
                    <path d="M5.5 17.5L8.5 14.5H18.5L15.5 17.5H5.5Z" fill="white" stroke="white" strokeWidth="0.5" />
                    <path d="M5.5 6.5L8.5 9.5H18.5L15.5 6.5H5.5Z" fill="white" stroke="white" strokeWidth="0.5" />
                    <path d="M5.5 12L8.5 9H18.5L15.5 12H5.5Z" fill="white" stroke="white" strokeWidth="0.5" />
                </svg>
            </div>
        );
    }

    // Use plain <img> tag — no domain restrictions unlike next/image
    if (token.logoURI && !imgError) {
        return (
            <div className="rounded-full overflow-hidden shrink-0" style={{ width: size, height: size }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={token.logoURI}
                    alt={token.symbol}
                    width={size}
                    height={size}
                    className="rounded-full object-cover"
                    style={{ width: size, height: size }}
                    onError={() => setImgError(true)}
                />
            </div>
        );
    }

    // Fallback: colored circle with first letter
    return (
        <div
            className={`rounded-full ${token.color} flex items-center justify-center text-white font-bold shrink-0`}
            style={{ width: size, height: size, fontSize: size * 0.4 }}
        >
            {token.icon}
        </div>
    );
}

interface TokenSelectorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectToken: (token: TokenInfo) => void;
    /** Map of mint address → human-readable balance */
    balances?: Map<string, number>;
    balancesLoading?: boolean;
    /** Wallet tokens that aren't in DEVNET_TOKENS (auto-discovered) */
    discoveredTokens?: TokenInfo[];
}

export function TokenSelectorModal({ isOpen, onClose, onSelectToken, balances, balancesLoading, discoveredTokens = [] }: TokenSelectorModalProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

    const handleCopy = (e: React.MouseEvent, address: string) => {
        e.stopPropagation();
        navigator.clipboard.writeText(address);
        setCopiedAddress(address);
        setTimeout(() => setCopiedAddress(null), 2000);
    };

    // Merge DEVNET_TOKENS + discovered wallet tokens (no duplicates)
    const knownMints = new Set(DEVNET_TOKENS.map(t => t.mint));
    const allTokens = [
        ...DEVNET_TOKENS,
        ...discoveredTokens.filter(t => !knownMints.has(t.mint)),
    ];

    const filtered = allTokens.filter(
        (t) =>
            t.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.mint.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Sort tokens: those with balance first, then alphabetically
    const sorted = [...filtered].sort((a, b) => {
        const balA = balances?.get(a.mint) ?? 0;
        const balB = balances?.get(b.mint) ?? 0;
        if (balA > 0 && balB === 0) return -1;
        if (balB > 0 && balA === 0) return 1;
        if (balA !== balB) return balB - balA;
        return a.symbol.localeCompare(b.symbol);
    });

    const shortAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

    const formatBalance = (bal: number): string => {
        if (bal === 0) return "0";
        if (bal < 0.001) return "<0.001";
        if (bal < 1) return bal.toFixed(4);
        if (bal < 1000) return bal.toFixed(2);
        return bal.toLocaleString(undefined, { maximumFractionDigits: 2 });
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-[#11121a] text-white border-white/10 sm:max-w-[450px] p-0 shadow-2xl rounded-2xl overflow-hidden flex flex-col max-h-[80vh]">

                {/* Header & Search */}
                <div className="p-6 pb-2 shrink-0">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold">Select a token</DialogTitle>
                    </DialogHeader>

                    <div className="relative mt-4">
                        <input
                            type="text"
                            placeholder="Search by name, symbol or address"
                            className="w-full bg-black/40 border border-white/10 rounded-xl py-3.5 pl-4 pr-10 text-sm focus:outline-none focus:border-[var(--neon-teal)] transition-colors placeholder:text-white/30"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
                    </div>

                    {/* Quick select chips with balances */}
                    <div className="mt-5">
                        <p className="text-xs font-semibold text-white/50 mb-3">Devnet tokens</p>
                        <div className="flex flex-wrap gap-2">
                            {DEVNET_TOKENS.map((token) => {
                                const bal = balances?.get(token.mint) ?? 0;
                                return (
                                    <button
                                        key={token.symbol}
                                        onClick={() => { onSelectToken(token); onClose(); }}
                                        className="flex items-center gap-1.5 bg-black/40 hover:bg-white/10 border border-white/5 rounded-lg px-3 py-1.5 transition-colors"
                                    >
                                        <TokenLogo token={token} size={18} />
                                        <span className="text-sm font-medium">{token.symbol}</span>
                                        {bal > 0 && (
                                            <span className="text-[10px] text-[var(--neon-teal)] font-mono ml-0.5">{formatBalance(bal)}</span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex justify-between text-xs font-semibold text-white/40 mt-6 px-1 pb-2 border-b border-white/5">
                        <span>Token</span>
                        <span className="flex items-center gap-1">
                            <Wallet className="h-3 w-3" /> Balance
                        </span>
                    </div>
                </div>

                {/* Token List */}
                <div className="overflow-y-auto flex-1 px-4 pb-4">
                    {sorted.length === 0 ? (
                        <p className="text-center text-white/30 text-sm py-8">No tokens found</p>
                    ) : (
                        sorted.map((token) => {
                            const bal = balances?.get(token.mint) ?? 0;
                            return (
                                <div
                                    key={token.mint}
                                    onClick={() => { onSelectToken(token); onClose(); }}
                                    className="flex justify-between items-center p-3 hover:bg-white/5 rounded-xl cursor-pointer transition-colors group"
                                >
                                    <div className="flex items-center gap-3">
                                        <TokenLogo token={token} size={36} />
                                        <div className="flex flex-col">
                                            <span className="font-bold text-sm">{token.symbol}</span>
                                            <span className="text-xs text-white/50">{token.name}</span>
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-end gap-1">
                                        {/* Balance */}
                                        <div className="flex items-center gap-1.5">
                                            {balancesLoading ? (
                                                <div className="w-12 h-4 bg-white/5 rounded animate-pulse" />
                                            ) : bal > 0 ? (
                                                <span className="text-sm font-bold text-white">{formatBalance(bal)}</span>
                                            ) : (
                                                <span className="text-sm text-white/20">0</span>
                                            )}
                                        </div>
                                        {/* Address */}
                                        <div className="flex items-center gap-2 text-xs text-white/30">
                                            <span>{shortAddress(token.mint)}</span>
                                            <button
                                                onClick={(e) => handleCopy(e, token.mint)}
                                                className="hover:text-white transition-colors"
                                            >
                                                {copiedAddress === token.mint
                                                    ? <Check className="h-3.5 w-3.5 text-green-400" />
                                                    : <Copy className="h-3.5 w-3.5" />}
                                            </button>
                                            <a
                                                href={`https://solscan.io/token/${token.mint}?cluster=devnet`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={(e) => e.stopPropagation()}
                                                className="hover:text-[var(--neon-teal)] transition-colors"
                                            >
                                                <ExternalLink className="h-3.5 w-3.5" />
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                <div className="p-4 shrink-0 bg-black/20 border-t border-white/5">
                    <p className="text-center text-xs text-white/30">Devnet tokens · Connect wallet to see all your tokens</p>
                </div>
            </DialogContent>
        </Dialog>
    );
}