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

// Compact USD formatter for mobile
const formatCompactUSD = (valStr: string) => {
    const num = parseFloat(valStr.replace(/[$,]/g, ''));
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
    return valStr;
};

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
    type?: string;
    symbolA?: string;
    symbolB?: string;
    colorA?: string;
    colorB?: string;
}

import TokenIcon from "@/components/liquidity/TokenIcon";

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
    "CKaQFacstJqqVkFLLH7TeYgVQeuqB9HPE6nCM9StDEAc",
    "71Yjqv83w73n92fEsvFncFjMVHFqdUGKcuhsvnbwp8SG",
    "9Rkr61gpRZakNKiaFEaAsCt1B6y5tPNZFixms7VuVMaT",
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
        type: live.type, // Inject type
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
        const CPMM_PROGRAM = DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM;

        // PoolState accounts are 1544 bytes. The owner/creator is at offset 73.
        // Layout: discriminator(8) + bump(1) + ammConfig(32) + creator(32) + ...
        // So creator starts at offset 41
        const clmmPromise = connection.getProgramAccounts(
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

        // CPMM pool size is 637 bytes. poolCreator is at offset 40.
        const cpmmPromise = connection.getProgramAccounts(
            new PublicKey(CPMM_PROGRAM),
            {
                filters: [
                    { dataSize: 637 },  // Cpmm Pool info size
                    {
                        memcmp: {
                            offset: 40,  // poolCreator field offset
                            bytes: walletPubkey.toBase58(),
                        }
                    }
                ]
            }
        );

        const [clmmAccounts, cpmmAccounts] = await Promise.all([
            clmmPromise.catch(() => []),
            cpmmPromise.catch(() => [])
        ]);

        const poolIds = [
            ...clmmAccounts.map(({ pubkey }: any) => pubkey.toBase58()),
            ...cpmmAccounts.map(({ pubkey }: any) => pubkey.toBase58())
        ];

        console.log(`🔍 Discovered ${poolIds.length} pools created by wallet`);
        return poolIds;
    } catch (err) {
        console.warn("⚠️ Failed to discover created pools:", err);
        return [];
    }
}

// ── Fetch transaction count for a pool ───────────────────────
async function fetchPoolTxCount(poolId: string, connection: any): Promise<number> {
    try {
        const signatures = await connection.getSignaturesForAddress(new PublicKey(poolId), { limit: 100 });
        return signatures.length;
    } catch {
        return 0;
    }
}

export default function LiquidityPoolsTable() {
    const [selectedPool, setSelectedPool] = useState<string | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [copiedMint, setCopiedMint] = useState<string | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const router = useRouter();
    const [pools, setPools] = useState<PoolData[]>([]);
    const [poolTxCounts, setPoolTxCounts] = useState<Map<string, number>>(new Map());
    const [loading, setLoading] = useState(true);
    const { publicKey, connected } = useWallet();
    const { connection } = useConnection();
    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState<"All" | "CLMM" | "Standard" | "Legacy">("All");
    const [sortField, setSortField] = useState<"liquidity" | "swaps" | "fees" | "apr" | null>(null);
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

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
                        if (local) {
                            if (local.liquidity && poolData.liquidity === "$0.00") {
                                poolData.liquidity = local.liquidity;
                            }
                            if (local.type) {
                                poolData.type = local.type;
                            }
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
                                type: local.type,
                            });
                        }
                    }

                    setPools(livePools);

                    // Fetch transaction counts for each pool
                    if (connection) {
                        const txCounts = await Promise.all(
                            livePools.map(pool => fetchPoolTxCount(pool.id, connection))
                        );
                        const countsMap = new Map<string, number>();
                        livePools.forEach((pool, idx) => {
                            countsMap.set(pool.id, txCounts[idx]);
                        });
                        setPoolTxCounts(countsMap);
                    }
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
                            type: local?.type,
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
                        type: local?.type,
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

    const filteredPools = pools.filter(p => {
        const sym = `${p.symbolA || ""}${p.symbolB || ""}${p.name || ""}`.toLowerCase();
        const matchSearch = !search.trim() || sym.includes(search.toLowerCase()) || (p.id || "").toLowerCase().includes(search.toLowerCase());
        const matchType = typeFilter === "All" ||
            (typeFilter === "CLMM" && (p.type === "Concentrated" || p.type === "CLMM")) ||
            (typeFilter === "Standard" && p.type === "Standard") ||
            (typeFilter === "Legacy" && p.type === "Legacy");
        return matchSearch && matchType;
    });

    const parseUSD = (s: string) => parseFloat(s?.replace(/[$,]/g, "") || "0");
    const sortedPools = [...filteredPools].sort((a, b) => {
        if (!sortField) return 0;
        let va = 0, vb = 0;
        if (sortField === "liquidity") { va = parseUSD(a.liquidity); vb = parseUSD(b.liquidity); }
        if (sortField === "swaps") { va = poolTxCounts.get(a.id) || 0; vb = poolTxCounts.get(b.id) || 0; }
        if (sortField === "fees") { va = parseUSD(a.fees); vb = parseUSD(b.fees); }
        if (sortField === "apr") { va = parseFloat(a.apr); vb = parseFloat(b.apr); }
        return sortDir === "desc" ? vb - va : va - vb;
    });

    const toggleSort = (field: typeof sortField) => {
        if (sortField === field) setSortDir(d => d === "desc" ? "asc" : "desc");
        else { setSortField(field); setSortDir("desc"); }
    };

    const totalTVL = pools.reduce((s, p) => s + parseUSD(p.liquidity), 0);
    const totalTxs = Array.from(poolTxCounts.values()).reduce((s, v) => s + v, 0);

    const typeCounts = {
        All: pools.length,
        CLMM: pools.filter(p => p.type === "Concentrated" || p.type === "CLMM").length,
        Standard: pools.filter(p => p.type === "Standard").length,
        Legacy: pools.filter(p => p.type === "Legacy").length,
    };

    const myPoolIds = new Set<string>();
    try {
        const stored = localStorage.getItem("aeroCustomPools");
        if (stored) JSON.parse(stored).forEach((p: any) => p.id && myPoolIds.add(p.id));
    } catch { }

    const SortArrow = ({ field }: { field: typeof sortField }) => (
        <span className="ml-1 inline-flex flex-col text-[8px] leading-none opacity-50">
            <span className={sortField === field && sortDir === "asc" ? "text-[var(--neon-teal)] opacity-100" : ""}>▲</span>
            <span className={sortField === field && sortDir === "desc" ? "text-[var(--neon-teal)] opacity-100" : ""}>▼</span>
        </span>
    );

    return (
        <TooltipProvider>
            <div className="w-full px-2">
                {/* Stats Bar */}
                <div className="grid grid-cols-3 gap-4 mb-4">
                    {[
                        { label: "Total TVL", value: `$${totalTVL >= 1e6 ? (totalTVL / 1e6).toFixed(2) + "M" : totalTVL >= 1e3 ? (totalTVL / 1e3).toFixed(1) + "K" : totalTVL.toFixed(2)}`, color: "text-[var(--neon-teal)]" },
                        { label: "Total Pools", value: pools.length.toString(), color: "text-blue-400" },
                        { label: "Total Swaps", value: totalTxs.toString(), color: "text-violet-400" },
                    ].map((s, i) => (
                        <div key={i} className="bg-[rgba(220,240,232,0.38)] dark:bg-[rgba(255,255,255,0.03)] backdrop-blur-[6px] border border-black/[0.06] dark:border-[rgba(255,255,255,0.08)] rounded-2xl p-4 text-center">
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{s.label}</div>
                            <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
                        </div>
                    ))}
                </div>

                {/* Main Table Card */}
                <div className="bg-[rgba(220,240,232,0.45)] dark:bg-[rgba(255,255,255,0.03)] backdrop-blur-[6px] border border-black/[0.06] dark:border-[rgba(255,255,255,0.08)] shadow-[0_2px_16px_0_rgba(0,0,0,0.06)] dark:shadow-[0_2px_12px_0_rgba(0,0,0,0.12)] rounded-2xl overflow-hidden">
                    {/* Header */}
                    <div className="p-4 sm:p-6 border-b border-[#0D9B5F]/15 dark:border-border/50 flex justify-between items-center">
                        <div>
                            <h2 className="text-2xl font-bold">Liquidity Pools</h2>
                            <p className="text-xs sm:text-sm text-muted-foreground text-[var(--neon-teal)]">Provide liquidity, earn yield.</p>
                        </div>
                        <Button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="h-8 px-3 text-xs sm:h-10 sm:px-4 sm:text-sm bg-[#0D9B5F] hover:bg-[#92cdd4] hover:text-black text-white dark:bg-[var(--neon-teal)] dark:text-black dark:hover:bg-[#7bb2b8] dark:hover:text-black transition-all duration-200 hover:shadow-[0_4px_15px_rgba(146,205,212,0.4)] dark:hover:shadow-[0_4px_15px_rgba(123,178,184,0.4)]"
                        >
                            <Plus className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" /> Create Pool
                        </Button>
                    </div>

                    {/* Search + Filter Bar */}
                    <div className="px-4 sm:px-6 pb-4 pt-4 flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <input
                                type="text"
                                placeholder="Search by token or pool address..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full bg-secondary/40 dark:bg-black/30 border border-border rounded-xl py-2.5 pl-4 pr-10 text-sm focus:outline-none focus:border-[var(--neon-teal)] transition-colors placeholder:text-muted-foreground text-foreground"
                            />
                            <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                            </svg>
                        </div>
                        <div className="grid grid-cols-2 sm:flex gap-2 w-full sm:w-auto">
                            {(["All", "CLMM", "Standard", "Legacy"] as const).map(tab => (
                                <button key={tab} onClick={() => setTypeFilter(tab)}
                                    className={`text-xs font-semibold px-3 py-2 rounded-full transition-all ${typeFilter === tab
                                        ? "bg-[var(--neon-teal)]/15 text-foreground border border-[var(--neon-teal)]/30"
                                        : "bg-secondary/50 dark:bg-white/5 text-muted-foreground hover:text-foreground border border-transparent"}`}>
                                    {tab}
                                    {typeCounts[tab] > 0 && (
                                        <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${typeFilter === tab ? "bg-[var(--neon-teal)]/20 text-[var(--neon-teal)]" : "bg-secondary text-muted-foreground"}`}>
                                            {typeCounts[tab]}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="text-muted-foreground text-xs uppercase tracking-wider border-b border-[#0D9B5F]/15 dark:border-border/50">
                                    <th className="px-2 sm:px-6 py-4 font-medium">Pool</th>
                                    <th className="px-2 sm:px-6 py-4 font-medium text-center cursor-pointer hover:text-foreground select-none" onClick={() => toggleSort("liquidity")}>
                                        <div className="flex items-center justify-center gap-1">
                                            Liquidity <SortArrow field="liquidity" />
                                        </div>
                                    </th>
                                    <th className="hidden md:table-cell px-6 py-4 font-medium text-right cursor-pointer hover:text-foreground select-none" onClick={() => toggleSort("swaps")}>
                                        Swaps <SortArrow field="swaps" />
                                    </th>
                                    <th className="hidden md:table-cell px-6 py-4 font-medium text-right cursor-pointer hover:text-foreground select-none" onClick={() => toggleSort("fees")}>
                                        Fees 24H <SortArrow field="fees" />
                                    </th>
                                    <th className="hidden md:table-cell px-6 py-4 font-medium text-right cursor-pointer hover:text-foreground select-none" onClick={() => toggleSort("apr")}>
                                        APR 24H <SortArrow field="apr" />
                                    </th>
                                    <th className="px-2 sm:px-6 py-4 font-medium text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#0D9B5F]/10 dark:divide-border/30">
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center">
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="w-6 h-6 border-2 border-[var(--neon-teal)] border-t-transparent rounded-full animate-spin" />
                                                <span className="text-sm text-muted-foreground">Loading pools from blockchain...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : sortedPools.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground text-sm">
                                            No pools found. Create one to get started!
                                        </td>
                                    </tr>
                                ) : (
                                    sortedPools.map((pool, idx) => {
                                        const { symA, symB } = getSymbols(pool);
                                        return (
                                            <tr key={`${pool.id}-${idx}`} className={`hover:bg-[#0D9B5F]/5 dark:hover:bg-secondary/60 dark:hover:bg-white/5 transition-colors group ${myPoolIds.has(pool.id) ? "border-l-2 border-l-[var(--neon-teal)]" : ""}`}>

                                                {/* Pool Name with Overlapping Logos */}
                                                <td className="px-2 sm:px-6 py-3 sm:py-4 font-medium">
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1.5 sm:gap-3 cursor-pointer group/name">
                                                                {/* Overlapping token icons */}
                                                                <div className="flex items-center -space-x-2">
                                                                    <TokenIcon logo={pool.logoA} symbol={symA} size={28} />
                                                                    <TokenIcon logo={pool.logoB} symbol={symB} size={28} />
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <div className="text-foreground group-hover/name:text-[var(--neon-teal)] transition-colors font-bold text-xs sm:text-sm leading-tight sm:leading-normal mb-1 sm:mb-0">
                                                                        <span className="block sm:inline">{symA}</span>
                                                                        <span className="hidden sm:inline"> / </span>
                                                                        <span className="block sm:inline text-muted-foreground sm:text-foreground">{symB}</span>
                                                                    </div>
                                                                    <span className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                                                                        <span className={`text-[8px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded ${pool.type === "Standard" ? "bg-blue-500/20 text-blue-400" :
                                                                            pool.type === "Legacy" ? "bg-orange-500/20 text-orange-400" :
                                                                                "bg-violet-500/20 text-violet-400"
                                                                            }`}>
                                                                            {pool.type === "Standard" ? "Standard" : pool.type === "Legacy" ? "Legacy" : "CLMM"}
                                                                        </span>
                                                                        · {pool.fee}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="right" className="p-4 w-80 z-[100] bg-[rgba(220,240,232,0.72)] dark:bg-[rgba(255,255,255,0.03)] backdrop-blur-[12px] border border-black/[0.06] dark:border-[rgba(255,255,255,0.08)] shadow-[0_4px_30px_rgba(0,0,0,0.1)] text-foreground dark:text-white rounded-xl">
                                                            <div className="flex flex-col gap-3">
                                                                <div className="flex justify-between items-center text-[12px]">
                                                                    <span className="text-muted-foreground dark:text-foreground/70 font-medium">Pool id:</span>
                                                                    <button
                                                                        onClick={() => copyToClipboard(pool.id)}
                                                                        className="text-foreground dark:text-white hover:text-foreground/80 dark:hover:text-foreground/80 transition-colors flex items-center gap-1.5 font-mono text-[11px]"
                                                                    >
                                                                        {pool.poolId || `${pool.id.slice(0, 8)}...${pool.id.slice(-4)}`}
                                                                        {copiedId === pool.id ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5 opacity-70" />}
                                                                    </button>
                                                                </div>
                                                                <div className="h-px bg-black/[0.06] dark:bg-[rgba(255,255,255,0.08)]" />
                                                                {/* Token A */}
                                                                <div className="flex justify-between items-center text-[12px]">
                                                                    <div className="flex items-center gap-2">
                                                                        <TokenIcon logo={pool.logoA} symbol={symA} size={16} className="!border-0" />
                                                                        <span className="text-muted-foreground dark:text-foreground/70">{symA}</span>
                                                                    </div>
                                                                    <button
                                                                        onClick={() => { navigator.clipboard.writeText(pool.mintA || ""); setCopiedMint(pool.mintA || null); setTimeout(() => setCopiedMint(null), 2000); }}
                                                                        className="text-foreground dark:text-white hover:text-foreground/80 dark:hover:text-foreground/80 transition-colors flex items-center gap-1 font-mono text-[10px]"
                                                                    >
                                                                        {pool.mintA ? `${pool.mintA.slice(0, 6)}...${pool.mintA.slice(-4)}` : "—"}
                                                                        {copiedMint === pool.mintA ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3 opacity-70" />}
                                                                    </button>
                                                                </div>
                                                                {/* Token B */}
                                                                <div className="flex justify-between items-center text-[12px]">
                                                                    <div className="flex items-center gap-2">
                                                                        <TokenIcon logo={pool.logoB} symbol={symB} size={16} className="!border-0" />
                                                                        <span className="text-muted-foreground dark:text-foreground/70">{symB}</span>
                                                                    </div>
                                                                    <button
                                                                        onClick={() => { navigator.clipboard.writeText(pool.mintB || ""); setCopiedMint(pool.mintB || null); setTimeout(() => setCopiedMint(null), 2000); }}
                                                                        className="text-foreground dark:text-white hover:text-foreground/80 dark:hover:text-foreground/80 transition-colors flex items-center gap-1 font-mono text-[10px]"
                                                                    >
                                                                        {pool.mintB ? `${pool.mintB.slice(0, 6)}...${pool.mintB.slice(-4)}` : "—"}
                                                                        {copiedMint === pool.mintB ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3 opacity-70" />}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </td>

                                                {/* Liquidity */}
                                                <td className="px-2 sm:px-6 py-3 sm:py-4 text-center text-foreground/90 text-xs sm:text-sm font-medium">
                                                    <span className="sm:hidden">{formatCompactUSD(pool.liquidity)}</span>
                                                    <span className="hidden sm:inline">{pool.liquidity}</span>
                                                </td>

                                                {/* Swaps */}
                                                <td className="hidden md:table-cell px-6 py-4 text-right text-foreground/90 text-sm">{poolTxCounts.get(pool.id) ?? "—"} txs</td>

                                                {/* Fees 24H */}
                                                <td className="hidden md:table-cell px-6 py-4 text-right text-foreground/90 text-sm">{pool.fees || "$0"}</td>

                                                {/* APR */}
                                                <td className="hidden md:table-cell px-6 py-4 text-right">
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <button className="text-[var(--neon-teal)] font-semibold border-b border-dotted border-[var(--neon-teal)] cursor-help outline-none text-sm">
                                                                {pool.apr}
                                                            </button>
                                                        </TooltipTrigger>
                                                        <TooltipContent
                                                            side="top"
                                                            className="z-[100] p-5 w-64 rounded-xl bg-[rgba(220,240,232,0.72)] dark:bg-[rgba(255,255,255,0.03)] backdrop-blur-[12px] border border-black/[0.06] dark:border-[rgba(255,255,255,0.08)] shadow-[0_4px_30px_rgba(0,0,0,0.1)] text-foreground dark:text-white"
                                                        >
                                                            <div className="flex flex-col gap-4">
                                                                <div className="flex justify-between items-center text-foreground dark:text-white">
                                                                    <span className="text-sm font-medium text-muted-foreground dark:text-foreground/70">Total APR</span>
                                                                    <span className="text-xl font-bold">{pool.apr}</span>
                                                                </div>
                                                                <div className="flex items-center gap-4">
                                                                    <div className="relative h-12 w-12 rounded-full border-[4px] border-secondary dark:border-border/50 flex items-center justify-center">
                                                                        <div className="absolute inset-[-4px] rounded-full border-[4px] border-t-[#1E7FBF] border-r-[#1E7FBF] border-b-transparent border-l-transparent" />
                                                                    </div>
                                                                    <div className="flex flex-col gap-1 text-foreground dark:text-white">
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="h-2 w-2 rounded-full bg-[#1E7FBF]" />
                                                                            <span className="text-[11px] text-muted-foreground dark:text-muted-foreground">Trade fees</span>
                                                                            <span className="text-[11px] font-bold">{pool.aprBreakdown.tradeFees}</span>
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="h-2 w-2 rounded-full bg-border dark:bg-white/10" />
                                                                            <span className="text-[11px] text-muted-foreground dark:text-muted-foreground">Yield</span>
                                                                            <span className="text-[11px] font-bold text-muted-foreground dark:text-muted-foreground">{pool.aprBreakdown.yield}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </td>

                                                {/* Actions */}
                                                <td className="px-2 sm:px-6 py-3 sm:py-4 text-right">
                                                    <div className="flex flex-col sm:flex-row justify-end items-end sm:items-center gap-2">
                                                        {/* Row of Utility Icons */}
                                                        <div className="flex items-center gap-1 sm:gap-2">
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <button onClick={() => setSelectedPool(pool.name)} className="p-2 rounded-lg hover:bg-[#92cdd4]/10 dark:hover:bg-[#7bb2b8]/10 transition-colors text-muted-foreground hover:text-[#92cdd4] dark:hover:text-[#7bb2b8]">
                                                                        <BarChart2 className="h-4 w-4" />
                                                                    </button>
                                                                </TooltipTrigger>
                                                                <TooltipContent className="bg-[#92cdd4] dark:bg-[#7bb2b8] text-black border-none font-medium">View charts</TooltipContent>
                                                            </Tooltip>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <button onClick={() => {
                                                                        const [tokenA, tokenB] = pool.name.split("-");
                                                                        router.push(`/swap?from=${tokenA}&to=${tokenB}&fromMint=${pool.mintA}&toMint=${pool.mintB}`);
                                                                    }} className="p-2 rounded-lg hover:bg-[#92cdd4]/10 dark:hover:bg-[#7bb2b8]/10 transition-colors text-muted-foreground hover:text-[#92cdd4] dark:hover:text-[#7bb2b8]">
                                                                        <ArrowLeftRight className="h-4 w-4" />
                                                                    </button>
                                                                </TooltipTrigger>
                                                                <TooltipContent className="bg-[#92cdd4] dark:bg-[#7bb2b8] text-black border-none font-medium">Swap</TooltipContent>
                                                            </Tooltip>
                                                        </div>

                                                        {/* Primary Action Button */}
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => {
                                                                const isStandard = pool.type === "Standard";
                                                                const basePath = isStandard ? "/liquidity/position/standard" : "/liquidity/position/clmm";

                                                                const params: Record<string, string> = {
                                                                    pool: pool.name,
                                                                    fee: pool.fee,
                                                                    poolId: pool.id,
                                                                };

                                                                if (pool.mintA) params.mintA = pool.mintA;
                                                                if (pool.mintB) params.mintB = pool.mintB;
                                                                if (pool.decimalsA != null) params.decimalsA = pool.decimalsA.toString();
                                                                if (pool.decimalsB != null) params.decimalsB = pool.decimalsB.toString();
                                                                if (pool.logoA) params.logoA = pool.logoA;
                                                                if (pool.logoB) params.logoB = pool.logoB;

                                                                const q = new URLSearchParams(params);
                                                                router.push(`${basePath}?${q.toString()}`);
                                                            }}
                                                            className="h-8 px-4 text-xs border-[#0D9B5F]/40 dark:border-[var(--neon-teal)]/50 text-[var(--neon-teal)] hover:bg-[var(--neon-teal)]/10 font-bold"
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
