//components/liquidity/LiquidityPoolsTable.tsx

"use client";

import { useState, useEffect, useRef } from "react";
import { BarChart2, ArrowLeftRight, Plus, Copy, Check, Loader2 } from "lucide-react";
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
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { DEVNET_PROGRAM_ID } from "@raydium-io/raydium-sdk-v2";
import { discoverOnChainPoolIds, discoverCreatedPools } from "@/lib/pool-discovery";
import { glassCard } from "@/lib/utils";
import TokenIcon from "@/components/liquidity/TokenIcon";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
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
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const formatCompactUSD = (valStr: string) => {
    const num = parseFloat(valStr.replace(/[$,]/g, ''));
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
    return valStr;
};

const USD_FMT = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });

const DEVNET_STABLECOIN_MINTS: Record<string, number> = {
    "2C6gE8sR3c7DTga5XKhg4uvjC8PdQxhPXe76wiyNoKCm": 1.0,
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": 1.0,
};

const HARDCODED_DEVNET_POOL_IDS = [
    "CKaQFacstJqqVkFLLH7TeYgVQeuqB9HPE6nCM9StDEAc",
    "71Yjqv83w73n92fEsvFncFjMVHFqdUGKcuhsvnbwp8SG",
    "9Rkr61gpRZakNKiaFEaAsCt1B6y5tPNZFixms7VuVMaT",
];

function isValidPubkey(str: string): boolean {
    if (str.length < 32 || str.length > 44) return false;
    try { new PublicKey(str); return true; } catch { return false; }
}

async function fetchBasePrice(symbol: string): Promise<number | null> {
    const sym = symbol.toUpperCase();
    if (sym === "USDC" || sym === "USDT" || sym === "MUSDC") return 1.0;
    if (sym === "SOL" || sym === "MSOL" || sym === "JITOSOL") {
        try {
            const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd");
            return (await res.json())?.solana?.usd ?? 150.0;
        } catch { return 150.0; }
    }
    return null;
}

function getMintPrice(mintAddress: string): number | null {
    return DEVNET_STABLECOIN_MINTS[mintAddress] ?? null;
}

function deriveTokenPrices(symA: string, symB: string, mintA: string, mintB: string, poolPrice: number, basePrices: Map<string, number | null>) {
    const mintPriceA = getMintPrice(mintA);
    const mintPriceB = getMintPrice(mintB);
    if (mintPriceA != null && mintPriceB != null) return { priceA: mintPriceA, priceB: mintPriceB };
    if (mintPriceA != null) return { priceA: mintPriceA, priceB: poolPrice > 0 ? mintPriceA / poolPrice : 0 };
    if (mintPriceB != null) return { priceA: mintPriceB * poolPrice, priceB: mintPriceB };
    const knownA = basePrices.get(symA.toUpperCase());
    const knownB = basePrices.get(symB.toUpperCase());
    if (knownA != null) return { priceA: knownA, priceB: poolPrice > 0 ? knownA / poolPrice : 0 };
    if (knownB != null) return { priceA: knownB * poolPrice, priceB: knownB };
    return { priceA: 1.0, priceB: poolPrice > 0 ? 1.0 / poolPrice : 1.0 };
}

function apiPoolToPoolData(live: any, priceA: number, priceB: number): PoolData {
    const tvl = live.tvl || 0;
    const mintAmountA = live.mintAmountA || 0;
    const mintAmountB = live.mintAmountB || 0;
    const symA = live.mintA?.symbol || "?";
    const symB = live.mintB?.symbol || "?";
    const feeRate = live.feeRate || 0;
    const feePct = feeRate < 1 ? `${(feeRate * 100).toFixed(2)}%` : `${feeRate}%`;
    let liquidity = "$0.00";
    if (tvl > 0) liquidity = USD_FMT.format(tvl);
    else if (mintAmountA > 0 || mintAmountB > 0) liquidity = USD_FMT.format((mintAmountA * priceA) + (mintAmountB * priceB));
    return {
        id: live.id,
        name: `${symA}-${symB}`,
        liquidity,
        volume: live.day?.volume > 0 ? USD_FMT.format(live.day.volume) : "$0.00",
        fees: live.day?.volumeFee > 0 ? USD_FMT.format(live.day.volumeFee) : "$0.00",
        apr: live.day?.apr > 0 ? `${live.day.apr.toFixed(2)}%` : "0%",
        fee: feePct,
        poolId: `${live.id.slice(0, 6)}...${live.id.slice(-4)}`,
        aprBreakdown: { tradeFees: live.day?.feeApr ? `${live.day.feeApr.toFixed(2)}%` : "0%", yield: "0%" },
        mintA: live.mintA?.address, mintB: live.mintB?.address,
        decimalsA: live.mintA?.decimals, decimalsB: live.mintB?.decimals,
        logoA: live.mintA?.logoURI, logoB: live.mintB?.logoURI,
        symbolA: symA, symbolB: symB, type: live.type,
    };
}

async function fetchPoolTxCount(poolId: string, connection: any): Promise<number> {
    try { return (await connection.getSignaturesForAddress(new PublicKey(poolId), { limit: 100 })).length; }
    catch { return 0; }
}

async function fetchAllTxCounts(pools: PoolData[], connection: any): Promise<number[]> {
    const results: number[] = [];
    for (let i = 0; i < pools.length; i += 3) {
        const chunk = pools.slice(i, i + 3);
        results.push(...await Promise.all(chunk.map(p => fetchPoolTxCount(p.id, connection))));
    }
    return results;
}

async function searchPoolsByMint(mint: string): Promise<PoolData[]> {
    try {
        const res = await fetch(`https://api-v3-devnet.raydium.io/pools/info/mint?mint1=${mint}&poolType=all&poolSortField=liquidity&sortType=desc&pageSize=10&page=1`);
        if (!res.ok) return [];
        const json = await res.json();
        const pools = json?.data?.data;
        if (!Array.isArray(pools)) return [];
        return pools.filter((p: any) => p?.mintA && p?.mintB).map((p: any) => {
            const symA = p.mintA?.symbol || "?";
            const symB = p.mintB?.symbol || "?";
            const feeRate = p.feeRate || 0;
            return {
                id: p.id, name: `${symA}-${symB}`,
                liquidity: p.tvl > 0 ? USD_FMT.format(p.tvl) : "$0.00",
                volume: p.day?.volume > 0 ? USD_FMT.format(p.day.volume) : "$0.00",
                fees: p.day?.volumeFee > 0 ? USD_FMT.format(p.day.volumeFee) : "$0.00",
                apr: p.day?.apr > 0 ? `${p.day.apr.toFixed(2)}%` : "0%",
                fee: feeRate < 1 ? `${(feeRate * 100).toFixed(2)}%` : `${feeRate}%`,
                poolId: `${p.id.slice(0, 6)}...${p.id.slice(-4)}`,
                aprBreakdown: { tradeFees: p.day?.feeApr ? `${p.day.feeApr.toFixed(2)}%` : "0%", yield: "0%" },
                mintA: p.mintA?.address, mintB: p.mintB?.address,
                decimalsA: p.mintA?.decimals, decimalsB: p.mintB?.decimals,
                logoA: p.mintA?.logoURI, logoB: p.mintB?.logoURI,
                symbolA: symA, symbolB: symB, type: p.type,
            };
        });
    } catch { return []; }
}

// ─────────────────────────────────────────────────────────────────────────────
// On-chain fallback: read pool account data directly to extract mintA/mintB.
// Used when the Raydium API doesn't know about the pool (e.g. newly created pools).
//
// CLMM PoolState layout (1544 bytes):
//   offset 8:  bump (1)
//   offset 9:  ammConfig (32)
//   offset 41: creator (32)
//   offset 73: mintA (32)  ← 
//   offset 105: mintB (32) ←
//
// CPMM PoolState layout (637 bytes):
//   offset 8:  configId (32)
//   offset 40: poolCreator (32)
//   offset 72: token0Vault (32)
//   offset 104: token1Vault (32)
//   offset 136: lpMint (32)
//   offset 168: token0Mint (32) ←
//   offset 200: token1Mint (32) ←
// ─────────────────────────────────────────────────────────────────────────────
async function lookupPoolOnChain(poolId: string, connection: any): Promise<PoolData | null> {
    try {
        const info = await connection.getAccountInfo(new PublicKey(poolId));
        if (!info?.data) return null;

        const data: Buffer = Buffer.from(info.data);
        let mintABytes: Buffer | null = null;
        let mintBBytes: Buffer | null = null;
        let poolType = "Concentrated";
        let feeLabel = "0.25%";

        if (data.length === 1544) {
            // CLMM
            mintABytes = data.slice(73, 105);
            mintBBytes = data.slice(105, 137);
            poolType = "Concentrated";
        } else if (data.length === 637) {
            // CPMM
            mintABytes = data.slice(168, 200);
            mintBBytes = data.slice(200, 232);
            poolType = "Standard";
        } else if (data.length === 752) {
            // Legacy AMM v4: coinMintAddress @ 400, pcMintAddress @ 432
            mintABytes = data.slice(400, 432);
            mintBBytes = data.slice(432, 464);
            poolType = "Legacy";
            feeLabel = "0.25%";
        } else {
            return null;
        }

        const mintA = new PublicKey(mintABytes).toBase58();
        const mintB = new PublicKey(mintBBytes).toBase58();

        // Try to enrich with metadata from Raydium API
        let symbolA = mintA.slice(0, 6);
        let symbolB = mintB.slice(0, 6);
        let logoA: string | undefined;
        let logoB: string | undefined;
        let decimalsA = 6;
        let decimalsB = 6;

        try {
            const mintRes = await fetch(`https://api-v3-devnet.raydium.io/mint/ids?ids=${mintA},${mintB}`);
            if (mintRes.ok) {
                const mintJson = await mintRes.json();
                const mints: any[] = mintJson?.data || [];
                for (const m of mints) {
                    if (!m) continue;
                    if (m.address === mintA) { symbolA = m.symbol || symbolA; logoA = m.logoURI; decimalsA = m.decimals ?? 6; }
                    if (m.address === mintB) { symbolB = m.symbol || symbolB; logoB = m.logoURI; decimalsB = m.decimals ?? 6; }
                }
            }
        } catch { /* use defaults */ }

        return {
            id: poolId,
            name: `${symbolA}-${symbolB}`,
            liquidity: "$0.00",
            volume: "$0.00",
            fees: "$0.00",
            apr: "0%",
            fee: feeLabel,
            poolId: `${poolId.slice(0, 6)}...${poolId.slice(-4)}`,
            aprBreakdown: { tradeFees: "0%", yield: "0%" },
            mintA, mintB, decimalsA, decimalsB,
            logoA, logoB,
            symbolA, symbolB,
            type: poolType,
        };
    } catch { return null; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
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

    // Search state
    const [mintSearchResults, setMintSearchResults] = useState<PoolData[]>([]);
    const [poolSearchResult, setPoolSearchResult] = useState<PoolData | null>(null);
    const [searchLoading, setSearchLoading] = useState(false);
    const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Load all pools ─────────────────────────────────────────────────────
    useEffect(() => {
        const loadPools = async () => {
            setLoading(true);
            const allIds = new Set(HARDCODED_DEVNET_POOL_IDS);
            const localPoolMap = new Map<string, any>();

            try {
                const stored = localStorage.getItem("aeroCustomPools");
                if (stored) {
                    const customPools = JSON.parse(stored);
                    if (Array.isArray(customPools)) {
                        for (const p of customPools) {
                            if (p.id && p.id.length > 20) { allIds.add(p.id); localPoolMap.set(p.id, p); }
                        }
                    }
                }
            } catch { }

            if (publicKey && connected && connection) {
                try {
                    const [createdPoolIds, positionPoolIds] = await Promise.all([
                        discoverCreatedPools(connection, publicKey),
                        discoverOnChainPoolIds(connection, publicKey),
                    ]);
                    for (const id of createdPoolIds) allIds.add(id);
                    for (const id of positionPoolIds) allIds.add(id);
                } catch { }
            }

            const idsArray = Array.from(allIds);
            try {
                const res = await fetch(`https://api-v3-devnet.raydium.io/pools/info/ids?ids=${idsArray.join(",")}`);
                const json = await res.json();

                if (json.data && Array.isArray(json.data)) {
                    const validPools = json.data.filter((p: any) => p != null && p.mintA && p.mintB);
                    const apiPoolIds = new Set(validPools.map((p: any) => p.id));

                    const allSymbols = new Set<string>();
                    for (const pool of validPools) {
                        if (pool.mintA?.symbol) allSymbols.add(pool.mintA.symbol.toUpperCase());
                        if (pool.mintB?.symbol) allSymbols.add(pool.mintB.symbol.toUpperCase());
                    }

                    const basePrices = new Map<string, number | null>();
                    await Promise.all(Array.from(allSymbols).map(async (sym) => {
                        basePrices.set(sym, await fetchBasePrice(sym));
                    }));

                    const livePools: PoolData[] = validPools.map((live: any) => {
                        const { priceA, priceB } = deriveTokenPrices(
                            live.mintA?.symbol || "?", live.mintB?.symbol || "?",
                            live.mintA.address, live.mintB.address, live.price || 1, basePrices
                        );
                        const poolData = apiPoolToPoolData(live, priceA, priceB);
                        const local = localPoolMap.get(live.id);
                        if (local) {
                            if (local.liquidity && poolData.liquidity === "$0.00") poolData.liquidity = local.liquidity;
                            if (local.type) poolData.type = local.type;
                        }
                        return poolData;
                    });

                    for (const [id, local] of Array.from(localPoolMap.entries())) {
                        if (!apiPoolIds.has(id)) {
                            livePools.push({
                                id, name: local.name || `${local.symbolA || "?"}-${local.symbolB || "?"}`,
                                liquidity: local.liquidity || "$0.00", volume: "$0.00", fees: "$0.00", apr: "0%",
                                fee: local.fee || "—", poolId: `${id.slice(0, 6)}...${id.slice(-4)}`,
                                aprBreakdown: { tradeFees: "0%", yield: "0%" },
                                symbolA: local.symbolA, symbolB: local.symbolB, type: local.type,
                            });
                        }
                    }

                    setPools(livePools);
                    if (connection) {
                        const txCounts = await fetchAllTxCounts(livePools, connection);
                        const countsMap = new Map<string, number>();
                        livePools.forEach((pool, idx) => countsMap.set(pool.id, txCounts[idx]));
                        setPoolTxCounts(countsMap);
                    }
                } else {
                    setPools(idsArray.map(id => {
                        const local = localPoolMap.get(id);
                        return { id, name: local?.name || "Unknown Pool", liquidity: local?.liquidity || "$0.00", volume: "—", fees: "—", apr: "—", fee: local?.fee || "—", poolId: `${id.slice(0, 6)}...${id.slice(-4)}`, aprBreakdown: { tradeFees: "—", yield: "—" }, symbolA: local?.symbolA, symbolB: local?.symbolB, type: local?.type };
                    }));
                }
            } catch {
                setPools(idsArray.map(id => {
                    const local = localPoolMap.get(id);
                    return { id, name: local?.name || "Unknown Pool", liquidity: local?.liquidity || "$0.00", volume: "—", fees: "—", apr: "—", fee: local?.fee || "—", poolId: `${id.slice(0, 6)}...${id.slice(-4)}`, aprBreakdown: { tradeFees: "—", yield: "—" }, symbolA: local?.symbolA, symbolB: local?.symbolB, type: local?.type };
                }));
            } finally {
                setLoading(false);
            }
        };
        loadPools();
    }, [publicKey, connected, connection]);

    // ── Unified search effect ──────────────────────────────────────────────
    // Single effect handles both pool-address and mint-address searches.
    // Tries API first, falls back to on-chain for pool addresses.
    useEffect(() => {
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

        const q = search.trim();
        if (!isValidPubkey(q)) {
            setPoolSearchResult(null);
            setMintSearchResults([]);
            setSearchLoading(false);
            return;
        }

        // If it's already in the table, no need to search
        if (pools.find(p => p.id === q)) {
            setPoolSearchResult(null);
            setMintSearchResults([]);
            setSearchLoading(false);
            return;
        }

        setSearchLoading(true);
        setPoolSearchResult(null);
        setMintSearchResults([]);

        searchDebounceRef.current = setTimeout(async () => {
            // Step 1: Try pool address lookup via API
            try {
                const res = await fetch(`https://api-v3-devnet.raydium.io/pools/info/ids?ids=${q}`);
                if (res.ok) {
                    const json = await res.json();
                    const live = json?.data?.[0];
                    if (live?.mintA && live?.mintB) {
                        const feeRate = live.feeRate || 0;
                        setPoolSearchResult({
                            id: live.id, name: `${live.mintA.symbol}-${live.mintB.symbol}`,
                            liquidity: live.tvl ? USD_FMT.format(live.tvl) : "$0.00",
                            volume: "$0.00", fees: "$0.00",
                            apr: live.day?.apr ? `${live.day.apr.toFixed(2)}%` : "0%",
                            fee: feeRate < 1 ? `${(feeRate * 100).toFixed(2)}%` : `${(feeRate / 100).toFixed(2)}%`,
                            poolId: `${live.id.slice(0, 6)}...${live.id.slice(-4)}`,
                            aprBreakdown: { tradeFees: "0%", yield: "0%" },
                            mintA: live.mintA.address, mintB: live.mintB.address,
                            decimalsA: live.mintA.decimals, decimalsB: live.mintB.decimals,
                            logoA: live.mintA.logoURI, logoB: live.mintB.logoURI,
                            symbolA: live.mintA.symbol, symbolB: live.mintB.symbol, type: live.type,
                        });
                        setSearchLoading(false);
                        return;
                    }
                }
            } catch { }

            // Step 2: API didn't know it — try reading the pool account on-chain.
            // This works for freshly created pools not yet indexed by Raydium.
            if (connection) {
                const onChainResult = await lookupPoolOnChain(q, connection);
                if (onChainResult) {
                    setPoolSearchResult(onChainResult);
                    setSearchLoading(false);
                    return;
                }
            }

            // Step 3: Not a pool — treat it as a mint address and search for pools containing it
            const mintResults = await searchPoolsByMint(q);
            setMintSearchResults(mintResults);
            setSearchLoading(false);
        }, 500);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search, pools]);

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(text);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const getSymbols = (pool: PoolData) => ({
        symA: pool.symbolA || pool.name.split("-")[0] || "?",
        symB: pool.symbolB || pool.name.split("-")[1] || "?",
    });

    const isMintSearch = isValidPubkey(search.trim());

    // When search is active use search results, otherwise use normal filtered list
    const filteredPools = isMintSearch
        ? mintSearchResults  // only populated if it's a mint (not a pool address)
        : pools.filter(p => {
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

    // Reusable pool row renderer
    const PoolRow = ({ pool, idx, isSearchResult = false }: { pool: PoolData; idx: number; isSearchResult?: boolean }) => {
        const { symA, symB } = getSymbols(pool);
        return (
            <tr key={`${pool.id}-${idx}`} className={`hover:bg-[#0D9B5F]/5 dark:hover:bg-white/5 transition-colors group ${myPoolIds.has(pool.id) || isSearchResult ? "border-l-2 border-l-[var(--neon-teal)]" : ""}`}>
                <td className="px-2 sm:px-6 py-3 sm:py-4 font-medium">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1.5 sm:gap-3 cursor-pointer group/name">
                                <div className="flex items-center -space-x-2">
                                    <TokenIcon logo={pool.logoA} symbol={symA} size={28} />
                                    <TokenIcon logo={pool.logoB} symbol={symB} size={28} />
                                </div>
                                <div className="flex flex-col">
                                    <div className="text-foreground group-hover/name:text-[var(--neon-teal)] transition-colors font-bold text-xs sm:text-sm">
                                        <span className="block sm:inline">{symA}</span>
                                        <span className="hidden sm:inline"> / </span>
                                        <span className="block sm:inline text-muted-foreground sm:text-foreground">{symB}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                        <span className={`text-[8px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded ${pool.type === "Standard" ? "bg-blue-500/20 text-blue-400" : pool.type === "Legacy" ? "bg-orange-500/20 text-orange-400" : "bg-violet-500/20 text-violet-400"}`}>
                                            {pool.type === "Standard" ? "Standard" : pool.type === "Legacy" ? "Legacy" : "CLMM"}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground">· {pool.fee}</span>
                                        {isSearchResult && <span className="text-[9px] text-[var(--neon-teal)]/60 font-medium">found by address</span>}
                                    </div>
                                </div>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="p-4 w-80 z-[100] bg-[rgba(220,240,232,0.72)] dark:bg-[rgba(255,255,255,0.03)] backdrop-blur-[12px] border border-black/[0.06] dark:border-[rgba(255,255,255,0.08)] shadow-[0_4px_30px_rgba(0,0,0,0.1)] text-foreground dark:text-white rounded-xl">
                            <div className="flex flex-col gap-3">
                                <div className="flex justify-between items-center text-[12px]">
                                    <span className="text-muted-foreground font-medium">Pool id:</span>
                                    <button onClick={() => copyToClipboard(pool.id)} className="flex items-center gap-1.5 font-mono text-[11px] hover:opacity-80">
                                        {pool.poolId || `${pool.id.slice(0, 8)}...${pool.id.slice(-4)}`}
                                        {copiedId === pool.id ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5 opacity-70" />}
                                    </button>
                                </div>
                                <div className="h-px bg-black/[0.06] dark:bg-white/[0.08]" />
                                {[{ sym: symA, logo: pool.logoA, mint: pool.mintA }, { sym: symB, logo: pool.logoB, mint: pool.mintB }].map(({ sym, logo, mint }) => (
                                    <div key={sym} className="flex justify-between items-center text-[12px]">
                                        <div className="flex items-center gap-2">
                                            <TokenIcon logo={logo} symbol={sym} size={16} className="!border-0" />
                                            <span className="text-muted-foreground">{sym}</span>
                                        </div>
                                        <button onClick={() => { navigator.clipboard.writeText(mint || ""); setCopiedMint(mint || null); setTimeout(() => setCopiedMint(null), 2000); }}
                                            className="flex items-center gap-1 font-mono text-[10px] hover:opacity-80">
                                            {mint ? `${mint.slice(0, 6)}...${mint.slice(-4)}` : "—"}
                                            {copiedMint === mint ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3 opacity-70" />}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </TooltipContent>
                    </Tooltip>
                </td>
                <td className="px-2 sm:px-6 py-3 sm:py-4 text-center text-foreground/90 text-xs sm:text-sm font-medium">
                    <span className="sm:hidden">{formatCompactUSD(pool.liquidity)}</span>
                    <span className="hidden sm:inline">{pool.liquidity}</span>
                </td>
                <td className="hidden md:table-cell px-6 py-4 text-right text-foreground/90 text-sm">{poolTxCounts.get(pool.id) ?? "—"} txs</td>
                <td className="hidden md:table-cell px-6 py-4 text-right text-foreground/90 text-sm">{pool.fees || "$0"}</td>
                <td className="hidden md:table-cell px-6 py-4 text-right">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button className="text-[var(--neon-teal)] font-semibold border-b border-dotted border-[var(--neon-teal)] cursor-help outline-none text-sm">{pool.apr}</button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="z-[100] p-5 w-64 rounded-xl bg-[rgba(220,240,232,0.72)] dark:bg-[rgba(255,255,255,0.03)] backdrop-blur-[12px] border border-black/[0.06] dark:border-[rgba(255,255,255,0.08)] shadow-[0_4px_30px_rgba(0,0,0,0.1)] text-foreground dark:text-white">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-medium text-muted-foreground">Total APR</span>
                                <span className="text-xl font-bold">{pool.apr}</span>
                            </div>
                        </TooltipContent>
                    </Tooltip>
                </td>
                <td className="px-2 sm:px-6 py-3 sm:py-4 text-right">
                    <div className="flex flex-col sm:flex-row justify-end items-end sm:items-center gap-2">
                        <div className="flex items-center gap-1 sm:gap-2">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button onClick={() => setSelectedPool(pool.name)} className="p-2 rounded-lg hover:bg-[#92cdd4]/10 transition-colors text-muted-foreground hover:text-[#92cdd4]"><BarChart2 className="h-4 w-4" /></button>
                                </TooltipTrigger>
                                <TooltipContent className="bg-[#92cdd4] text-black border-none font-medium">View charts</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button onClick={() => router.push(`/swap?from=${symA}&to=${symB}&fromMint=${pool.mintA}&toMint=${pool.mintB}`)}
                                        className="p-2 rounded-lg hover:bg-[#92cdd4]/10 transition-colors text-muted-foreground hover:text-[#92cdd4]"><ArrowLeftRight className="h-4 w-4" /></button>
                                </TooltipTrigger>
                                <TooltipContent className="bg-[#92cdd4] text-black border-none font-medium">Swap</TooltipContent>
                            </Tooltip>
                        </div>
                        <Button variant="outline" size="sm"
                            onClick={() => {
                                const isStandard = pool.type === "Standard";
                                const basePath = isStandard ? "/liquidity/position/standard" : "/liquidity/position/clmm";
                                const params: Record<string, string> = { pool: pool.name, fee: pool.fee, poolId: pool.id };
                                if (pool.mintA) params.mintA = pool.mintA;
                                if (pool.mintB) params.mintB = pool.mintB;
                                if (pool.decimalsA != null) params.decimalsA = String(pool.decimalsA);
                                if (pool.decimalsB != null) params.decimalsB = String(pool.decimalsB);
                                if (pool.logoA) params.logoA = pool.logoA;
                                if (pool.logoB) params.logoB = pool.logoB;
                                if (pool.symbolA) params.symbolA = pool.symbolA;
                                if (pool.symbolB) params.symbolB = pool.symbolB;
                                router.push(`${basePath}?${new URLSearchParams(params).toString()}`);
                            }}
                            className="h-8 px-4 text-xs border-[#0D9B5F]/40 dark:border-[var(--neon-teal)]/50 text-[var(--neon-teal)] hover:bg-[var(--neon-teal)]/10 font-bold">
                            Deposit
                        </Button>
                    </div>
                </td>
            </tr>
        );
    };

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

                <div className={`${glassCard} overflow-hidden`}>
                    <div className="p-4 sm:p-6 border-b border-[#0D9B5F]/15 dark:border-border/50 flex justify-between items-center">
                        <div>
                            <h2 className="text-2xl font-bold">Liquidity Pools</h2>
                            <p className="text-xs sm:text-sm text-muted-foreground text-[var(--neon-teal)]">Provide liquidity, earn yield.</p>
                        </div>
                        <Button onClick={() => setIsCreateModalOpen(true)}
                            className="h-8 px-3 text-xs sm:h-10 sm:px-4 sm:text-sm bg-[#0D9B5F] hover:bg-[#92cdd4] hover:text-black text-white dark:bg-[var(--neon-teal)] dark:text-black dark:hover:bg-[#7bb2b8] dark:hover:text-black transition-all">
                            <Plus className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" /> Create Pool
                        </Button>
                    </div>

                    <div className="px-4 sm:px-6 pb-4 pt-4 flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <input type="text" placeholder="Search by token symbol, pool address, or mint address..."
                                value={search} onChange={e => setSearch(e.target.value)}
                                className="w-full bg-secondary/40 dark:bg-black/30 border border-border rounded-xl py-2.5 pl-4 pr-10 text-sm focus:outline-none focus:border-[var(--neon-teal)] transition-colors placeholder:text-muted-foreground text-foreground" />
                            {searchLoading
                                ? <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--neon-teal)] animate-spin" />
                                : <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
                            }
                            {isMintSearch && !searchLoading && (
                                <p className="absolute -bottom-5 left-1 text-[10px] text-[var(--neon-teal)] flex items-center gap-1">
                                    <span className="w-1 h-1 rounded-full bg-[var(--neon-teal)]" />
                                    {poolSearchResult ? "Pool found by address" : mintSearchResults.length > 0 ? `${mintSearchResults.length} pool(s) containing this mint` : "Searching…"}
                                </p>
                            )}
                        </div>
                        <div className="grid grid-cols-2 sm:flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                            {(["All", "CLMM", "Standard", "Legacy"] as const).map(tab => (
                                <button key={tab} onClick={() => setTypeFilter(tab)}
                                    className={`text-xs font-semibold px-3 py-2 rounded-full transition-all ${typeFilter === tab ? "bg-[var(--neon-teal)]/15 text-foreground border border-[var(--neon-teal)]/30" : "bg-secondary/50 dark:bg-white/5 text-muted-foreground hover:text-foreground border border-transparent"}`}>
                                    {tab}
                                    {typeCounts[tab] > 0 && (
                                        <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${typeFilter === tab ? "bg-[var(--neon-teal)]/20 text-[var(--neon-teal)]" : "bg-secondary text-muted-foreground"}`}>{typeCounts[tab]}</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="text-muted-foreground text-xs uppercase tracking-wider border-b border-[#0D9B5F]/15 dark:border-border/50">
                                    <th className="px-2 sm:px-6 py-4 font-medium">Pool</th>
                                    <th className="px-2 sm:px-6 py-4 font-medium text-center cursor-pointer hover:text-foreground select-none" onClick={() => toggleSort("liquidity")}><div className="flex items-center justify-center gap-1">Liquidity <SortArrow field="liquidity" /></div></th>
                                    <th className="hidden md:table-cell px-6 py-4 font-medium text-right cursor-pointer hover:text-foreground select-none" onClick={() => toggleSort("swaps")}>Swaps <SortArrow field="swaps" /></th>
                                    <th className="hidden md:table-cell px-6 py-4 font-medium text-right cursor-pointer hover:text-foreground select-none" onClick={() => toggleSort("fees")}>Fees 24H <SortArrow field="fees" /></th>
                                    <th className="hidden md:table-cell px-6 py-4 font-medium text-right cursor-pointer hover:text-foreground select-none" onClick={() => toggleSort("apr")}>APR 24H <SortArrow field="apr" /></th>
                                    <th className="px-2 sm:px-6 py-4 font-medium text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#0D9B5F]/10 dark:divide-border/30">
                                {loading ? (
                                    <tr><td colSpan={6} className="px-6 py-12 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="w-6 h-6 border-2 border-[var(--neon-teal)] border-t-transparent rounded-full animate-spin" />
                                            <span className="text-sm text-muted-foreground">Loading pools from blockchain...</span>
                                        </div>
                                    </td></tr>
                                ) : searchLoading ? (
                                    <tr><td colSpan={6} className="px-6 py-12 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <Loader2 className="w-6 h-6 text-[var(--neon-teal)] animate-spin" />
                                            <span className="text-sm text-muted-foreground">Searching on-chain…</span>
                                        </div>
                                    </td></tr>
                                ) : poolSearchResult ? (
                                    // Pool address found — show just that row
                                    <PoolRow pool={poolSearchResult} idx={0} isSearchResult />
                                ) : sortedPools.length > 0 ? (
                                    sortedPools.map((pool, idx) => <PoolRow key={`${pool.id}-${idx}`} pool={pool} idx={idx} />)
                                ) : (
                                    <tr><td colSpan={6} className="px-6 py-12 text-center text-muted-foreground text-sm">
                                        {isMintSearch
                                            ? "No pools found containing this address on devnet."
                                            : "No pools found. Create one to get started!"}
                                    </td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <PoolChartModal isOpen={!!selectedPool} onClose={() => setSelectedPool(null)} poolName={selectedPool || ""} />
                <CreatePoolModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
            </div>
        </TooltipProvider>
    );
}