"use client";

import { useState, Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowDown, ChevronDown, Settings, Link, BarChart2, RefreshCw, Wallet } from "lucide-react";
import Image from "next/image";
import { DEVNET_TOKENS, TokenSelectorModal, TokenInfo } from "@/components/liquidity/TokenSelectorModal";
import { useTokenBalances } from "@/hooks/useTokenBalances";

// Mock candlestick data
const CANDLES = [
    { t: "18:00", o: 90.3, h: 91.2, l: 89.1, c: 89.8 },
    { t: "19:00", o: 89.8, h: 90.1, l: 88.2, c: 88.5 },
    { t: "20:00", o: 88.5, h: 89.0, l: 87.3, c: 87.8 },
    { t: "21:00", o: 87.8, h: 88.2, l: 86.5, c: 86.9 },
    { t: "22:00", o: 86.9, h: 87.5, l: 85.8, c: 86.2 },
    { t: "23:00", o: 86.2, h: 86.8, l: 84.9, c: 85.1 },
    { t: "00:00", o: 85.1, h: 85.9, l: 84.2, c: 85.4 },
    { t: "03:00", o: 85.4, h: 86.1, l: 84.8, c: 85.2 },
    { t: "06:00", o: 85.2, h: 85.7, l: 84.1, c: 84.5 },
    { t: "09:00", o: 84.5, h: 85.0, l: 83.2, c: 83.8 },
    { t: "12:00", o: 83.8, h: 84.3, l: 82.5, c: 83.0 },
    { t: "15:00", o: 83.0, h: 85.2, l: 82.8, c: 85.1 },
    { t: "16:00", o: 85.1, h: 85.5, l: 84.8, c: 85.2 },
];

// ── Token Logo Helper ─────────────────────────────────────
function SwapTokenLogo({ token, size = 24 }: { token: TokenInfo; size?: number }) {
    const [imgError, setImgError] = useState(false);

    if (token.logoURI && !imgError) {
        return (
            <div className="rounded-full overflow-hidden border-2 border-[#161722]" style={{ width: size, height: size }}>
                <Image
                    src={token.logoURI}
                    alt={token.symbol}
                    width={size}
                    height={size}
                    className="rounded-full object-cover"
                    onError={() => setImgError(true)}
                    unoptimized
                />
            </div>
        );
    }

    if (token.symbol === "SOL") {
        return (
            <div className="rounded-full bg-gradient-to-br from-[#9945FF] to-[#14F195] border-2 border-[#161722] flex items-center justify-center" style={{ width: size, height: size }}>
                <svg viewBox="0 0 24 24" fill="none" style={{ width: size * 0.6, height: size * 0.6 }}>
                    <path d="M5.5 17.5L8.5 14.5H18.5L15.5 17.5H5.5Z" fill="white" stroke="white" strokeWidth="0.5" />
                    <path d="M5.5 6.5L8.5 9.5H18.5L15.5 6.5H5.5Z" fill="white" stroke="white" strokeWidth="0.5" />
                    <path d="M5.5 12L8.5 9H18.5L15.5 12H5.5Z" fill="white" stroke="white" strokeWidth="0.5" />
                </svg>
            </div>
        );
    }

    return (
        <div
            className={`rounded-full ${token.color} border-2 border-[#161722] flex items-center justify-center font-bold`}
            style={{ width: size, height: size, fontSize: size * 0.35 }}
        >
            {token.icon}
        </div>
    );
}

function CandlestickChart({ tokenA, tokenB }: { tokenA: string; tokenB: string }) {
    const minPrice = Math.min(...CANDLES.map(c => c.l));
    const maxPrice = Math.max(...CANDLES.map(c => c.h));
    const range = maxPrice - minPrice;
    const chartHeight = 260;
    const chartWidth = 520;
    const candleWidth = chartWidth / CANDLES.length - 4;

    const toY = (price: number) =>
        chartHeight - ((price - minPrice) / range) * (chartHeight - 20) - 10;

    return (
        <div className="relative w-full overflow-x-auto">
            {/* OHLC info */}
            <div className="flex items-center gap-4 mb-3 text-xs text-white/50">
                <span className="font-bold text-white">{tokenA} / {tokenB}</span>
                <span>O<span className="text-white ml-1">84.888</span></span>
                <span>H<span className="text-white ml-1">85.236</span></span>
                <span>L<span className="text-white ml-1">84.862</span></span>
                <span>C<span className="text-[var(--neon-teal)] ml-1">85.166 <span className="text-green-400">+0.33%</span></span></span>
            </div>

            <svg width="100%" viewBox={`0 0 ${chartWidth} ${chartHeight + 30}`} className="overflow-visible">
                {/* Grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                    const price = minPrice + ratio * range;
                    const y = toY(price);
                    return (
                        <g key={ratio}>
                            <line x1="0" y1={y} x2={chartWidth} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                            <text x={chartWidth - 2} y={y - 3} fill="rgba(255,255,255,0.3)" fontSize="9" textAnchor="end">
                                {price.toFixed(2)}
                            </text>
                        </g>
                    );
                })}

                {/* Current price line */}
                <line
                    x1="0" y1={toY(85.17)} x2={chartWidth} y2={toY(85.17)}
                    stroke="rgba(20,241,149,0.4)" strokeWidth="1" strokeDasharray="4,4"
                />
                <rect x={chartWidth - 52} y={toY(85.17) - 8} width={50} height={16} rx="3" fill="rgba(20,241,149,0.15)" stroke="rgba(20,241,149,0.4)" strokeWidth="1" />
                <text x={chartWidth - 27} y={toY(85.17) + 4} fill="rgba(20,241,149,0.9)" fontSize="9" textAnchor="middle" fontWeight="bold">85.1660</text>

                {/* Candles */}
                {CANDLES.map((c, i) => {
                    const x = i * (chartWidth / CANDLES.length) + candleWidth / 2 + 2;
                    const isGreen = c.c >= c.o;
                    const color = isGreen ? "#14F195" : "#ef4444";
                    const bodyTop = toY(Math.max(c.o, c.c));
                    const bodyBottom = toY(Math.min(c.o, c.c));
                    const bodyHeight = Math.max(bodyBottom - bodyTop, 1);
                    return (
                        <g key={i}>
                            {/* Wick */}
                            <line x1={x} y1={toY(c.h)} x2={x} y2={toY(c.l)} stroke={color} strokeWidth="1" opacity="0.8" />
                            {/* Body */}
                            <rect
                                x={x - candleWidth / 2}
                                y={bodyTop}
                                width={candleWidth}
                                height={bodyHeight}
                                fill={color}
                                opacity="0.85"
                                rx="1"
                            />
                        </g>
                    );
                })}

                {/* Time axis */}
                {CANDLES.filter((_, i) => i % 3 === 0).map((c, i) => (
                    <text
                        key={i}
                        x={(i * 3) * (chartWidth / CANDLES.length) + candleWidth / 2 + 2}
                        y={chartHeight + 20}
                        fill="rgba(255,255,255,0.25)"
                        fontSize="9"
                        textAnchor="middle"
                    >
                        {c.t}
                    </text>
                ))}

                {/* High/Low labels */}
                <text x={chartWidth - 5} y={toY(maxPrice) - 4} fill="rgba(255,255,255,0.4)" fontSize="8" textAnchor="end">
                    High {maxPrice.toFixed(6)}
                </text>
                <text x={chartWidth - 5} y={toY(minPrice) + 12} fill="rgba(255,255,255,0.4)" fontSize="8" textAnchor="end">
                    Low {minPrice.toFixed(6)}
                </text>

                {/* TradingView watermark */}
                <text x="12" y={chartHeight - 8} fill="rgba(255,255,255,0.1)" fontSize="20" fontWeight="bold">TV</text>
            </svg>
        </div>
    );
}

function SwapPageInner() {
    const searchParams = useSearchParams();
    const { balances, discoveredTokens, loading: balancesLoading, getBalance } = useTokenBalances();

    // Build balances map for modal
    const balancesMap = new Map<string, number>();
    balances.forEach((tb, mint) => balancesMap.set(mint, tb.balance));

    const defaultFrom = DEVNET_TOKENS.find(t => t.symbol === "SOL") || DEVNET_TOKENS[0];
    const defaultTo = DEVNET_TOKENS.find(t => t.symbol === "PLTR") || DEVNET_TOKENS[1];

    const [fromToken, setFromToken] = useState<TokenInfo>(defaultFrom);
    const [toToken, setToToken] = useState<TokenInfo>(defaultTo);
    const [fromAmount, setFromAmount] = useState<string>("");
    const [toAmount, setToAmount] = useState<string>("");
    const [slippage, setSlippage] = useState<string>("0.5");
    const [showSlippage, setShowSlippage] = useState<boolean>(false);
    const [timeframe, setTimeframe] = useState<string>("15m");
    const [mode, setMode] = useState<"Buy" | "Sell">("Buy");
    const [selectingFor, setSelectingFor] = useState<"from" | "to" | null>(null);

    // Read URL params
    useEffect(() => {
        const from = searchParams.get("from");
        const to = searchParams.get("to");
        if (from) {
            const found = DEVNET_TOKENS.find(t => t.symbol === from);
            if (found) setFromToken(found);
        }
        if (to) {
            const found = DEVNET_TOKENS.find(t => t.symbol === to);
            if (found) setToToken(found);
        }
    }, [searchParams]);

    const fromBalance = getBalance(fromToken.mint);
    const toBalance = getBalance(toToken.mint);

    const formatBal = (b: number) => {
        if (b === 0) return "0";
        if (b < 0.001) return "<0.001";
        if (b < 1) return b.toFixed(4);
        return b.toLocaleString(undefined, { maximumFractionDigits: 4 });
    };

    const handleSwapTokens = () => {
        setFromToken(toToken);
        setToToken(fromToken);
        setFromAmount(toAmount);
        setToAmount(fromAmount);
    };

    const handleFromAmount = (val: string) => {
        setFromAmount(val);
        const num = parseFloat(val) || 0;
        setToAmount(num > 0 ? (num * 85.17).toFixed(6) : "");
    };

    return (
        <main className="min-h-screen bg-[#0d0e14] text-white px-4 py-8">
            <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-6 items-start">

                {/* LEFT — Chart */}
                <div className="flex-1 bg-[#161722] border border-white/10 rounded-2xl p-5">
                    {/* Chart header */}
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="flex -space-x-1">
                                <SwapTokenLogo token={fromToken} size={24} />
                                <SwapTokenLogo token={toToken} size={24} />
                            </div>
                            <span className="font-bold">{fromToken.symbol} / {toToken.symbol}</span>
                            <button className="text-white/40 hover:text-white transition-colors">
                                <RefreshCw className="h-3.5 w-3.5" />
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Timeframe selector */}
                            <div className="flex bg-black/30 border border-white/10 rounded-lg overflow-hidden">
                                {["1m", "5m", "15m", "1H", "4H", "1D"].map((tf) => (
                                    <button
                                        key={tf}
                                        onClick={() => setTimeframe(tf)}
                                        className={`px-2.5 py-1.5 text-xs font-medium transition-all ${timeframe === tf ? "bg-white/10 text-white" : "text-white/30 hover:text-white"}`}
                                    >
                                        {tf}
                                    </button>
                                ))}
                            </div>
                            <button className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all">
                                <BarChart2 className="h-4 w-4 text-white/40" />
                            </button>
                        </div>
                    </div>

                    {/* Candlestick chart */}
                    <CandlestickChart tokenA={fromToken.symbol} tokenB={toToken.symbol} />

                    {/* Time axis label */}
                    <div className="flex justify-between items-center mt-2 text-xs text-white/30">
                        <span>16:49:20 (UTC)</span>
                        <div className="flex items-center gap-3">
                            <span className="cursor-pointer hover:text-white">%</span>
                            <span className="cursor-pointer hover:text-white">log</span>
                            <span className="cursor-pointer hover:text-white">auto</span>
                        </div>
                    </div>
                </div>

                {/* RIGHT — Swap Widget */}
                <div className="w-full lg:w-[360px] bg-[#161722] border border-white/10 rounded-2xl p-5 flex flex-col gap-4">

                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div className="flex bg-black/30 border border-white/10 rounded-xl overflow-hidden">
                            {(["Buy", "Sell"] as const).map((m) => (
                                <button
                                    key={m}
                                    onClick={() => setMode(m)}
                                    className={`px-5 py-2 text-sm font-bold transition-all ${mode === m ? "bg-[var(--neon-teal)]/20 text-[var(--neon-teal)]" : "text-white/40 hover:text-white"}`}
                                >
                                    {m}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Slippage */}
                            <div className="relative">
                                <button
                                    onClick={() => setShowSlippage(!showSlippage)}
                                    className="flex items-center gap-1 text-xs border border-white/10 rounded-lg px-2 py-1.5 text-white/50 hover:text-white hover:border-white/20 transition-all"
                                >
                                    <Settings className="h-3 w-3" />
                                    {slippage}%
                                </button>
                                {showSlippage && (
                                    <div className="absolute top-full right-0 mt-2 bg-[#0f1421] border border-white/10 rounded-xl p-3 z-50 w-48">
                                        <p className="text-xs text-white/50 mb-2">Slippage Tolerance</p>
                                        <div className="flex gap-2 mb-2">
                                            {["0.1", "0.5", "1.0"].map((s) => (
                                                <button
                                                    key={s}
                                                    onClick={() => { setSlippage(s); setShowSlippage(false); }}
                                                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${slippage === s ? "border-[var(--neon-teal)] text-[var(--neon-teal)]" : "border-white/10 text-white/50"}`}
                                                >
                                                    {s}%
                                                </button>
                                            ))}
                                        </div>
                                        <input
                                            type="number"
                                            placeholder="Custom"
                                            value={slippage}
                                            onChange={(e) => setSlippage(e.target.value)}
                                            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none"
                                        />
                                    </div>
                                )}
                            </div>
                            <button className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all">
                                <Link className="h-3.5 w-3.5 text-white/40" />
                            </button>
                        </div>
                    </div>

                    {/* From */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs text-white/40">From</span>
                            <div className="flex items-center gap-2">
                                <button className="flex items-center gap-1 text-xs text-white/40 hover:text-white transition-colors">
                                    <Wallet className="h-3 w-3" />
                                    <span>{formatBal(fromBalance)}</span>
                                </button>
                                {fromBalance > 0 && (
                                    <>
                                        <button
                                            onClick={() => {
                                                const max = fromToken.symbol === "SOL" ? Math.max(0, fromBalance - 0.01) : fromBalance;
                                                handleFromAmount(max.toString());
                                            }}
                                            className="text-xs bg-white/5 hover:bg-white/10 px-2 py-1 rounded-lg text-white/60 transition-all"
                                        >Max</button>
                                        <button
                                            onClick={() => handleFromAmount((fromBalance / 2).toString())}
                                            className="text-xs bg-white/5 hover:bg-white/10 px-2 py-1 rounded-lg text-white/60 transition-all"
                                        >50%</button>
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="bg-black/20 border border-white/10 rounded-xl p-4 flex justify-between items-center">
                            <button
                                onClick={() => setSelectingFor("from")}
                                className="flex items-center gap-2 bg-white/5 hover:bg-white/10 px-3 py-2 rounded-xl transition-all shrink-0"
                            >
                                <SwapTokenLogo token={fromToken} size={24} />
                                <span className="font-bold text-sm">{fromToken.symbol}</span>
                                <ChevronDown className="h-4 w-4 text-white/40" />
                            </button>
                            <div className="text-right">
                                <input
                                    type="number"
                                    placeholder="0"
                                    value={fromAmount}
                                    onChange={(e) => handleFromAmount(e.target.value)}
                                    className="bg-transparent text-xl font-bold text-white outline-none text-right w-32"
                                />
                                <p className="text-xs text-white/30">~$0</p>
                            </div>
                        </div>
                    </div>

                    {/* Swap arrow */}
                    <div className="flex justify-center -my-1">
                        <button
                            onClick={handleSwapTokens}
                            className="w-9 h-9 rounded-full bg-[#161722] border border-white/10 hover:border-[var(--neon-teal)]/40 flex items-center justify-center transition-all hover:bg-[var(--neon-teal)]/5"
                        >
                            <ArrowDown className="h-4 w-4 text-[var(--neon-teal)]" />
                        </button>
                    </div>

                    {/* To */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs text-white/40">To</span>
                            <div className="flex items-center gap-2">
                                <button className="flex items-center gap-1 text-xs text-white/40 hover:text-white transition-colors">
                                    <Wallet className="h-3 w-3" />
                                    <span>{formatBal(toBalance)}</span>
                                </button>
                            </div>
                        </div>
                        <div className="bg-black/20 border border-white/10 rounded-xl p-4 flex justify-between items-center">
                            <button
                                onClick={() => setSelectingFor("to")}
                                className="flex items-center gap-2 bg-white/5 hover:bg-white/10 px-3 py-2 rounded-xl transition-all shrink-0"
                            >
                                <SwapTokenLogo token={toToken} size={24} />
                                <span className="font-bold text-sm">{toToken.symbol}</span>
                                <ChevronDown className="h-4 w-4 text-white/40" />
                            </button>
                            <div className="text-right">
                                <input
                                    type="number"
                                    placeholder="0"
                                    value={toAmount}
                                    onChange={(e) => setToAmount(e.target.value)}
                                    className="bg-transparent text-xl font-bold text-white outline-none text-right w-32"
                                />
                                <p className="text-xs text-white/30">~$0</p>
                            </div>
                        </div>
                    </div>

                    {/* Rate info */}
                    {fromAmount && (
                        <div className="bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-xs text-white/50 flex justify-between">
                            <span>1 {fromToken.symbol} ≈ 85.17 {toToken.symbol}</span>
                            <span className="text-white/30">Slippage: {slippage}%</span>
                        </div>
                    )}

                    {/* Swap button */}
                    <button
                        disabled={!fromAmount}
                        className={`w-full font-bold py-4 rounded-xl transition-all ${fromAmount
                            ? "bg-[var(--neon-teal)] text-black hover:opacity-90 cursor-pointer"
                            : "bg-[var(--neon-teal)]/20 text-[var(--neon-teal)]/50 cursor-not-allowed"}`}
                    >
                        {fromAmount ? "Swap" : "Enter an amount"}
                    </button>
                </div>
            </div>

            {/* Token Selector Modal */}
            <TokenSelectorModal
                isOpen={selectingFor !== null}
                onClose={() => setSelectingFor(null)}
                onSelectToken={(token) => {
                    if (selectingFor === "from") {
                        if (token.mint === toToken.mint) setToToken(fromToken);
                        setFromToken(token);
                    }
                    if (selectingFor === "to") {
                        if (token.mint === fromToken.mint) setFromToken(toToken);
                        setToToken(token);
                    }
                    setFromAmount("");
                    setToAmount("");
                }}
                balances={balancesMap}
                balancesLoading={balancesLoading}
                discoveredTokens={discoveredTokens}
            />
        </main>
    );
}

export default function SwapPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-[#0d0e14] flex items-center justify-center text-white/40">
                Loading...
            </div>
        }>
            <SwapPageInner />
        </Suspense>
    );
}