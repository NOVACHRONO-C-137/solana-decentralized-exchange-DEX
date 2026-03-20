//components/liquidity/TokenSelectorModal.tsx

"use client";

import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, ExternalLink, Copy, Check, Loader2 } from "lucide-react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { resolveTokenFromMint } from "@/lib/token-metadata";

export type TokenInfo = {
    symbol: string;
    name: string;
    mint: string;
    decimals: number;
    color: string;
    icon: string;
    logoURI?: string;
};

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
];

function isValidSolanaPubkey(str: string): boolean {
    if (str.length < 32 || str.length > 44) return false;
    try { new PublicKey(str); return true; } catch { return false; }
}

function TokenLogo({ token, size = 36 }: { token: TokenInfo; size?: number }) {
    const [imgError, setImgError] = useState(false);

    if (token.symbol === "SOL" && !token.logoURI) {
        return (
            <div className="rounded-full bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center" style={{ width: size, height: size }}>
                <svg viewBox="0 0 24 24" fill="none" style={{ width: size * 0.6, height: size * 0.6 }}>
                    <path d="M5.5 17.5L8.5 14.5H18.5L15.5 17.5H5.5Z" fill="white" stroke="white" strokeWidth="0.5" />
                    <path d="M5.5 6.5L8.5 9.5H18.5L15.5 6.5H5.5Z" fill="white" stroke="white" strokeWidth="0.5" />
                    <path d="M5.5 12L8.5 9H18.5L15.5 12H5.5Z" fill="white" stroke="white" strokeWidth="0.5" />
                </svg>
            </div>
        );
    }

    if (token.logoURI && !imgError) {
        return (
            <div className="rounded-full overflow-hidden shrink-0" style={{ width: size, height: size }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={token.logoURI} alt={token.symbol} width={size} height={size}
                    className="rounded-full object-cover" style={{ width: size, height: size }}
                    onError={() => setImgError(true)} />
            </div>
        );
    }

    return (
        <div className={`rounded-full ${token.color} flex items-center justify-center text-white font-bold shrink-0`}
            style={{ width: size, height: size, fontSize: size * 0.4 }}>
            {token.icon}
        </div>
    );
}

interface TokenSelectorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectToken: (token: TokenInfo) => void;
    balances?: Map<string, number>;
    balancesLoading?: boolean;
    discoveredTokens?: TokenInfo[];
}

export function TokenSelectorModal({
    isOpen, onClose, onSelectToken, balances, balancesLoading, discoveredTokens = [],
}: TokenSelectorModalProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
    const { connected } = useWallet();
    const { connection } = useConnection();

    const [mintSearchLoading, setMintSearchLoading] = useState(false);
    const [mintSearchResult, setMintSearchResult] = useState<TokenInfo | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!isOpen) {
            setSearchQuery("");
            setMintSearchResult(null);
            setMintSearchLoading(false);
        }
    }, [isOpen]);

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);

        const q = searchQuery.trim();

        if (!isValidSolanaPubkey(q)) {
            setMintSearchResult(null);
            setMintSearchLoading(false);
            return;
        }

        const allLocal = [...DEVNET_TOKENS, ...discoveredTokens];
        if (allLocal.find(t => t.mint === q)) {
            setMintSearchResult(null);
            setMintSearchLoading(false);
            return;
        }

        setMintSearchLoading(true);
        setMintSearchResult(null);

        debounceRef.current = setTimeout(async () => {
            // resolveTokenFromMint: Raydium API → Metaplex on-chain PDA → fallback
            const result = await resolveTokenFromMint(q, "", allLocal, connection);
            setMintSearchLoading(false);
            setMintSearchResult(result);
        }, 500);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchQuery, discoveredTokens]);

    const handleCopy = (e: React.MouseEvent, address: string) => {
        e.stopPropagation();
        navigator.clipboard.writeText(address);
        setCopiedAddress(address);
        setTimeout(() => setCopiedAddress(null), 2000);
    };

    const knownMints = new Set(DEVNET_TOKENS.map(t => t.mint));
    const allTokens = [...DEVNET_TOKENS, ...discoveredTokens.filter(t => !knownMints.has(t.mint))];

    const filtered = allTokens.filter(t =>
        t.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.mint.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const sorted = [...filtered].sort((a, b) => {
        const balA = balances?.get(a.mint) ?? 0;
        const balB = balances?.get(b.mint) ?? 0;
        if (balA > 0 && balB === 0) return -1;
        if (balB > 0 && balA === 0) return 1;
        if (balA !== balB) return balB - balA;
        return a.symbol.localeCompare(b.symbol);
    });

    const shortAddr = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    const formatBal = (bal: number) => {
        if (bal === 0) return "0";
        if (bal < 0.001) return "<0.001";
        if (bal < 1) return bal.toFixed(4);
        if (bal < 1000) return bal.toFixed(2);
        return bal.toLocaleString(undefined, { maximumFractionDigits: 2 });
    };

    const isMintSearch = isValidSolanaPubkey(searchQuery.trim());

    const TokenRow = ({ token }: { token: TokenInfo }) => {
        const bal = balances?.get(token.mint) ?? 0;
        return (
            <div onClick={() => { onSelectToken(token); onClose(); }}
                className="flex justify-between items-center p-3 hover:bg-secondary/60 rounded-xl cursor-pointer transition-colors">
                <div className="flex items-center gap-3">
                    <TokenLogo token={token} size={32} />
                    <div className="flex flex-col">
                        <span className="font-bold text-sm text-foreground">{token.symbol}</span>
                        <span className="text-xs text-muted-foreground">{token.name}</span>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1.5">
                        {balancesLoading
                            ? <div className="w-12 h-4 bg-white/5 rounded animate-pulse" />
                            : bal > 0
                                ? <span className="text-sm font-bold text-foreground">{formatBal(bal)}</span>
                                : <span className="text-sm text-white/20">0</span>
                        }
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{shortAddr(token.mint)}</span>
                        <button onClick={(e) => handleCopy(e, token.mint)} className="hover:text-foreground transition-colors">
                            {copiedAddress === token.mint ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                        <a href={`https://solscan.io/token/${token.mint}?cluster=devnet`} target="_blank" rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()} className="hover:text-[var(--neon-teal)] transition-colors">
                            <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-[rgba(220,240,232,0.72)] dark:bg-[rgba(255,255,255,0.02)] backdrop-blur-[6px] border border-black/[0.06] dark:border-[rgba(255,255,255,0.06)] shadow-[0_2px_16px_0_rgba(0,0,0,0.06)] text-popover-foreground w-[90vw] max-w-[360px] p-0 rounded-2xl overflow-hidden flex flex-col max-h-[85vh]">

                <div className="p-4 pb-2 shrink-0">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-foreground">Select a token</DialogTitle>
                    </DialogHeader>

                    <div className="relative mt-4">
                        <input type="text" placeholder="Search by name, symbol or address"
                            className="w-full bg-white/70 dark:bg-[rgba(255,255,255,0.02)] border border-black/[0.08] dark:border-[rgba(255,255,255,0.06)] rounded-xl py-3.5 pl-4 pr-10 text-sm focus:outline-none focus:border-[#0D9B5F] dark:focus:border-[var(--neon-teal)] transition-colors placeholder:text-muted-foreground text-foreground"
                            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                        {mintSearchLoading
                            ? <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--neon-teal)] animate-spin" />
                            : <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#0D9B5F]/60 dark:text-muted-foreground" />
                        }
                    </div>

                    {!isMintSearch && (
                        <p className="text-[10px] text-muted-foreground mt-2 px-1">
                            Tip: Paste a token mint address to search the blockchain
                        </p>
                    )}

                    {!isMintSearch && (
                        <div className="mt-5">
                            <p className="text-xs font-semibold text-muted-foreground mb-3">Devnet tokens</p>
                            <div className="flex flex-wrap gap-2">
                                {DEVNET_TOKENS.map((token) => {
                                    const bal = balances?.get(token.mint) ?? 0;
                                    return (
                                        <button key={token.symbol}
                                            onClick={() => { onSelectToken(token); onClose(); }}
                                            className="flex items-center gap-1.5 bg-black/[0.04] dark:bg-[rgba(20,241,149,0.04)] border border-black/[0.08] dark:border-[rgba(20,241,149,0.1)] text-foreground rounded-lg px-3 py-1.5 transition-colors hover:border-[var(--neon-teal)]/40">
                                            <TokenLogo token={token} size={18} />
                                            <span className="text-sm font-medium">{token.symbol}</span>
                                            {bal > 0 && <span className="text-[10px] text-[var(--neon-teal)] font-mono ml-0.5">{formatBal(bal)}</span>}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {isMintSearch && (
                        <p className="text-xs font-semibold text-muted-foreground mt-4 mb-1 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--neon-teal)]" />
                            Searching blockchain for mint address
                        </p>
                    )}

                    <div className="flex justify-between text-xs font-semibold text-muted-foreground mt-4 px-1 pb-2 border-b border-border">
                        <span>Token</span>
                        <span>Balance</span>
                    </div>
                </div>

                <div className="overflow-y-auto flex-1 px-2 sm:px-4 pb-4 custom-scrollbar-teal">

                    {mintSearchLoading && (
                        <div className="flex items-center gap-3 p-4 rounded-xl border border-[var(--neon-teal)]/20 bg-[var(--neon-teal)]/5 mx-1 mt-2">
                            <Loader2 className="h-5 w-5 text-[var(--neon-teal)] animate-spin shrink-0" />
                            <div>
                                <p className="text-sm font-semibold text-foreground">Looking up token…</p>
                                <p className="text-xs text-muted-foreground">Checking blockchain for token mint address</p>
                            </div>
                        </div>
                    )}

                    {/* Found token card */}
                    {mintSearchResult && !mintSearchLoading && (
                        <div className="mt-2 mb-3 mx-1">
                            <p className="text-[10px] text-[var(--neon-teal)] font-semibold uppercase tracking-wider mb-2 px-1">
                                Found on blockchain
                            </p>
                            <div onClick={() => { onSelectToken(mintSearchResult); onClose(); setSearchQuery(""); }}
                                className="flex justify-between items-center p-3 rounded-xl border border-[var(--neon-teal)]/30 bg-[var(--neon-teal)]/5 hover:bg-[var(--neon-teal)]/10 cursor-pointer transition-all">
                                <div className="flex items-center gap-3">
                                    {/* Larger icon so logo is clearly visible */}
                                    <TokenLogo token={mintSearchResult} size={40} />
                                    <div className="flex flex-col">
                                        <span className="font-bold text-base text-foreground">{mintSearchResult.symbol}</span>
                                        <span className="text-xs text-muted-foreground">{mintSearchResult.name}</span>
                                        <span className="text-[10px] text-[var(--neon-teal)]/70 mt-0.5">
                                            {mintSearchResult.decimals} decimals
                                        </span>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    {(() => {
                                        const bal = balances?.get(mintSearchResult.mint) ?? 0;
                                        return bal > 0
                                            ? <span className="text-sm font-bold text-foreground">{formatBal(bal)}</span>
                                            : <span className="text-xs text-muted-foreground/50">Not in wallet</span>;
                                    })()}
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <span>{shortAddr(mintSearchResult.mint)}</span>
                                        <button onClick={(e) => handleCopy(e, mintSearchResult.mint)} className="hover:text-foreground transition-colors">
                                            {copiedAddress === mintSearchResult.mint ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                                        </button>
                                        <a href={`https://solscan.io/token/${mintSearchResult.mint}?cluster=devnet`} target="_blank" rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()} className="hover:text-[var(--neon-teal)] transition-colors">
                                            <ExternalLink className="h-3.5 w-3.5" />
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Wallet token list */}
                    {sorted.length > 0 && (
                        <>
                            {isMintSearch && (
                                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-2 px-1 mt-3">
                                    Your wallet
                                </p>
                            )}
                            {sorted.map(token => <TokenRow key={token.mint} token={token} />)}
                        </>
                    )}

                    {sorted.length === 0 && !isMintSearch && !mintSearchLoading && (
                        <p className="text-center text-muted-foreground text-sm py-8">No tokens found</p>
                    )}
                </div>

                <style dangerouslySetInnerHTML={{
                    __html: `.custom-scrollbar-teal::-webkit-scrollbar{width:6px}.custom-scrollbar-teal::-webkit-scrollbar-track{background:rgba(255,255,255,0.02);border-radius:8px}.custom-scrollbar-teal::-webkit-scrollbar-thumb{background:rgba(20,241,149,0.4);border-radius:8px}.custom-scrollbar-teal::-webkit-scrollbar-thumb:hover{background:rgba(20,241,149,0.8)}`
                }} />

                <div className="p-4 shrink-0 bg-[rgba(220,240,232,0.3)] dark:bg-transparent border-t border-black/[0.06] dark:border-[rgba(255,255,255,0.05)]">
                    <p className="text-center text-xs text-muted-foreground">
                        {connected ? "Showing all your wallet tokens" : "Connect wallet to see all your tokens"}
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    );
}