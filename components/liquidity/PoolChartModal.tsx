"use client"

import { useMemo, useState } from "react"
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip as RechartsTooltip, Cell } from "recharts"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

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
                            <div className="h-8 w-8 rounded-full bg-blue-500 border-2 border-background dark:border-[#0c0d10]" />
                            <div className="h-8 w-8 rounded-full bg-teal-400 border-2 border-background dark:border-[#0c0d10]" />
                        </div>
                        <DialogTitle className="text-xl font-bold flex items-center">
                            {poolName} <span className="text-xs text-muted-foreground ml-2 font-normal bg-secondary dark:bg-white/5 px-2 py-0.5 rounded">0.01%</span>
                        </DialogTitle>
                    </div>
                </DialogHeader>

                {/* Raydium-style Tabs */}
                <div className="flex gap-2 mt-4 bg-secondary/50 dark:bg-black/40 p-1 rounded-lg w-fit border border-border/50 dark:border-border/20">
                    <button
                        onClick={() => setActiveTab("volume")}
                        className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === "volume" ? "bg-background dark:bg-secondary text-foreground dark:text-white shadow-sm" : "text-muted-foreground hover:text-foreground dark:hover:text-white"}`}
                    >
                        Volume
                    </button>
                    <button
                        onClick={() => setActiveTab("liquidity")}
                        className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === "liquidity" ? "bg-background dark:bg-secondary text-foreground dark:text-white shadow-sm" : "text-muted-foreground hover:text-foreground dark:hover:text-white"}`}
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
                                    <stop offset="0%" stopColor={activeTab === "volume" ? "#8b5cf6" : "#2dd4bf"} stopOpacity={0.8} />
                                    <stop offset="100%" stopColor={activeTab === "volume" ? "#8b5cf6" : "#2dd4bf"} stopOpacity={0.2} />
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
                                itemStyle={{ color: activeTab === "volume" ? '#8b5cf6' : '#2dd4bf' }}
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

                <div className="flex justify-center mt-4">
                    <button
                        onClick={onClose}
                        className="bg-[var(--neon-teal)] text-black px-8 py-2 rounded-lg font-bold text-sm hover:shadow-[0_0_15px_var(--neon-teal-glow)] transition-all"
                    >
                        Close
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    )
}