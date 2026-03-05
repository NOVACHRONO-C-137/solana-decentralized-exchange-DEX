//components/liquidity/LiquidityPoolsTable.tsx


"use client";

import { useState, useEffect } from "react";
import { BarChart2, ArrowLeftRight, Plus, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PoolChartModal } from "./PoolChartModal";
import { CreatePoolModal } from "./CreatePoolModal";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { DEVNET_PROGRAM_ID } from "@raydium-io/raydium-sdk-v2";

// ── Pool type ─────────────────────────────────────────────
interface PoolData {
    id: string;
    name: string;
    liquidity: string;
    volume: string;
    fees: string;
    apr: string;
    fee: string;
    poolId: string;
    aprBreakdown: { tradeFees: string; yield: string };
    mintA?: string;
    mintB?: string;
    decimalsA?: number;
    decimalsB?: number;
    logoA?: string;
    logoB?: string;
    symbolA?: string;
    symbolB?: string;
    colorA?: string;
    colorB?: string;
}

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

// ── Token icon component ─────────────────────────────────
function TokenIcon({ logo, symbol, size = 28, className = "" }: { logo?: string; symbol: string; size?: number; className?: string }) {
    const [imgError, setImgError] = useState(false);
    const gradient = TOKEN_GRADIENTS[symbol] || "from-[#6B7280] to-[#9CA3AF]";

    if (logo && !imgError) {
        return (
            <div className={`rounded-full overflow-hidden border-2 border-[#0c0d14] bg-[#1a1b2e] ${className}`}
                style={{ width: size, height: size }}>
                <Image
                    src={logo}
                    alt={symbol}
                    width={size}
                    height={size}
                    className="rounded-full object-cover"
                    onError={() => setImgError(true)}
                    unoptimized
                />
            </div>
        );
    }

    return (
        <div
            className={`rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center border-2 border-[#0c0d14] text-white font-bold ${className}`}
            style={{ width: size, height: size, fontSize: size * 0.36 }}
        >
            {symbol.charAt(0)}
        </div>
    );
}


// ── Devnet stablecoin mint addresses → USD price ─────────
// Add your mock USDC mint here so it's treated as $1.00
const DEVNET_STABLECOIN_MINTS: Record<string, number> = {
    "2C6gE8sR3c7DTga5XKhg4uvjC8PdQxhPXe76wiyNoKCm": 1.0,  // ← replace with your actual mock USDC mint
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": 1.0, // real USDC (mainnet ref)
};

// ── Hardcoded devnet pool IDs ─────────────────────────────
// These are your real pools created on Solana devnet.
// They will ALWAYS show up, regardless of browser/device/deployment.
// The Raydium API provides live data (liquidity, logos, volume, etc.)
const HARDCODED_DEVNET_POOL_IDS = [
    "Ed6FzPjRPmUDkrimShSACrV1wYKYVstjKSADue3vUT8k",  // PLTR-LHMN 0.25% (has 110+110 liquidity)
    "GXtdBn7V5W2inkw6NLGyS3AXpsZnAezhDUpTT4m9uUQW",  // PLTR-LHMN 0.05%
    "95isNkxiNLU8xQHFQ4brRc8crGzWvBGeFb9JmKr5WDJF",  // PLTR-LHMN 0.01%
];

// ── USD Pricing Helpers ───────────────────────────────────
const USD_FMT = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function fetchBasePrice(symbol: string): Promise<number | null> {
    const sym = symbol.toUpperCase();

    // Real stablecoins
    if (sym === "USDC" || sym === "USDT" || sym === "MUSDC") return 1.0;

    // SOL variants
    if (sym === "SOL" || sym === "MSOL" || sym === "JITOSOL") {
        try {
            const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd");
            const data = await res.json();
            return data?.solana?.usd ?? 150.0;
        } catch {
            return 150.0;
        }
    }

    return null;
}

function getMintPrice(mintAddress: string): number | null {
    return DEVNET_STABLECOIN_MINTS[mintAddress] ?? null;
}

function deriveTokenPrices(
    symA: string, symB: string,
    mintA: string, mintB: string,  // ← add mint addresses
    poolPrice: number,
    basePrices: Map<string, number | null>
): { priceA: number; priceB: number } {

    // Check by mint address first (most reliable)
    const mintPriceA = getMintPrice(mintA);
    const mintPriceB = getMintPrice(mintB);

    if (mintPriceA != null && mintPriceB != null) {
        return { priceA: mintPriceA, priceB: mintPriceB };
    }
    if (mintPriceA != null) {
        return { priceA: mintPriceA, priceB: poolPrice > 0 ? mintPriceA / poolPrice : 0 };
    }
    if (mintPriceB != null) {
        return { priceA: mintPriceB * poolPrice, priceB: mintPriceB };
    }

    // Fall back to symbol-based lookup
    const knownA = basePrices.get(symA.toUpperCase());
    const knownB = basePrices.get(symB.toUpperCase());
    if (knownA != null) return { priceA: knownA, priceB: poolPrice > 0 ? knownA / poolPrice : 0 };
    if (knownB != null) return { priceA: knownB * poolPrice, priceB: knownB };

    return { priceA: 1.0, priceB: poolPrice > 0 ? 1.0 / poolPrice : 1.0 };
}

// Builds a PoolData from Raydium API response + computed USD prices
function apiPoolToPoolData(live: any, priceA: number, priceB: number): PoolData {
    const tvl = live.tvl || 0;
    const vol24h = live.day?.volume || 0;
    const fees24h = live.day?.volumeFee || 0;
    const apr24h = live.day?.apr || 0;
    const mintAmountA = live.mintAmountA || 0;
    const mintAmountB = live.mintAmountB || 0;
    const symA = live.mintA?.symbol || "?";
    const symB = live.mintB?.symbol || "?";
    const feeRate = live.feeRate || 0;
    const feePct = feeRate < 1 ? `${(feeRate * 100).toFixed(2)}%` : `${feeRate}%`;

    // Calculate USD TVL
    let liquidity: string;
    if (tvl > 0) {
        liquidity = USD_FMT.format(tvl);
    } else if (mintAmountA > 0 || mintAmountB > 0) {
        const usdTvl = (mintAmountA * priceA) + (mintAmountB * priceB);
        liquidity = USD_FMT.format(usdTvl);
    } else {
        liquidity = "$0.00";
    }

    // Calculate 24h volume & fees in USD (if available from API, use it; otherwise keep $0)
    const volumeStr = vol24h > 0 ? USD_FMT.format(vol24h) : "$0.00";
    const feesStr = fees24h > 0 ? USD_FMT.format(fees24h) : "$0.00";

    return {
        id: live.id,
        name: `${symA}-${symB}`,
        liquidity,
        volume: volumeStr,
        fees: feesStr,
        apr: apr24h > 0 ? `${apr24h.toFixed(2)}%` : "0%",
        fee: feePct,
        poolId: `${live.id.slice(0, 6)}...${live.id.slice(-4)}`,
        aprBreakdown: {
            tradeFees: live.day?.feeApr ? `${live.day.feeApr.toFixed(2)}%` : "0%",
            yield: "0%",
        },
        mintA: live.mintA?.address,
        mintB: live.mintB?.address,
        decimalsA: live.mintA?.decimals,
        decimalsB: live.mintB?.decimals,
        logoA: live.mintA?.logoURI,
        logoB: live.mintB?.logoURI,
        symbolA: symA,
        symbolB: symB,
    };
}

// ── Discover pool IDs from on-chain CLMM positions ───────
async function discoverOnChainPoolIds(
    connection: any,
    walletPubkey: PublicKey
): Promise<string[]> {
    try {
        const CLMM_PROGRAM = DEVNET_PROGRAM_ID.CLMM_PROGRAM_ID;

        // Fetch all PersonalPosition accounts (size = 188 bytes) owned by the wallet
        // PersonalPosition layout: discriminator(8) + nftMint(32) + poolId(32) + ...
        // The poolId is at offset 40 (bytes 40-72)
        const accounts = await connection.getProgramAccounts(
            new PublicKey(CLMM_PROGRAM),
            {
                filters: [
                    { dataSize: 188 },  // PersonalPosition account size
                ]
            }
        );

        // Extract unique pool IDs from position accounts
        // PersonalPosition layout: discriminator(8) + nftMint(32) + poolId(32) + ...
        const poolIds = new Set<string>();
        for (const { account } of accounts) {
            try {
                const poolIdBytes = account.data.subarray(40, 72);
                const poolId = new PublicKey(poolIdBytes).toBase58();
                poolIds.add(poolId);
            } catch { /* skip malformed accounts */ }
        }

        console.log(`🔍 Discovered ${poolIds.size} pool IDs from on-chain positions`);
        return Array.from(poolIds);
    } catch (err) {
        console.warn("⚠️ Failed to discover on-chain pools:", err);
        return [];
    }
}

// ── Discover pool IDs by scanning PoolState accounts ──────
// PoolState accounts have a creator field we can match
async function discoverCreatedPools(
    connection: any,
    walletPubkey: PublicKey
): Promise<string[]> {
    try {
        const CLMM_PROGRAM = DEVNET_PROGRAM_ID.CLMM_PROGRAM_ID;

        // PoolState accounts are 1544 bytes. The owner/creator is at offset 73.
        // Layout: discriminator(8) + bump(1) + ammConfig(32) + creator(32) + ...
        // So creator starts at offset 41
        const accounts = await connection.getProgramAccounts(
            new PublicKey(CLMM_PROGRAM),
            {
                filters: [
                    { dataSize: 1544 },  // PoolState account size
                    {
                        memcmp: {
                            offset: 41,  // creator field offset
                            bytes: walletPubkey.toBase58(),
                        }
                    }
                ]
            }
        );

        const poolIds = accounts.map(({ pubkey }: any) => pubkey.toBase58());
        console.log(`🔍 Discovered ${poolIds.length} pools created by wallet`);
        return poolIds;
    } catch (err) {
        console.warn("⚠️ Failed to discover created pools:", err);
        return [];
    }
}

export default function LiquidityPoolsTable() {
    const [selectedPool, setSelectedPool] = useState<string | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const router = useRouter();
    const [pools, setPools] = useState<PoolData[]>([]);
    const [loading, setLoading] = useState(true);
    const { publicKey, connected } = useWallet();
    const { connection } = useConnection();

    useEffect(() => {
        const loadPools = async () => {
            setLoading(true);

            // Collect ALL pool IDs: hardcoded + any from localStorage + on-chain
            const allIds = new Set(HARDCODED_DEVNET_POOL_IDS);

            // Build a lookup map of localStorage pools for fallback metadata
            const localPoolMap = new Map<string, any>();
            try {
                const stored = localStorage.getItem("aeroCustomPools");
                if (stored) {
                    const customPools = JSON.parse(stored);
                    if (Array.isArray(customPools)) {
                        for (const p of customPools) {
                            if (p.id && p.id.length > 20) {
                                allIds.add(p.id);
                                localPoolMap.set(p.id, p);
                            }
                        }
                    }
                }
            } catch (e) { /* ignore */ }

            // Discover pools from on-chain data if wallet is connected
            if (publicKey && connected && connection) {
                try {
                    const [createdPoolIds, positionPoolIds] = await Promise.all([
                        discoverCreatedPools(connection, publicKey),
                        discoverOnChainPoolIds(connection, publicKey),
                    ]);
                    for (const id of createdPoolIds) allIds.add(id);
                    for (const id of positionPoolIds) allIds.add(id);
                } catch (err) {
                    console.warn("⚠️ On-chain pool discovery failed:", err);
                }
            }

            // Fetch ALL pool data from Raydium devnet API in one call
            const idsArray = Array.from(allIds);
            try {
                const apiUrl = `https://api-v3-devnet.raydium.io/pools/info/ids?ids=${idsArray.join(",")}`;
                const res = await fetch(apiUrl);
                const json = await res.json();

                if (json.data && Array.isArray(json.data)) {
                    // Filter out null/undefined entries (API returns null for unknown pool IDs)
                    const validPools = json.data.filter((p: any) => p != null && p.mintA && p.mintB);
                    const apiPoolIds = new Set(validPools.map((p: any) => p.id));

                    // Step 1: Collect all unique token symbols from pool data
                    const allSymbols = new Set<string>();
                    for (const pool of validPools) {
                        if (pool.mintA?.symbol) allSymbols.add(pool.mintA.symbol.toUpperCase());
                        if (pool.mintB?.symbol) allSymbols.add(pool.mintB.symbol.toUpperCase());
                    }

                    // Step 2: Fetch base prices for all known tokens (SOL, USDC, etc.)
                    const basePrices = new Map<string, number | null>();
                    await Promise.all(
                        Array.from(allSymbols).map(async (sym) => {
                            const price = await fetchBasePrice(sym);
                            basePrices.set(sym, price);
                        })
                    );

                    // Step 3: Build pool data with derived USD pricing from API
                    const livePools: PoolData[] = validPools.map((live: any) => {
                        const symA = live.mintA?.symbol || "?";
                        const symB = live.mintB?.symbol || "?";
                        const poolPrice = live.price || 1;

                        const { priceA, priceB } = deriveTokenPrices(
                            symA, symB,
                            live.mintA.address,  // ← pass mint addresses
                            live.mintB.address,
                            poolPrice,
                            basePrices
                        );

                        const poolData = apiPoolToPoolData(live, priceA, priceB);
                        const local = localPoolMap.get(live.id);
                        if (local && local.liquidity && poolData.liquidity === "$0.00") {
                            poolData.liquidity = local.liquidity;
                        }
                        return poolData;
                    });

                    // Step 4: Add fallback entries for localStorage pools the API didn't return
                    for (const [id, local] of Array.from(localPoolMap.entries())) {
                        if (!apiPoolIds.has(id)) {
                            livePools.push({
                                id,
                                name: local.name || `${local.symbolA || "?"}-${local.symbolB || "?"}`,
                                liquidity: local.liquidity || "$0.00",
                                volume: "$0.00",
                                fees: "$0.00",
                                apr: "0%",
                                fee: local.fee || "—",
                                poolId: `${id.slice(0, 6)}...${id.slice(-4)}`,
                                aprBreakdown: { tradeFees: "0%", yield: "0%" },
                                symbolA: local.symbolA,
                                symbolB: local.symbolB,
                            });
                        }
                    }

                    setPools(livePools);
                } else {
                    // API returned nothing — show localStorage pools + placeholders for hardcoded
                    const fallbackPools: PoolData[] = idsArray.map(id => {
                        const local = localPoolMap.get(id);
                        return {
                            id,
                            name: local?.name || "Unknown Pool",
                            liquidity: local?.liquidity || "$0.00",
                            volume: "—",
                            fees: "—",
                            apr: "—",
                            fee: local?.fee || "—",
                            poolId: `${id.slice(0, 6)}...${id.slice(-4)}`,
                            aprBreakdown: { tradeFees: "—", yield: "—" },
                            symbolA: local?.symbolA,
                            symbolB: local?.symbolB,
                        };
                    });
                    setPools(fallbackPools);
                }
            } catch (apiErr) {
                console.warn("⚠️ Could not fetch pool data from API:", apiErr);
                const fallbackPools: PoolData[] = idsArray.map(id => {
                    const local = localPoolMap.get(id);
                    return {
                        id,
                        name: local?.name || "Unknown Pool",
                        liquidity: local?.liquidity || "$0.00",
                        volume: "—",
                        fees: "—",
                        apr: "—",
                        fee: local?.fee || "—",
                        poolId: `${id.slice(0, 6)}...${id.slice(-4)}`,
                        aprBreakdown: { tradeFees: "—", yield: "—" },
                        symbolA: local?.symbolA,
                        symbolB: local?.symbolB,
                    };
                });
                setPools(fallbackPools);
            } finally {
                setLoading(false);
            }
        };

        loadPools();
    }, [publicKey, connected, connection]);

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(text);
        setTimeout(() => setCopiedId(null), 2000);
    };

    // Parse token symbols from pool name
    const getSymbols = (pool: PoolData) => {
        const symA = pool.symbolA || pool.name.split("-")[0] || "?";
        const symB = pool.symbolB || pool.name.split("-")[1] || "?";
        return { symA, symB };
    };

    return (
        <TooltipProvider>
            <div className="w-full bg-background/50 backdrop-blur-md rounded-2xl border border-border/50 overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-border/50 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold">Liquidity Pools</h2>
                        <p className="text-sm text-muted-foreground text-[var(--neon-teal)]">Provide liquidity, earn yield.</p>
                    </div>
                    <Button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="bg-[var(--neon-teal)] text-black hover:shadow-[0_0_15px_var(--neon-teal-glow)] transition-all"
                    >
                        <Plus className="mr-2 h-4 w-4" /> Create Pool
                    </Button>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="text-muted-foreground text-xs uppercase tracking-wider border-b border-border/50">
                                <th className="px-6 py-4 font-medium">Pool</th>
                                <th className="px-6 py-4 font-medium text-right">Liquidity</th>
                                <th className="px-6 py-4 font-medium text-right">Volume 24H</th>
                                <th className="px-6 py-4 font-medium text-right">Fees 24H</th>
                                <th className="px-6 py-4 font-medium text-right">APR 24H</th>
                                <th className="px-6 py-4 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="w-6 h-6 border-2 border-[var(--neon-teal)] border-t-transparent rounded-full animate-spin" />
                                            <span className="text-sm text-muted-foreground">Loading pools from Raydium...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : pools.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground text-sm">
                                        No pools found. Create one to get started!
                                    </td>
                                </tr>
                            ) : (
                                pools.map((pool, idx) => {
                                    const { symA, symB } = getSymbols(pool);
                                    return (
                                        <tr key={`${pool.id}-${idx}`} className="hover:bg-white/5 transition-colors group">

                                            {/* Pool Name with Overlapping Logos */}
                                            <td className="px-6 py-4 font-medium">
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <div className="flex items-center gap-3 cursor-pointer group/name">
                                                            {/* Overlapping token icons */}
                                                            <div className="flex items-center -space-x-2">
                                                                <TokenIcon logo={pool.logoA} symbol={symA} size={28} />
                                                                <TokenIcon logo={pool.logoB} symbol={symB} size={28} />
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-foreground group-hover/name:text-[var(--neon-teal)] transition-colors font-semibold text-sm">
                                                                    {pool.name}
                                                                </span>
                                                                <span className="text-[10px] text-muted-foreground">
                                                                    Concentrated · {pool.fee}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="right" className="bg-popover dark:bg-[#1C202F] border-border dark:border-border/10 p-4 w-72 shadow-xl z-[100] text-popover-foreground dark:text-white rounded-xl">
                                                        <div className="flex flex-col gap-3">
                                                            <div className="flex justify-between items-center text-[12px]">
                                                                <span className="text-muted-foreground dark:text-white/70 font-medium">Pool id:</span>
                                                                <button
                                                                    onClick={() => copyToClipboard(pool.id)}
                                                                    className="text-foreground dark:text-white hover:text-foreground/80 dark:hover:text-white/80 transition-colors flex items-center gap-1.5 font-mono text-[11px]"
                                                                >
                                                                    {pool.poolId || `${pool.id.slice(0, 8)}...${pool.id.slice(-4)}`}
                                                                    {copiedId === pool.id ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5 opacity-70" />}
                                                                </button>
                                                            </div>
                                                            <div className="h-px bg-border dark:bg-white/10" />
                                                            {/* Token A */}
                                                            <div className="flex justify-between items-center text-[12px]">
                                                                <div className="flex items-center gap-2">
                                                                    <TokenIcon logo={pool.logoA} symbol={symA} size={16} className="!border-0" />
                                                                    <span className="text-muted-foreground dark:text-white/70">{symA}</span>
                                                                </div>
                                                            </div>
                                                            {/* Token B */}
                                                            <div className="flex justify-between items-center text-[12px]">
                                                                <div className="flex items-center gap-2">
                                                                    <TokenIcon logo={pool.logoB} symbol={symB} size={16} className="!border-0" />
                                                                    <span className="text-muted-foreground dark:text-white/70">{symB}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </td>

                                            {/* Liquidity */}
                                            <td className="px-6 py-4 text-right text-foreground/90 text-sm">{pool.liquidity}</td>

                                            {/* Volume */}
                                            <td className="px-6 py-4 text-right text-foreground/90 text-sm">{pool.volume}</td>

                                            {/* Fees 24H */}
                                            <td className="px-6 py-4 text-right text-foreground/90 text-sm">{pool.fees || "$0"}</td>

                                            {/* APR */}
                                            <td className="px-6 py-4 text-right">
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <button className="text-[var(--neon-teal)] font-semibold border-b border-dotted border-[var(--neon-teal)] cursor-help outline-none text-sm">
                                                            {pool.apr}
                                                        </button>
                                                    </TooltipTrigger>
                                                    <TooltipContent
                                                        side="top"
                                                        className="z-[100] bg-popover/95 dark:bg-[#0c0d10]/95 backdrop-blur-xl border border-border/50 dark:border-white/10 p-5 w-64 shadow-xl dark:shadow-[0_0_30px_rgba(0,0,0,0.5)] rounded-xl"
                                                    >
                                                        <div className="flex flex-col gap-4">
                                                            <div className="flex justify-between items-center text-foreground dark:text-white">
                                                                <span className="text-sm font-medium text-muted-foreground dark:text-white/70">Total APR</span>
                                                                <span className="text-xl font-bold">{pool.apr}</span>
                                                            </div>
                                                            <div className="flex items-center gap-4">
                                                                <div className="relative h-12 w-12 rounded-full border-[4px] border-secondary dark:border-white/5 flex items-center justify-center">
                                                                    <div className="absolute inset-[-4px] rounded-full border-[4px] border-t-purple-500 border-r-purple-500 border-b-transparent border-l-transparent" />
                                                                </div>
                                                                <div className="flex flex-col gap-1 text-foreground dark:text-white">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="h-2 w-2 rounded-full bg-purple-500" />
                                                                        <span className="text-[11px] text-muted-foreground dark:text-white/60">Trade fees</span>
                                                                        <span className="text-[11px] font-bold">{pool.aprBreakdown.tradeFees}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="h-2 w-2 rounded-full bg-border dark:bg-white/10" />
                                                                        <span className="text-[11px] text-muted-foreground dark:text-white/40">Yield</span>
                                                                        <span className="text-[11px] font-bold text-muted-foreground dark:text-white/40">{pool.aprBreakdown.yield}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </td>

                                            {/* Actions */}
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <button
                                                                onClick={() => setSelectedPool(pool.name)}
                                                                className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-[var(--neon-teal)]"
                                                            >
                                                                <BarChart2 className="h-4 w-4" />
                                                            </button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>View pool charts</TooltipContent>
                                                    </Tooltip>

                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <button
                                                                onClick={() => {
                                                                    const [tokenA, tokenB] = pool.name.split("-");
                                                                    router.push(`/swap?from=${tokenA}&to=${tokenB}`);
                                                                }}
                                                                className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-[var(--neon-teal)]"
                                                            >
                                                                <ArrowLeftRight className="h-4 w-4" />
                                                            </button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>Swap</TooltipContent>
                                                    </Tooltip>

                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => {
                                                            const q = new URLSearchParams({
                                                                pool: pool.name,
                                                                fee: pool.fee,
                                                                poolId: pool.id,
                                                                ...(pool.mintA && { mintA: pool.mintA }),
                                                                ...(pool.mintB && { mintB: pool.mintB }),
                                                                ...(pool.decimalsA != null && { decimalsA: pool.decimalsA.toString() }),
                                                                ...(pool.decimalsB != null && { decimalsB: pool.decimalsB.toString() }),
                                                                ...(pool.logoA && { logoA: pool.logoA }),
                                                                ...(pool.logoB && { logoB: pool.logoB }),
                                                            });
                                                            router.push(`/liquidity/position?${q.toString()}`);
                                                        }}
                                                        className="border-[var(--neon-teal)]/50 text-[var(--neon-teal)] hover:bg-[var(--neon-teal)]/10"
                                                    >
                                                        Deposit
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Modals */}
                <PoolChartModal
                    isOpen={!!selectedPool}
                    onClose={() => setSelectedPool(null)}
                    poolName={selectedPool || ""}
                />
                <CreatePoolModal
                    isOpen={isCreateModalOpen}
                    onClose={() => setIsCreateModalOpen(false)}
                />
            </div>
        </TooltipProvider>
    );
}