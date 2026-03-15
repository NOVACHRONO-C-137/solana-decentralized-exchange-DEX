"use client"

import { useMemo, useState } from "react"
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip as RechartsTooltip, Cell } from "recharts"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

// ── Gradient color map for tokens without logos ──────────
const TOKEN_GRADIENTS: Record<string, string> = {
    SOL: "from-[#9945FF] to-[#14F195]",
    USDC: "from-[#2775CA] to-[#2775CA]",
    USDT: "from-[#26A17B] to-[#26A17B]",
    JitoSOL: "from-[#10B981] to-[#34D399]",
    mSOL: "from-[#C94DFF] to-[#7B61FF]",
    LHMN: "from-[#7C3AED] to-[#A855F7]",
    PLTR: "from-[#3B82F6] to-[#60A5FA]",
    RAY: "from-[#6366F1] to-[#818CF8]",
};

// Simple seeded PRNG to ensure the same pool name always yields the same chart data
function seededRandom(seed: number) {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
}

function generateMockData(poolName: string, isLiquidity: boolean) {
    // Generate a seed from the poolName string
    let seed = 0;
    for (let i = 0; i < poolName.length; i++) {
        seed += poolName.charCodeAt(i) * (i + 1);
    }

    const data = [];
    const baseAmount = isLiquidity ? 1000000 : 300000;

    // Generate 10 data points mimicking the last 20 days
    for (let i = 0; i < 10; i++) {
        const date = new Date();
        date.setDate(date.getDate() - (20 - i * 2)); // 2 days interval

        const randomFactor = seededRandom(seed + i + (isLiquidity ? 100 : 0));
        const variance = baseAmount * 0.4 * (randomFactor - 0.5); // +/- 20% variance

        data.push({
            date: `${date.getMonth() + 1}/${date.getDate().toString().padStart(2, '0')}`,
            value: Math.floor(baseAmount + variance)
        });
    }
    return data;
}

export function PoolChartModal({ isOpen, onClose, poolName }: { isOpen: boolean, onClose: () => void, poolName: string }) {
    const [activeTab, setActiveTab] = useState<"volume" | "liquidity">("volume")

    const chartData = useMemo(() => {
        if (!poolName) return [];
        return generateMockData(poolName, activeTab === "liquidity");
    }, [poolName, activeTab]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[600px] bg-background dark:bg-[#0c0d10] border-border dark:border-border/40 text-foreground dark:text-white shadow-2xl backdrop-blur-xl">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <div className="flex -space-x-2">
                            {poolName.split("-").map((symbol, idx) => {
                                const gradient = TOKEN_GRADIENTS[symbol] || "from-[#6B7280] to-[#9CA3AF]";
                                return (
                                    <div
                                        key={idx}
                                        className={`h-8 w-8 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold text-sm border-2 border-background dark:border-[#0c0d10]`}
                                    >
                                        {symbol.charAt(0)}
                                    </div>
                                );
                            })}
                        </div>
                        <DialogTitle className="text-xl font-bold">
                            {poolName}
                        </DialogTitle>
                    </div>
                </DialogHeader>

                {/* Raydium-style Tabs */}
                <div className="flex gap-1 mt-4 bg-secondary/40 dark:bg-black/30 border border-border rounded-xl p-1 w-fit">
                    <button
                        onClick={() => setActiveTab("volume")}
                        className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === "volume" ? "bg-[var(--neon-teal)]/10 text-[var(--neon-teal)] border border-[var(--neon-teal)]/30" : "text-muted-foreground hover:text-foreground"}`}
                    >
                        Volume
                    </button>
                    <button
                        onClick={() => setActiveTab("liquidity")}
                        className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === "liquidity" ? "bg-[var(--neon-teal)]/10 text-[var(--neon-teal)] border border-[var(--neon-teal)]/30" : "text-muted-foreground hover:text-foreground"}`}
                    >
                        Liquidity
                    </button>
                </div>

                {/* The Chart Container */}
                <div className="h-[320px] w-full mt-6 pr-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                            <defs>
                                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={activeTab === "volume" ? "#1E7FBF" : "#2dd4bf"} stopOpacity={0.8} />
                                    <stop offset="100%" stopColor={activeTab === "volume" ? "#1E7FBF" : "#2dd4bf"} stopOpacity={0.2} />
                                </linearGradient>
                            </defs>
                            <XAxis
                                dataKey="date"
                                stroke="#4b5563"
                                fontSize={11}
                                tickLine={false}
                                axisLine={false}
                                dy={10}
                            />
                            <YAxis
                                stroke="#4b5563"
                                fontSize={11}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(value) => `$${value.toLocaleString()}`}
                            />
                            <RechartsTooltip
                                cursor={{ fill: 'hsl(var(--secondary))' }}
                                contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--popover-foreground))' }}
                                itemStyle={{ color: activeTab === "volume" ? '#1E7FBF' : '#2dd4bf' }}
                                formatter={(value: number | undefined) => [`$${(value || 0).toLocaleString()}`, activeTab === "volume" ? "Volume" : "Liquidity"]}
                            />
                            <Bar
                                dataKey="value"
                                fill="url(#barGradient)"
                                radius={[4, 4, 0, 0]}
                                barSize={12}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <p className="text-center text-xs text-muted-foreground mt-2">Chart data is illustrative. Real on-chain data coming soon.</p>

                <button
                    onClick={onClose}
                    className="w-full bg-[var(--neon-teal)] text-black py-3 rounded-lg font-bold text-sm mt-4 hover:shadow-[0_0_15px_var(--neon-teal-glow)] transition-all"
                >
                    Close
                </button>
            </DialogContent>
        </Dialog>
    )
}