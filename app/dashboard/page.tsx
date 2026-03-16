"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { DEVNET_PROGRAM_ID, Raydium, TxVersion } from "@raydium-io/raydium-sdk-v2";
import BN from "bn.js";
import {
    Copy, Check, Info, ExternalLink, Wallet,
    RefreshCw, Loader2, Droplets, Sprout
} from "lucide-react";
import { useTokenBalances } from "@/hooks/useTokenBalances";
import { formatLargeNumber } from "@/lib/utils";

// ── Token gradient colors ────────────────────────────────
const TOKEN_COLORS: Record<string, string> = {
    SOL: "from-[#9945FF] to-[#14F195]",
    USDC: "from-[#2775CA] to-[#2775CA]",
    USDT: "from-[#26A17B] to-[#26A17B]",
    LHMN: "from-[#7C3AED] to-[#A855F7]",
    PLTR: "from-[#3B82F6] to-[#60A5FA]",
    RGR: "from-[#EF4444] to-[#F97316]",
    RAY: "from-[#6366F1] to-[#818CF8]",
};

const TOKEN_SOLID: Record<string, string> = {
    SOL: "#14F195",
    LHMN: "#A855F7",
    PLTR: "#3B82F6",
    RGR: "#F97316",
    USDC: "#2775CA",
    RAY: "#6366F1",
};

function TokenIcon({ symbol, logo, size = 32 }: { symbol: string; logo?: string; size?: number }) {
    const [err, setErr] = useState(false);
    const grad = TOKEN_COLORS[symbol] || "from-[#6B7280] to-[#9CA3AF]";

    // SOL special case — always show gradient logo
    if ((symbol === "SOL" || symbol?.startsWith("So1111")) && !logo) {
        return (
            <div className={`rounded-full bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center font-bold text-black flex-shrink-0 border border-card`}
                style={{ width: size, height: size }}>
                <svg viewBox="0 0 24 24" fill="none" style={{ width: size * 0.55, height: size * 0.55 }}>
                    <path d="M5.5 17.5L8.5 14.5H18.5L15.5 17.5H5.5Z" fill="white" stroke="white" strokeWidth="0.5" />
                    <path d="M5.5 6.5L8.5 9.5H18.5L15.5 6.5H5.5Z" fill="white" stroke="white" strokeWidth="0.5" />
                    <path d="M5.5 12L8.5 9H18.5L15.5 12H5.5Z" fill="white" stroke="white" strokeWidth="0.5" />
                </svg>
            </div>
        );
    }

    if (logo && !err) {
        return (
            <div className="rounded-full overflow-hidden border border-card flex-shrink-0"
                style={{ width: size, height: size }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logo} alt={symbol} width={size} height={size}
                    className="rounded-full object-cover w-full h-full"
                    onError={() => setErr(true)} />
            </div>
        );
    }
    return (
        <div className={`rounded-full bg-gradient-to-br ${grad} flex items-center justify-center font-bold text-black flex-shrink-0 border border-card`}
            style={{ width: size, height: size, fontSize: size * 0.38 }}>
            {symbol[0]}
        </div>
    );
}

function CopyButton({ text, className = "" }: { text: string; className?: string }) {
    const [copied, setCopied] = useState(false);
    const copy = () => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <button onClick={copy} className={`p-1 hover:bg-secondary/60 dark:hover:bg-white/10 rounded transition-all ${className}`}>
            {copied
                ? <Check className="w-3.5 h-3.5 text-[var(--neon-teal)]" />
                : <Copy className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
            }
        </button>
    );
}

// ── Pool type badge colors ───────────────────────────────
function PoolTypeBadge({ type }: { type: string }) {
    const styles: Record<string, string> = {
        Concentrated: "bg-violet-500/20 text-violet-400",
        Standard: "bg-blue-500/20 text-blue-400",
        Legacy: "bg-orange-500/20 text-orange-400",
    };
    const labels: Record<string, string> = {
        Concentrated: "CLMM",
        Standard: "Standard",
        Legacy: "Legacy",
    };
    const cls = styles[type] || "bg-secondary/50 text-muted-foreground";
    return (
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${cls}`}>
            {labels[type] || type}
        </span>
    );
}

export default function DashboardPage() {
    const router = useRouter();
    const { publicKey, connected } = useWallet();
    const { connection } = useConnection();
    const { balances: tokenBalances, discoveredTokens, loading: balancesLoading } = useTokenBalances();

    // ── Prices ───────────────────────────────────────────
    const [prices, setPrices] = useState<Record<string, number>>({});
    const [pricesLoading, setPricesLoading] = useState(false);

    // ── Pools ────────────────────────────────────────────
    const [pools, setPools] = useState<any[]>([]);
    const [poolsLoading, setPoolsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState("All");

    // ── Positions & Claims ────────────────────────────────
    const [positions, setPositions] = useState<any[]>([]);
    const [claimingId, setClaimingId] = useState<string | null>(null);

    // ── Copy wallet ──────────────────────────────────────
    const [walletCopied, setWalletCopied] = useState(false);

    const copyWallet = () => {
        if (!publicKey) return;
        navigator.clipboard.writeText(publicKey.toBase58());
        setWalletCopied(true);
        setTimeout(() => setWalletCopied(false), 2000);
    };

    // ── Fetch prices ─────────────────────────────────────
    const fetchPrices = useCallback(async () => {
        if (!tokenBalances.size) return;
        setPricesLoading(true);
        try {
            const mints = Array.from(tokenBalances.keys());
            const SOL_MINT = "So11111111111111111111111111111111111111112";
            if (!mints.includes(SOL_MINT)) mints.push(SOL_MINT);
            const res = await fetch(
                `https://api-v3-devnet.raydium.io/mint/price?mints=${mints.join(",")}`
            );
            const json = await res.json();
            if (json.data) setPrices(json.data);
        } catch (e) {
            console.warn("Price fetch failed:", e);
        } finally {
            setPricesLoading(false);
        }
    }, [tokenBalances]);

    useEffect(() => { fetchPrices(); }, [fetchPrices]);

    // ── Load pools ────────────────────────────────────────
    const loadPools = useCallback(async () => {
        if (!publicKey || !connected) return;
        setPoolsLoading(true);
        const allIds = new Set<string>();

        // Show localStorage pools immediately while we fetch
        try {
            const stored = localStorage.getItem("aeroCustomPools");
            if (stored) {
                const parsed = JSON.parse(stored);
                const normalized = parsed.map((p: any) => ({
                    ...p,
                    mintA: typeof p.mintA === "string"
                        ? { address: p.mintA, symbol: p.symbolA || "?", logoURI: p.logoA, decimals: p.decimalsA || 6 }
                        : p.mintA,
                    mintB: typeof p.mintB === "string"
                        ? { address: p.mintB, symbol: p.symbolB || "?", logoURI: p.logoB, decimals: p.decimalsB || 6 }
                        : p.mintB,
                }));
                setPools(normalized); // show immediately, API will enrich later
            }
        } catch { }

        // 1. From localStorage
        try {
            const stored = localStorage.getItem("aeroCustomPools");
            if (stored) {
                const parsed = JSON.parse(stored);
                parsed.forEach((p: any) => { if (p.id) allIds.add(p.id); });
            }
        } catch { }

        // 2. On-chain CLMM discovery
        try {
            const accounts = await connection.getProgramAccounts(
                new PublicKey(DEVNET_PROGRAM_ID.CLMM_PROGRAM_ID),
                {
                    filters: [
                        { dataSize: 1544 },
                        { memcmp: { offset: 41, bytes: publicKey.toBase58() } }
                    ]
                }
            );
            accounts.forEach(({ pubkey }) => allIds.add(pubkey.toBase58()));
        } catch { }

        // Add CPMM on-chain discovery (Standard pools are CPMM program, not CLMM)
        try {
            const cpmmAccounts = await connection.getProgramAccounts(
                new PublicKey(DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM),
                {
                    filters: [
                        { dataSize: 637 },
                        { memcmp: { offset: 40, bytes: publicKey.toBase58() } }
                    ]
                }
            );
            cpmmAccounts.forEach(({ pubkey }) => allIds.add(pubkey.toBase58()));
            console.log("[Dashboard] CPMM on-chain pools found:", cpmmAccounts.length);
        } catch (e) {
            console.warn("[Dashboard] CPMM discovery failed:", e);
        }

        // Add AMM v4 Legacy on-chain discovery
        try {
            const ammAccounts = await connection.getProgramAccounts(
                new PublicKey(DEVNET_PROGRAM_ID.AMM_V4),
                {
                    filters: [
                        { dataSize: 752 },
                        { memcmp: { offset: 400, bytes: publicKey.toBase58() } }
                    ]
                }
            );
            ammAccounts.forEach(({ pubkey }) => allIds.add(pubkey.toBase58()));
            console.log("[Dashboard] AMM v4 Legacy on-chain pools found:", ammAccounts.length);
        } catch (e) {
            console.warn("[Dashboard] AMM v4 discovery failed:", e);
        }

        // 4. On-chain Position Discovery (Find pools user deposited into)
        try {
            const raydium = await Raydium.load({
                owner: publicKey,
                connection,
                cluster: "devnet",
                disableFeatureCheck: true,
                disableLoadToken: true,
            });
            const userPositions = await raydium.clmm.getOwnerPositionInfo({
                programId: DEVNET_PROGRAM_ID.CLMM_PROGRAM_ID,
            });
            setPositions(userPositions);
            userPositions.forEach((pos: any) => {
                allIds.add(pos.poolId.toString());
            });
        } catch (e) {
            console.warn("[Dashboard] Failed to discover positions:", e);
        }

        const idsArray = Array.from(allIds);
        if (!idsArray.length) { setPoolsLoading(false); setPools([]); return; }

        // 3. Fetch metadata from API, then merge with localStorage for any missing pools
        // Build localStorage map for fallback
        const localPoolMap = new Map<string, any>();
        try {
            const stored = localStorage.getItem("aeroCustomPools");
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) {
                    for (const p of parsed) {
                        if (p.id) localPoolMap.set(p.id, p);
                    }
                }
                console.log("[Dashboard] localStorage pool map:", JSON.stringify(Array.from(localPoolMap.values()).map((p: any) => ({ id: p.id?.slice(0, 8), type: p.type }))));
            }
        } catch { }

        // Show localStorage immediately
        const immediateLocal = Array.from(localPoolMap.values()).map((p: any) => ({
            ...p,
            mintA: typeof p.mintA === "string"
                ? { address: p.mintA, symbol: p.symbolA || "?", logoURI: p.logoA, decimals: p.decimalsA || 6 }
                : p.mintA,
            mintB: typeof p.mintB === "string"
                ? { address: p.mintB, symbol: p.symbolB || "?", logoURI: p.logoB, decimals: p.decimalsB || 6 }
                : p.mintB,
        }));
        if (immediateLocal.length > 0) setPools(immediateLocal);

        try {
            const res = await fetch(
                `https://api-v3-devnet.raydium.io/pools/info/ids?ids=${idsArray.join(",")}`
            );
            const json = await res.json();

            if (json.data && Array.isArray(json.data)) {
                const apiPools = json.data.filter((p: any) => p && p.mintA && p.mintB);
                const apiIds = new Set(apiPools.map((p: any) => p.id));
                console.log("[Dashboard] API pool types:", JSON.stringify(apiPools.map((p: any) => ({ id: p.id?.slice(0, 8), type: p.type }))));

                // For pools API missed, use localStorage fallback (normalized)
                const missingPools: any[] = [];
                for (const [id, local] of Array.from(localPoolMap.entries())) {
                    if (!apiIds.has(id)) {
                        console.log("[Dashboard] Pool not in API, using localStorage:", id.slice(0, 8), "type:", local.type);
                        missingPools.push({
                            ...local,
                            mintA: typeof local.mintA === "string"
                                ? { address: local.mintA, symbol: local.symbolA || "?", logoURI: local.logoA, decimals: local.decimalsA || 6 }
                                : local.mintA,
                            mintB: typeof local.mintB === "string"
                                ? { address: local.mintB, symbol: local.symbolB || "?", logoURI: local.logoB, decimals: local.decimalsB || 6 }
                                : local.mintB,
                        });
                    }
                }

                setPools([...apiPools, ...missingPools]);
            }
        } catch (err) {
            console.warn("[Dashboard] API failed, keeping localStorage pools:", err);
        } finally {
            setPoolsLoading(false);
        }
    }, [publicKey, connected, connection]);

    useEffect(() => { loadPools(); }, [loadPools]);

    // ── Load CLMM positions for farming rewards ─────────────
    const loadPositions = useCallback(async () => {
        if (!publicKey || !connected) return;
        try {
            const raydium = await Raydium.load({
                owner: publicKey,
                connection,
                cluster: "devnet",
                disableFeatureCheck: true,
            });
            const allPositions = await raydium.clmm.getOwnerPositionInfo({
                programId: DEVNET_PROGRAM_ID.CLMM_PROGRAM_ID,
            });
            setPositions(allPositions);
        } catch (err) {
            console.warn("Failed to load positions:", err);
        }
    }, [publicKey, connected, connection]);

    useEffect(() => { loadPositions(); }, [loadPositions]);

    const handleClaim = async (poolId: string, position: any) => {
        if (!connected || !publicKey) return;
        setClaimingId(position.nftMint.toString());
        try {
            const raydium = await Raydium.load({
                owner: publicKey,
                connection,
                cluster: "devnet",
                disableFeatureCheck: true,
            });

            const { poolInfo, poolKeys } = await raydium.clmm.getPoolInfoFromRpc(poolId);

            // Our Devnet hack to prevent Error 6035 on closed reward vaults
            const poolInfoAny: any = poolInfo;
            const hackedPoolInfo = {
                ...poolInfoAny,
                rewardInfos: poolInfoAny.rewardInfos.map((r: any) => ({
                    ...r,
                    rewardState: r.rewardState === 2 ? 1 : r.rewardState
                }))
            };

            const { execute } = await raydium.clmm.decreaseLiquidity({
                poolInfo: hackedPoolInfo,
                poolKeys,
                ownerPosition: position,
                ownerInfo: {
                    useSOLBalance: true,
                    closePosition: false,
                } as any,
                liquidity: new BN(0), // 🚨 0 removes no liquidity, just harvests rewards!
                amountMinA: new BN(0),
                amountMinB: new BN(0),
                txVersion: TxVersion.LEGACY,
            });

            const result = await execute({ sendAndConfirm: true });
            console.log("✅ Rewards Claimed! Tx:", result);
            loadPositions(); // Refresh pending amounts
        } catch (err) {
            console.error("Failed to claim rewards:", err);
        } finally {
            setClaimingId(null);
        }
    };

    // ── Derived values ────────────────────────────────────
    const solBalance = tokenBalances.get("11111111111111111111111111111111")?.balance
        || tokenBalances.get("So11111111111111111111111111111111111111112")?.balance
        || 0;

    const SOL_MINTS = new Set(["11111111111111111111111111111111", "So11111111111111111111111111111111111111112"]);
    const SOL_LOGO = "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png";

    const tokenList = Array.from(tokenBalances.entries()).map(([mint, tb]) => {
        const token = discoveredTokens.find(t => t.mint === mint);
        const isSol = SOL_MINTS.has(mint);
        const symbol = isSol ? "SOL" : (token?.symbol || mint.slice(0, 8));

        // 🚨 FIX: Smart price fallback logic for Devnet
        let price = prices[mint];
        if (!price) {
            if (symbol.includes("USDC") || symbol.includes("USDT")) {
                price = 1; // Hardcode devnet stablecoins to $1
            } else if (isSol) {
                price = prices["So11111111111111111111111111111111111111112"] || 0;
            } else {
                price = 0; // Unknown devnet tokens default to $0, NOT the price of SOL
            }
        }

        const usdVal = tb.balance * price;
        return {
            mint,
            symbol,
            name: isSol ? "Solana" : (token?.name || mint.slice(0, 8)),
            logo: isSol ? SOL_LOGO : token?.logoURI,
            balance: tb.balance,
            decimals: tb.decimals,
            usd: usdVal,
            color: TOKEN_SOLID[token?.symbol || ""] || "#6B7280",
        };
    }).sort((a, b) => b.usd - a.usd);

    const totalUSD = tokenList.reduce((sum, t) => sum + t.usd, 0);

    // Portfolio ratio bar segments
    const topTokens = tokenList.slice(0, 4);
    const othersUSD = tokenList.slice(4).reduce((s, t) => s + t.usd, 0);
    const segments = [
        ...topTokens.map(t => ({ symbol: t.symbol, pct: totalUSD > 0 ? (t.usd / totalUSD) * 100 : 0, color: t.color })),
        ...(othersUSD > 0 ? [{ symbol: "Other", pct: (othersUSD / totalUSD) * 100, color: "#6B7280" }] : []),
    ];

    // Filter pools by tab
    const filteredPools = pools.filter(p => {
        if (activeTab === "All") return true;
        const t = (p.type || "").toLowerCase();
        if (activeTab === "CLMM") return t === "concentrated" || t === "clmm";
        if (activeTab === "Standard") return t === "standard";
        if (activeTab === "Legacy") return p.type === "Legacy";
        return true;
    });

    const poolTabCounts = {
        All: pools.length,
        CLMM: pools.filter(p => { const t = (p.type || "").toLowerCase(); return t === "concentrated" || t === "clmm"; }).length,
        Standard: pools.filter(p => (p.type || "").toLowerCase() === "standard").length,
        Legacy: pools.filter(p => p.type === "Legacy").length,
    };

    // ── Deposit routing ───────────────────────────────────
    const handleDeposit = (pool: any) => {
        const id = pool.id || pool.poolId;
        const mintA = pool.mintA?.address || pool.mintA;
        const mintB = pool.mintB?.address || pool.mintB;
        const symA = pool.mintA?.symbol || pool.symbolA || "?";
        const symB = pool.mintB?.symbol || pool.symbolB || "?";
        const fee = pool.feeRate
            ? (pool.feeRate < 1
                ? `${(pool.feeRate * 100).toFixed(2)}%`
                : `${(pool.feeRate / 100).toFixed(2)}%`)
            : pool.fee || "0.25%";
        const type = pool.type || "Concentrated";
        const isStandard = type === "Standard";
        const basePath = isStandard ? "/liquidity/position/standard" : "/liquidity/position/clmm";

        const q = new URLSearchParams({
            pool: symA + "-" + symB,
            fee,
            poolId: id,
            ...(mintA && { mintA }),
            ...(mintB && { mintB }),
            ...(pool.mintA?.decimals != null && { decimalsA: pool.mintA.decimals.toString() }),
            ...(pool.mintB?.decimals != null && { decimalsB: pool.mintB.decimals.toString() }),
            ...(pool.mintA?.logoURI && { logoA: pool.mintA.logoURI }),
            ...(pool.mintB?.logoURI && { logoB: pool.mintB.logoURI }),
            symbolA: symA,
            symbolB: symB,
            type,
        });
        router.push(`${basePath}?${q.toString()}`);
    };

    const handleWithdraw = (pool: any) => {
        const id = pool.id || pool.poolId;
        const mintA = pool.mintA?.address || pool.mintA;
        const mintB = pool.mintB?.address || pool.mintB;
        const symA = pool.mintA?.symbol || pool.symbolA || "?";
        const symB = pool.mintB?.symbol || pool.symbolB || "?";
        const fee = pool.feeRate
            ? (pool.feeRate < 1
                ? `${(pool.feeRate * 100).toFixed(2)}%`
                : `${(pool.feeRate / 100).toFixed(2)}%`)
            : pool.fee || "0.25%";
        const type = (pool.type || "").toLowerCase();
        const isStandard = type === "standard";
        const q = new URLSearchParams({
            poolId: id,
            mintA,
            mintB,
            symbolA: symA,
            symbolB: symB,
            fee,
            ...(pool.mintA?.logoURI && { logoA: pool.mintA.logoURI }),
            ...(pool.mintB?.logoURI && { logoB: pool.mintB.logoURI }),
        });
        router.push(`/liquidity/withdraw/${isStandard ? "standard" : "clmm"}?${q.toString()}`);
    };

    // ── Not connected state ───────────────────────────────
    if (!connected || !publicKey) {
        return (
            <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
                <div className="w-16 h-16 rounded-full bg-[var(--neon-teal)]/10 border border-[var(--neon-teal)]/20 flex items-center justify-center mb-5">
                    <Wallet className="w-8 h-8 text-[var(--neon-teal)]" />
                </div>
                <h2 className="text-xl font-bold text-foreground mb-2">Connect your wallet</h2>
                <p className="text-sm text-muted-foreground max-w-xs">
                    Connect your Phantom wallet to view your dashboard, portfolio, and pools.
                </p>
            </div>
        );
    }

    const addr = publicKey.toBase58();
    const shortAddr = `${addr.slice(0, 4)}...${addr.slice(-4)}`;

    return (
        <div className="container mx-auto px-4 py-8 max-w-7xl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* ── LEFT COLUMN ─────────────────────────── */}
                <div className="space-y-5">

                    {/* Card 1 — Wallet Overview */}
                    <div className="bg-card border border-border rounded-2xl p-5">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Wallet
                            </h3>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-[var(--neon-teal)] animate-pulse" />
                                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-500 dark:text-yellow-400">
                                    Devnet
                                </span>
                            </div>
                        </div>

                        <div className="mb-4">
                            <div className="flex items-center gap-3 mb-1">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src="https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png"
                                    alt="SOL"
                                    width={28}
                                    height={28}
                                    className="rounded-full flex-shrink-0"
                                />
                                {balancesLoading
                                    ? <div className="h-8 w-32 bg-secondary/60 rounded-lg animate-pulse" />
                                    : <span className="text-3xl font-bold text-foreground">
                                        {solBalance.toFixed(4)}
                                        <span className="text-base font-semibold text-muted-foreground ml-2">SOL</span>
                                    </span>
                                }
                            </div>
                            {prices["So11111111111111111111111111111111111111112"] > 0 && (
                                <p className="text-xs text-muted-foreground ml-10">
                                    ≈ ${(solBalance * prices["So11111111111111111111111111111111111111112"]).toFixed(2)}
                                </p>
                            )}
                        </div>

                        <div className="mb-4 pb-4 border-b border-border/50">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-xs text-muted-foreground font-mono">{shortAddr}</span>
                                <div className="flex items-center gap-1">
                                    <button onClick={copyWallet}
                                        className="p-1 hover:bg-secondary/60 dark:hover:bg-white/10 rounded transition-all">
                                        {walletCopied
                                            ? <Check className="w-3.5 h-3.5 text-[var(--neon-teal)]" />
                                            : <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                                        }
                                    </button>
                                    <a href={`https://solscan.io/account/${addr}?cluster=devnet`}
                                        target="_blank" rel="noopener noreferrer"
                                        className="text-[var(--neon-teal)] text-xs hover:underline flex items-center gap-0.5">
                                        Solscan <ExternalLink className="w-2.5 h-2.5" />
                                    </a>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-yellow-500" />
                            <span className="text-xs text-muted-foreground">Network: Devnet</span>
                        </div>
                    </div>

                    {/* Card 2 — Portfolio Value */}
                    <div className="bg-card border border-border rounded-2xl p-5">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Portfolio Value
                            </h3>
                            <div className="relative group">
                                <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                                <div className="absolute right-0 bottom-6 bg-card border border-border rounded-xl px-3 py-2 text-xs text-muted-foreground w-48 hidden group-hover:block z-10 shadow-xl">
                                    Estimated value using live Raydium devnet prices. Not real USD.
                                </div>
                            </div>
                        </div>

                        <div className="mb-5 text-center">
                            {pricesLoading || balancesLoading
                                ? <div className="h-10 w-36 bg-secondary/60 rounded-lg animate-pulse mx-auto mb-2" />
                                : <div className="text-4xl font-bold text-foreground mb-1"
                                    style={{ textShadow: "0 0 30px var(--neon-teal-glow)" }}>
                                    ${formatLargeNumber(totalUSD)}
                                </div>
                            }
                            <span className="text-xs text-muted-foreground">Estimated · Devnet prices</span>
                        </div>

                        {/* Ratio bar */}
                        {segments.length > 0 && (
                            <div className="space-y-3">
                                <div className="w-full h-2 rounded-full bg-secondary/50 overflow-hidden flex">
                                    {segments.map((s, i) => (
                                        <div key={i} style={{ width: `${s.pct}%`, background: s.color }}
                                            className="transition-all duration-500" />
                                    ))}
                                </div>
                                <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                                    {segments.map((s, i) => (
                                        <div key={i} className="flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full flex-shrink-0"
                                                style={{ background: s.color }} />
                                            <span className="text-xs text-muted-foreground">
                                                {s.symbol} {s.pct.toFixed(0)}%
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Card 3 — Token Holdings */}
                    <div className="bg-card border border-border rounded-2xl p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Token Holdings
                            </h3>
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--neon-teal)]/10 text-[var(--neon-teal)]">
                                {tokenList.length}
                            </span>
                        </div>

                        {balancesLoading ? (
                            <div className="space-y-3">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="flex items-center gap-3 animate-pulse">
                                        <div className="w-8 h-8 rounded-full bg-secondary/60" />
                                        <div className="flex-1">
                                            <div className="h-3 w-16 bg-secondary/60 rounded mb-1.5" />
                                            <div className="h-2.5 w-12 bg-secondary/40 rounded" />
                                        </div>
                                        <div className="text-right">
                                            <div className="h-3 w-14 bg-secondary/60 rounded mb-1.5" />
                                            <div className="h-2.5 w-10 bg-secondary/40 rounded" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : tokenList.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">No tokens found</p>
                        ) : (
                            <div className="space-y-3">
                                {tokenList.map((token, i) => (
                                    <div key={i} className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <TokenIcon symbol={token.symbol} logo={token.logo} size={32} />
                                            <div className="min-w-0">
                                                <div className="text-sm font-semibold text-foreground">{token.symbol}</div>
                                                <div className="text-xs text-muted-foreground truncate">{token.name}</div>
                                            </div>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <div className="text-sm font-bold text-foreground">
                                                {formatLargeNumber(token.balance)}
                                            </div>
                                            <div className="text-xs text-[var(--neon-teal)]">
                                                {token.usd > 0 ? `~$${formatLargeNumber(token.usd)}` : "—"}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="text-xs text-muted-foreground/50 mt-4 pt-4 border-t border-border/50">
                            Prices from Raydium API
                        </div>
                    </div>
                </div>

                {/* ── RIGHT COLUMN ─────────────────────────── */}
                <div className="md:col-span-2 space-y-5">

                    {/* Card 4 — My Pools */}
                    <div className="bg-card border border-border rounded-2xl p-5">
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-3">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                    My Pools
                                </h3>
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--neon-teal)]/10 text-[var(--neon-teal)]">
                                    {pools.length}
                                </span>
                            </div>
                            <button onClick={loadPools}
                                className="p-1.5 hover:bg-secondary/60 dark:hover:bg-white/10 rounded-lg transition-all text-muted-foreground hover:text-foreground">
                                {poolsLoading
                                    ? <Loader2 className="w-4 h-4 animate-spin" />
                                    : <RefreshCw className="w-4 h-4" />
                                }
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="flex gap-2 mb-5 pb-5 border-b border-border/50 flex-wrap">
                            {(["All", "CLMM", "Standard", "Legacy"] as const).map(tab => (
                                <button key={tab} onClick={() => setActiveTab(tab)}
                                    className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-all duration-200 ${activeTab === tab
                                        ? "bg-[#0D9B5F]/15 dark:bg-white/10 text-foreground"
                                        : "bg-secondary/50 dark:bg-white/5 text-muted-foreground hover:text-foreground"
                                        }`}>
                                    {tab}
                                    {poolTabCounts[tab] > 0 && (
                                        <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === tab ? "bg-[var(--neon-teal)]/20 text-[var(--neon-teal)]" : "bg-secondary text-muted-foreground"}`}>
                                            {poolTabCounts[tab]}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Pool list */}
                        {poolsLoading ? (
                            <div className="space-y-3">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="border border-border/50 rounded-xl p-4 animate-pulse">
                                        <div className="flex items-center gap-3">
                                            <div className="flex -space-x-1">
                                                <div className="w-7 h-7 rounded-full bg-secondary/60" />
                                                <div className="w-7 h-7 rounded-full bg-secondary/40" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="h-3.5 w-24 bg-secondary/60 rounded mb-2" />
                                                <div className="h-2.5 w-16 bg-secondary/40 rounded" />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : filteredPools.length === 0 ? (
                            <div className="py-10 text-center">
                                <div className="w-12 h-12 rounded-full bg-[var(--neon-teal)]/10 border border-[var(--neon-teal)]/20 flex items-center justify-center mx-auto mb-4">
                                    <Droplets className="w-6 h-6 text-[var(--neon-teal)]" />
                                </div>
                                <p className="text-sm text-muted-foreground mb-4">
                                    {activeTab === "All" ? "No pools found for this wallet." : `No ${activeTab} pools found.`}
                                </p>
                                <button onClick={() => router.push("/liquidity/create/clmm")}
                                    className="px-4 py-2 rounded-xl bg-[var(--neon-teal)]/10 text-[var(--neon-teal)] text-sm font-semibold hover:bg-[var(--neon-teal)]/20 transition-all border border-[var(--neon-teal)]/20">
                                    Create your first pool
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {filteredPools.map((pool, i) => {
                                    const mintA = pool.mintA?.address || pool.mintA || "";
                                    const mintB = pool.mintB?.address || pool.mintB || "";
                                    const symA = pool.mintA?.symbol || pool.symbolA || "?";
                                    const symB = pool.mintB?.symbol || pool.symbolB || "?";
                                    const logoA = pool.mintA?.logoURI || pool.logoA;
                                    const logoB = pool.mintB?.logoURI || pool.logoB;
                                    const poolId = pool.id || pool.poolId || "";
                                    const fee = pool.feeRate
                                        ? (pool.feeRate < 1
                                            ? `${(pool.feeRate * 100).toFixed(2)}%`
                                            : `${(pool.feeRate / 100).toFixed(2)}%`)
                                        : pool.fee || "0.25%";
                                    const type = pool.type || "Concentrated";

                                    return (
                                        <div key={i}
                                            className="border border-border/60 rounded-xl p-4 bg-secondary/10 dark:bg-white/[0.02] hover:bg-secondary/30 dark:hover:bg-white/[0.04] transition-all duration-200">
                                            <div className="flex items-center justify-between gap-4 flex-wrap">
                                                {/* Pool identity */}
                                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                                    <div className="flex -space-x-2 flex-shrink-0">
                                                        <TokenIcon symbol={symA} logo={logoA} size={28} />
                                                        <TokenIcon symbol={symB} logo={logoB} size={28} />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="text-sm font-bold text-foreground">{symA} / {symB}</div>
                                                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                            <PoolTypeBadge type={type} />
                                                            <span className="text-[var(--neon-teal)] text-xs font-semibold">{fee}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Pool ID */}
                                                <div className="flex items-center gap-1 flex-shrink-0">
                                                    <span className="text-xs text-muted-foreground font-mono">
                                                        {poolId ? `${poolId.slice(0, 6)}...${poolId.slice(-4)}` : "—"}
                                                    </span>
                                                    {poolId && <CopyButton text={poolId} />}
                                                    {poolId && (
                                                        <a href={`https://solscan.io/account/${poolId}?cluster=devnet`}
                                                            target="_blank" rel="noopener noreferrer"
                                                            className="p-1 hover:bg-secondary/60 dark:hover:bg-white/10 rounded transition-all">
                                                            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                                                        </a>
                                                    )}
                                                </div>

                                                {/* Action buttons */}
                                                <div className="flex gap-2 w-full sm:w-auto">
                                                    <button onClick={() => handleDeposit(pool)}
                                                        className="flex-1 sm:flex-none px-4 py-1.5 rounded-lg border border-[var(--neon-teal)]/50 text-[var(--neon-teal)] text-xs font-semibold hover:bg-[var(--neon-teal)]/10 transition-all duration-200">
                                                        Deposit
                                                    </button>
                                                    <button onClick={() => handleWithdraw(pool)}
                                                        className="flex-1 sm:flex-none px-4 py-1.5 rounded-lg border border-border text-muted-foreground text-xs font-semibold hover:bg-secondary/60 dark:hover:bg-white/5 hover:text-foreground transition-all duration-200">
                                                        Withdraw
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Card 5 — Farm Rewards */}
                    <div className="bg-card border border-border rounded-2xl p-5">
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-3">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                    Farm Rewards
                                </h3>
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-500/20 text-green-500 dark:text-green-400">
                                    Devnet
                                </span>
                            </div>
                            <Sprout className="w-4 h-4 text-muted-foreground" />
                        </div>

                        {/* Show farms from pools that have reward data */}
                        {pools.filter(p => p.rewardDefaultInfos?.length > 0).length === 0 ? (
                            <div className="py-8 text-center">
                                <div className="w-12 h-12 rounded-full bg-[var(--neon-teal)]/10 border border-[var(--neon-teal)]/20 flex items-center justify-center mx-auto mb-4">
                                    <Sprout className="w-6 h-6 text-[var(--neon-teal)]" />
                                </div>
                                <p className="text-sm text-muted-foreground mb-4">No active farms found.</p>
                                <button onClick={() => router.push("/liquidity/create-farm")}
                                    className="px-4 py-2 rounded-xl bg-[var(--neon-teal)]/10 text-[var(--neon-teal)] text-sm font-semibold hover:bg-[var(--neon-teal)]/20 transition-all border border-[var(--neon-teal)]/20">
                                    Create a Farm
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {pools.filter(p => p.rewardDefaultInfos?.length > 0).map((pool, i) => {
                                    const symA = pool.mintA?.symbol || pool.symbolA || "?";
                                    const symB = pool.mintB?.symbol || pool.symbolB || "?";
                                    const poolIdStr = pool.id || pool.poolId;
                                    const userPosition = positions.find(pos => pos.poolId.toString() === poolIdStr);

                                    return pool.rewardDefaultInfos.map((reward: any, j: number) => {
                                        const sym = reward.mint?.symbol || "?";
                                        const logo = reward.mint?.logoURI;
                                        const decimals = reward.mint?.decimals || 6;
                                        const perSec = parseFloat(reward.perSecond || "0");
                                        const perDay = (perSec / Math.pow(10, decimals)) * 86400;

                                        // Get actual pending rewards if the user has an active position in this farm
                                        const pendingBN = userPosition?.rewardInfos[j]?.pendingReward || new BN(0);
                                        const pendingHuman = pendingBN.toNumber() / Math.pow(10, decimals);
                                        const hasPending = pendingHuman > 0;
                                        const isClaiming = claimingId === userPosition?.nftMint?.toString();

                                        return (
                                            <div key={`${i}-${j}`} className="flex items-center justify-between gap-4 border border-border/40 bg-secondary/10 rounded-xl p-3">
                                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                                    <TokenIcon symbol={sym} logo={logo} size={32} />
                                                    <div className="min-w-0">
                                                        <div className="text-sm font-semibold text-foreground">
                                                            {sym} Rewards
                                                        </div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {symA}-{symB} Farm
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3 flex-shrink-0">
                                                    <div className="text-right">
                                                        {userPosition ? (
                                                            <>
                                                                <div className="text-sm font-bold text-[var(--neon-teal)]">
                                                                    {formatLargeNumber(pendingHuman)} {sym}
                                                                </div>
                                                                <div className="text-[10px] text-muted-foreground">
                                                                    Unclaimed
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <div className="text-sm font-bold text-foreground">
                                                                    ~{formatLargeNumber(perDay)}
                                                                </div>
                                                                <div className="text-[10px] text-muted-foreground">
                                                                    {sym}/day rate
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                    {userPosition ? (
                                                        <button
                                                            onClick={() => handleClaim(poolIdStr, userPosition)}
                                                            disabled={!hasPending || isClaiming}
                                                            className={`w-20 py-1.5 rounded-lg text-xs font-semibold transition-all border ${hasPending && !isClaiming
                                                                ? "bg-[var(--neon-teal)]/15 text-[var(--neon-teal)] border-[var(--neon-teal)]/20 hover:bg-[var(--neon-teal)]/25"
                                                                : "bg-secondary/30 text-muted-foreground border-transparent cursor-not-allowed"
                                                                }`}
                                                        >
                                                            {isClaiming ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" /> : "Claim"}
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleDeposit(pool)}
                                                            className="w-20 py-1.5 rounded-lg bg-secondary/40 text-muted-foreground text-xs font-semibold hover:bg-secondary/60 transition-all border border-border/50"
                                                        >
                                                            Deposit
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    });
                                })}
                            </div>
                        )}

                        <div className="text-xs text-muted-foreground/50 mt-4 pt-4 border-t border-border/50">
                            Rewards accrue per block · Devnet only
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}