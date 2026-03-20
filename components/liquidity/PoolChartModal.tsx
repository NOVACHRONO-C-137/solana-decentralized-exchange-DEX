"use client"

import { useMemo, useState } from "react"
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip as RechartsTooltip, Cell } from "recharts"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DEVNET_TOKENS } from "@/components/liquidity/TokenSelectorModal";
import { useTokenBalances } from "@/hooks/useTokenBalances";
import { getTokenGradient } from "@/lib/tokens";


function TokenAvatar({ symbol, logoUrl }: { symbol: string, logoUrl?: string }) {
    const [imgError, setImgError] = useState(false);
    const gradient = getTokenGradient(symbol);

    if (logoUrl && !imgError) {
        return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
                src={logoUrl}
                alt={symbol}
                className="h-6 w-6 sm:h-8 sm:w-8 rounded-full border-2 border-background dark:border-[#0c0d10] object-cover"
                onError={() => setImgError(true)}
            />
        );
    }
    return (
        <div className={`h-6 w-6 sm:h-8 sm:w-8 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold text-sm border-2 border-background dark:border-[#0c0d10]`}>
            {symbol.charAt(0)}
        </div>
    );
}


function seededRandom(seed: number) {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
}

function generateMockData(poolName: string, isLiquidity: boolean) {

    let seed = 0;
    for (let i = 0; i < poolName.length; i++) {
        seed += poolName.charCodeAt(i) * (i + 1);
    }

    const data = [];
    const baseAmount = isLiquidity ? 1000000 : 300000;


    for (let i = 0; i < 10; i++) {
        const date = new Date();
        date.setDate(date.getDate() - (20 - i * 2));

        const randomFactor = seededRandom(seed + i + (isLiquidity ? 100 : 0));
        const variance = baseAmount * 0.4 * (randomFactor - 0.5);

        data.push({
            date: `${date.getMonth() + 1}/${date.getDate().toString().padStart(2, '0')}`,
            value: Math.floor(baseAmount + variance)
        });
    }
    return data;
}

export function PoolChartModal({ isOpen, onClose, poolName }: { isOpen: boolean, onClose: () => void, poolName: string }) {
    const [activeTab, setActiveTab] = useState<"volume" | "liquidity">("volume")

    // Fetch dynamically discovered tokens
    const { discoveredTokens } = useTokenBalances();

    const chartData = useMemo(() => {
        if (!poolName) return [];
        return generateMockData(poolName, activeTab === "liquidity");
    }, [poolName, activeTab]);

    // Merge static tokens with dynamic tokens
    const allTokens = useMemo(() => {
        return [...DEVNET_TOKENS, ...(discoveredTokens || [])];
    }, [discoveredTokens]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="w-[95vw] sm:max-w-[600px] bg-[rgba(235,248,230,0.88)] dark:bg-[rgba(255,255,255,0.03)] backdrop-blur-[4px] border border-black/[0.06] dark:border-[rgba(255,255,255,0.07)] shadow-[0_2px_20px_0_rgba(0,0,0,0.08)] text-foreground dark:text-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl overflow-hidden [&>button]:text-muted-foreground">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <div className="flex -space-x-2">
                            {poolName.split("-").map((symbol, idx) => {
                                // Look up the specific token in the merged list
                                const tokenInfo = allTokens.find(t => t.symbol === symbol);

                                return (
                                    <TokenAvatar
                                        key={idx}
                                        symbol={symbol}
                                        logoUrl={tokenInfo?.logoURI}
                                    />
                                );
                            })}
                        </div>
                        <DialogTitle className="text-lg sm:text-2xl font-bold">
                            {poolName}
                        </DialogTitle>
                    </div>
                </DialogHeader>

                {/* Raydium-style Tabs */}
                <div className="flex gap-1 mt-4 bg-black/[0.04] dark:bg-[rgba(255,255,255,0.03)] border border-black/[0.07] dark:border-[rgba(255,255,255,0.07)] rounded-xl p-1 w-fit">
                    <button
                        onClick={() => setActiveTab("volume")}
                        className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === "volume" ? "bg-[rgba(45,122,95,0.12)] dark:bg-[rgba(20,241,149,0.08)] text-[#1a5c45] dark:text-[#14f195] border border-[rgba(45,122,95,0.2)] dark:border-[rgba(20,241,149,0.2)]" : "text-muted-foreground hover:text-foreground"}`}
                    >
                        Volume
                    </button>
                    <button
                        onClick={() => setActiveTab("liquidity")}
                        className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === "liquidity" ? "bg-[rgba(45,122,95,0.12)] dark:bg-[rgba(20,241,149,0.08)] text-[#1a5c45] dark:text-[#14f195] border border-[rgba(45,122,95,0.2)] dark:border-[rgba(20,241,149,0.2)]" : "text-muted-foreground hover:text-foreground"}`}
                    >
                        Liquidity
                    </button>
                </div>

                {/* The Chart Container */}
                <div className="h-[250px] sm:h-[320px] w-full mt-4 sm:mt-6 pr-2 sm:pr-4">
                    <div className="chart-fade h-full w-full">
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
                                    stroke="rgba(100,120,110,0.6)"
                                    fontSize={11}
                                    tickLine={false}
                                    axisLine={false}
                                    dy={10}
                                />
                                <YAxis
                                    stroke="rgba(100,120,110,0.6)"
                                    fontSize={11}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(value) => `$${value.toLocaleString()}`}
                                />
                                <RechartsTooltip
                                    cursor={{ fill: 'hsl(var(--secondary))' }}
                                    contentStyle={{
                                        backgroundColor: 'hsl(var(--card))',
                                        backdropFilter: 'blur(8px)',
                                        border: '1px solid hsl(var(--border))',
                                        borderRadius: '8px',
                                        color: 'hsl(var(--foreground))'
                                    }}
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
                </div>

                <p className="text-center text-xs text-muted-foreground mt-2">Devnet • Illustrative data, not indexed via blockchain</p>

                <button
                    onClick={onClose}
                    className="w-full bg-[#2d8f62] hover:bg-[#3aaa76] dark:bg-[rgba(20,241,149,0.15)] dark:hover:bg-[rgba(20,241,149,0.25)] text-black dark:text-[#14f195] border border-[#2d8f62] dark:border-[rgba(20,241,149,0.25)] py-2 sm:py-3 rounded-lg font-bold text-sm sm:text-base tracking-wide mt-2 sm:mt-4 transition-all shadow-[0_2px_12px_rgba(45,143,98,0.35)]"
                >
                    Close
                </button>
            </DialogContent>
        </Dialog>
    )
}
