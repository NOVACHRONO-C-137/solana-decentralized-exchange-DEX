"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronDown, Loader2 } from "lucide-react";
import { TokenSelectorModal, TokenInfo } from "@/components/liquidity/TokenSelectorModal";

const feeTiers = ["0.25%", "0.3%", "1%"];

export default function StandardPoolPage() {
    const router = useRouter();

    const [isTokenModalOpen, setIsTokenModalOpen] = useState<boolean>(false);
    const [activeSlot, setActiveSlot] = useState<"base" | "quote" | null>(null);
    const [baseToken, setBaseToken] = useState<TokenInfo | null>(null);
    const [quoteToken, setQuoteToken] = useState<TokenInfo | null>(null);
    const [baseAmount, setBaseAmount] = useState<string>("");
    const [quoteAmount, setQuoteAmount] = useState<string>("");
    const [initialPrice, setInitialPrice] = useState<string>("");
    const [feeTierOpen, setFeeTierOpen] = useState<boolean>(false);
    const [selectedFee, setSelectedFee] = useState<string>("");
    const [startTime, setStartTime] = useState<"now" | "custom">("now");

    // NEW STATE: Loading flow
    const [isCreating, setIsCreating] = useState(false);

    const handleTokenSelect = (token: TokenInfo) => {
        if (activeSlot === "base") setBaseToken(token);
        if (activeSlot === "quote") setQuoteToken(token);
        setIsTokenModalOpen(false);
    };

    const handleCreatePool = () => {
        if (!canInitialize) return;
        setIsCreating(true);

        // Simulate a network creation request (1.5 seconds)
        setTimeout(() => {
            // Read existing custom pools
            const stored = localStorage.getItem("aeroCustomPools");
            let customPools = [];
            try {
                if (stored) customPools = JSON.parse(stored);
            } catch (e) {
                console.error("Failed to parse custom pools", e);
            }

            // Create a pseudo-random Pool ID
            const poolIdHash = Math.random().toString(36).substring(2, 8) + '...' + Math.random().toString(36).substring(2, 8);

            // Compute roughly mock USD value for Liquidity & Volume
            const liquidityNum = (parseFloat(baseAmount) || 1000) * 2;
            const volumeNum = liquidityNum * 0.4;

            // Example base/quote combined name
            const newPool = {
                id: `custom_${Date.now()}`,
                name: `${baseToken}-${quoteToken}`,
                liquidity: `$${liquidityNum.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                volume: `$${volumeNum.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                apr: `${(Math.random() * 5 + 1).toFixed(2)}%`,
                fee: selectedFee || "0.25%",
                poolId: poolIdHash,
                aprBreakdown: {
                    tradeFees: `${(Math.random() * 3).toFixed(2)}%`,
                    yield: `${(Math.random() * 2).toFixed(2)}%`
                }
            };

            // Save back to localStorage
            customPools.push(newPool);
            localStorage.setItem("aeroCustomPools", JSON.stringify(customPools));

            // Redirect back to pools table
            router.push("/liquidity");
        }, 1500);
    };

    const canInitialize = baseToken && quoteToken && initialPrice && !isCreating;

    return (
        <main className="container mx-auto px-4 py-12 flex flex-col items-center min-h-screen text-white">
            <div className="w-full max-w-5xl flex flex-col md:flex-row gap-8">

                {/* LEFT SIDEBAR */}
                <div className="w-full md:w-1/3 flex flex-col gap-4">
                    <button
                        onClick={() => router.back()}
                        className="flex items-center text-white/60 hover:text-white transition-colors w-fit mb-2"
                    >
                        <ChevronLeft className="h-5 w-5 mr-1" /> Back
                    </button>

                    <div className="bg-[#161722] border border-white/10 rounded-2xl p-5">
                        <h4 className="flex items-center text-sm font-bold mb-2">
                            <span className="w-4 h-4 rounded-full border border-white/40 text-white/60 flex items-center justify-center text-[10px] mr-2">!</span>
                            Please Note
                        </h4>
                        <p className="text-xs text-white/50 leading-relaxed">
                            This tool is for advanced users. For detailed instructions, read the guide for{" "}
                            <span className="text-[var(--neon-teal)] cursor-pointer hover:underline">CLMM</span> or{" "}
                            <span className="text-[var(--neon-teal)] cursor-pointer hover:underline">Standard</span> pools.
                        </p>
                    </div>
                </div>

                {/* RIGHT SIDE */}
                <div className="w-full md:w-2/3">
                    <h2 className="text-xl font-bold mb-6">Initialize CPMM pool</h2>

                    <div className="bg-[#161722] border border-white/10 rounded-2xl p-6 flex flex-col gap-5">

                        {/* Initial Liquidity */}
                        <div>
                            <p className="text-sm font-bold mb-3">Initial liquidity</p>

                            {/* Base Token */}
                            <div className="bg-black/20 border border-white/10 rounded-xl p-4 mb-1">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-xs text-white/40">Base token</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-white/40">0</span>
                                        <button className="text-xs bg-white/5 hover:bg-white/10 px-2 py-1 rounded-lg text-white/60 transition-all">Max</button>
                                        <button className="text-xs bg-white/5 hover:bg-white/10 px-2 py-1 rounded-lg text-white/60 transition-all">50%</button>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <button
                                        onClick={() => { setActiveSlot("base"); setIsTokenModalOpen(true); }}
                                        className="flex items-center gap-2 bg-white/5 hover:bg-white/10 px-3 py-2 rounded-xl transition-all"
                                    >
                                        {baseToken && (
                                            <div className="w-6 h-6 rounded-full bg-yellow-500 flex items-center justify-center text-[9px] font-bold text-black">
                                                {baseToken.icon || baseToken.symbol[0]}
                                            </div>
                                        )}
                                        <span className="font-bold text-sm">{baseToken?.symbol || "Select"}</span>
                                        <ChevronDown className="h-4 w-4 text-white/40" />
                                    </button>
                                    <div className="text-right">
                                        <input
                                            type="number"
                                            placeholder="0"
                                            value={baseAmount}
                                            onChange={(e) => setBaseAmount(e.target.value)}
                                            className="bg-transparent text-2xl font-bold text-white outline-none text-right w-36"
                                        />
                                        <p className="text-xs text-white/30">~${(parseFloat(baseAmount) || 0).toFixed(2)}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Plus divider */}
                            <div className="flex justify-center my-1">
                                <div className="w-8 h-8 rounded-full bg-[#161722] border border-white/10 flex items-center justify-center text-white/40 font-bold text-lg">
                                    +
                                </div>
                            </div>

                            {/* Quote Token */}
                            <div className="bg-black/20 border border-white/10 rounded-xl p-4">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-xs text-white/40">Quote token</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-white/40">0</span>
                                        <button className="text-xs bg-white/5 hover:bg-white/10 px-2 py-1 rounded-lg text-white/60 transition-all">Max</button>
                                        <button className="text-xs bg-white/5 hover:bg-white/10 px-2 py-1 rounded-lg text-white/60 transition-all">50%</button>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <button
                                        onClick={() => { setActiveSlot("quote"); setIsTokenModalOpen(true); }}
                                        className="flex items-center gap-2 bg-white/5 hover:bg-white/10 px-3 py-2 rounded-xl transition-all"
                                    >
                                        {quoteToken && (
                                            <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-[9px] font-bold text-white">
                                                {quoteToken.icon || quoteToken.symbol[0]}
                                            </div>
                                        )}
                                        <span className="font-bold text-sm">{quoteToken?.symbol || "Select"}</span>
                                        <ChevronDown className="h-4 w-4 text-white/40" />
                                    </button>
                                    <div className="text-right">
                                        <input
                                            type="number"
                                            placeholder="0"
                                            value={quoteAmount}
                                            onChange={(e) => setQuoteAmount(e.target.value)}
                                            className="bg-transparent text-2xl font-bold text-white outline-none text-right w-36"
                                        />
                                        <p className="text-xs text-white/30">~${(parseFloat(quoteAmount) || 0).toFixed(2)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Initial Price */}
                        <div>
                            <p className="text-sm font-bold mb-2">Initial price</p>
                            <div className="bg-black/20 border border-white/10 rounded-xl px-4 py-3 flex justify-between items-center">
                                <input
                                    type="number"
                                    placeholder="Enter price"
                                    value={initialPrice}
                                    onChange={(e) => setInitialPrice(e.target.value)}
                                    className="bg-transparent text-lg font-bold text-white outline-none flex-1"
                                />
                                <span className="text-xs text-white/40 shrink-0">
                                    {quoteToken && baseToken ? `${quoteToken.symbol}/${baseToken.symbol}` : "—"}
                                </span>
                            </div>
                            {baseToken && quoteToken && (
                                <p className="text-xs text-white/40 mt-2">
                                    Current price: <span className="text-white/60">1 {baseToken.symbol} ≈ — {quoteToken.symbol}</span>
                                </p>
                            )}
                        </div>

                        {/* Fee Tier */}
                        <div>
                            <p className="text-sm font-bold mb-2">Fee Tier</p>
                            <div className="relative">
                                <div
                                    onClick={() => setFeeTierOpen(!feeTierOpen)}
                                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 flex justify-between items-center cursor-pointer hover:border-white/20 transition-all"
                                >
                                    <span className={`font-bold ${selectedFee ? "text-white" : "text-white/30"}`}>
                                        {selectedFee || "Select fee tier"}
                                    </span>
                                    <ChevronDown className={`h-5 w-5 text-white/40 transition-transform duration-200 ${feeTierOpen ? "rotate-180" : ""}`} />
                                </div>
                                {feeTierOpen && (
                                    <div className="absolute top-full left-0 w-full mt-1 bg-[#0f1421] border border-white/10 rounded-xl overflow-hidden z-50">
                                        {feeTiers.map((tier) => (
                                            <div
                                                key={tier}
                                                onClick={() => { setSelectedFee(tier); setFeeTierOpen(false); }}
                                                className="px-4 py-3 cursor-pointer hover:bg-white/5 transition-all font-medium text-white/70 hover:text-white"
                                            >
                                                {tier}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Start Time */}
                        <div>
                            <p className="text-sm font-bold mb-2">Start time:</p>
                            <div className="flex bg-black/30 border border-white/10 rounded-xl overflow-hidden">
                                <button
                                    onClick={() => setStartTime("now")}
                                    className={`flex-1 py-2.5 text-sm font-medium transition-all ${startTime === "now" ? "bg-white/10 text-white" : "text-white/40 hover:text-white"}`}
                                >
                                    Start Now
                                </button>
                                <button
                                    onClick={() => setStartTime("custom")}
                                    className={`flex-1 py-2.5 text-sm font-medium transition-all ${startTime === "custom" ? "bg-white/10 text-white" : "text-white/40 hover:text-white"}`}
                                >
                                    Custom
                                </button>
                            </div>
                            {startTime === "custom" && (
                                <input
                                    type="datetime-local"
                                    className="mt-3 w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white outline-none text-sm"
                                />
                            )}
                        </div>

                        {/* Warning note */}
                        <p className="text-xs text-yellow-400/80">
                            Note: A creation fee of ~0.2 SOL is required for new pools.{" "}
                            <span className="text-white/40 cursor-pointer hover:text-white">ⓘ</span>
                        </p>

                        {/* Submit */}
                        <button
                            onClick={handleCreatePool}
                            disabled={!canInitialize}
                            className={`w-full font-bold flex justify-center items-center py-4 rounded-xl transition-all ${canInitialize
                                ? "bg-[var(--neon-teal)] text-black hover:opacity-90 cursor-pointer"
                                : "bg-[var(--neon-teal)]/30 text-[var(--neon-teal)]/50 cursor-not-allowed"}`}
                        >
                            {isCreating ? (
                                <>
                                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                    Creating Pool...
                                </>
                            ) : (
                                "Initialize Liquidity Pool"
                            )}
                        </button>
                    </div>
                </div>
            </div>


        </main>
    );
}