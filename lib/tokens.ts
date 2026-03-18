export const TOKEN_GRADIENTS: Record<string, string> = {
    SOL: "from-[#9945FF] to-[#14F195]",
    USDC: "from-[#2775CA] to-[#2775CA]",
    USDT: "from-[#26A17B] to-[#26A17B]",
    JitoSOL: "from-[#10B981] to-[#34D399]",
    mSOL: "from-[#C94DFF] to-[#7B61FF]",
    LHMN: "from-[#7C3AED] to-[#A855F7]",
    PLTR: "from-[#3B82F6] to-[#60A5FA]",
    RAY: "from-[#6366F1] to-[#818CF8]",
    RGR: "from-[#EF4444] to-[#F97316]",
    BIET: "from-[#F59E0B] to-[#EF4444]",
};

const TOKEN_SOLID_COLORS: Record<string, string> = {
    SOL: "#14F195",
    USDC: "#2775CA",
    USDT: "#26A17B",
    LHMN: "#A855F7",
    PLTR: "#3B82F6",
    RGR: "#F97316",
    RAY: "#6366F1",
    BIET: "#F59E0B",
};

export function getTokenColor(symbol: string, mint?: string): string {
    if (TOKEN_SOLID_COLORS[symbol]) return TOKEN_SOLID_COLORS[symbol];
    const seed = mint || symbol;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = seed.charCodeAt(i) + ((hash << 5) - hash);
        hash |= 0;
    }
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 65%, 55%)`;
}

export function getTokenGradient(symbol: string): string {
    if (TOKEN_GRADIENTS[symbol]) return TOKEN_GRADIENTS[symbol];
    let hash = 0;
    for (let i = 0; i < symbol.length; i++) {
        hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
        hash |= 0;
    }
    const hue1 = Math.abs(hash % 360);
    const hue2 = (hue1 + 40) % 360;
    return `from-[hsl(${hue1},70%,60%)] to-[hsl(${hue2},70%,45%)]`;
}
