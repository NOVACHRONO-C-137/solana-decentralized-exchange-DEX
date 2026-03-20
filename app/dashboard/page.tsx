"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { DEVNET_PROGRAM_ID, Raydium, TxVersion } from "@raydium-io/raydium-sdk-v2";
import BN from "bn.js";
import { Wallet } from "lucide-react";
import { useTokenBalances } from "@/hooks/useTokenBalances";
import { getTokenColor } from "@/lib/tokens";
import { NetworkStatsCard } from "@/components/dashboard/NetworkStatsCard";
import { RecentTransactionsCard } from "@/components/dashboard/RecentTransactionsCard";
import { WalletCard } from "@/components/dashboard/WalletCard";
import { PortfolioCard } from "@/components/dashboard/PortfolioCard";
import { TokenHoldingsCard } from "@/components/dashboard/TokenHoldingsCard";
import { FarmRewardsCard } from "@/components/dashboard/FarmRewardsCard";
import { PoolsCard } from "@/components/dashboard/PoolsCard";
import { notify } from "@/lib/toast";

function normalizePoolType(type?: string): string {
    const t = (type || "").toLowerCase();
    if (t === "clmm" || t === "concentrated") return "Concentrated";
    if (t === "standard") return "Standard";
    if (t === "legacy") return "Legacy";
    return type || "Concentrated";
}

function normalizeStoredPool(pool: any) {
    return {
        ...pool,
        type: normalizePoolType(pool.type),
        mintA: typeof pool.mintA === "string"
            ? { address: pool.mintA, symbol: pool.symbolA || "?", logoURI: pool.logoA, decimals: pool.decimalsA || 6 }
            : pool.mintA,
        mintB: typeof pool.mintB === "string"
            ? { address: pool.mintB, symbol: pool.symbolB || "?", logoURI: pool.logoB, decimals: pool.decimalsB || 6 }
            : pool.mintB,
    };
}


export default function DashboardPage() {
    const router = useRouter();
    const { publicKey, connected } = useWallet();
    const { connection } = useConnection();
    const { balances: tokenBalances, discoveredTokens, loading: balancesLoading } = useTokenBalances();

    const [prices, setPrices] = useState<Record<string, number>>({});
    const [pricesLoading, setPricesLoading] = useState(false);

    const [pools, setPools] = useState<any[]>([]);
    const [poolsLoading, setPoolsLoading] = useState(false);
    const [positionPoolIds, setPositionPoolIds] = useState<Set<string>>(new Set());

    const [positions, setPositions] = useState<any[]>([]);
    const [claimingId, setClaimingId] = useState<string | null>(null);

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
        } catch {
        } finally {
            setPricesLoading(false);
        }
    }, [tokenBalances]);

    useEffect(() => { fetchPrices(); }, [fetchPrices]);

    const loadPools = useCallback(async () => {
        if (!publicKey || !connected) return;
        setPoolsLoading(true);
        const positionIds = new Set<string>();
        const allIds = new Set<string>();

        // Read localStorage
        let customPools: any[] = [];
        try {
            const stored = localStorage.getItem("aeroCustomPools");
            if (stored) customPools = JSON.parse(stored);
        } catch { }

        // Show localStorage pools immediately while we fetch
        if (customPools.length > 0) {
            setPools(customPools.map((p: any) => normalizeStoredPool(p)));
        }

        customPools.forEach((p: any) => { if (p.id) allIds.add(p.id); });

        // CLMM positions via SDK
        try {
            const raydium = await Raydium.load({ owner: publicKey, connection, cluster: "devnet", disableFeatureCheck: true, disableLoadToken: true });
            const userPositions = await raydium.clmm.getOwnerPositionInfo({ programId: DEVNET_PROGRAM_ID.CLMM_PROGRAM_ID });
            setPositions(userPositions);
            userPositions.forEach((pos: any) => {
                const id = pos.poolId.toString();
                positionIds.add(id);
                allIds.add(id);
            });
        } catch { }

        // ── Step 2: Standard/CPMM positions via direct pool account read ──
        // We already know pool IDs from localStorage. Read each account directly,
        // extract lpMint at offset 136 (CPMM layout), check wallet LP balance.
        try {
            const storedIds = customPools.map((p: any) => p.id).filter(Boolean);

            for (const poolId of storedIds) {
                // Skip if already found via CLMM positions
                if (positionIds.has(poolId)) continue;

                try {
                    const info = await connection.getAccountInfo(new PublicKey(poolId));
                    if (!info?.data) {
                        continue;
                    }

                    const data = Buffer.from(info.data);

                    // CPMM PoolState: lpMint @ offset 136 (32 bytes)
                    if (data.length >= 168) {
                        const lpMintBytes = data.slice(136, 168);
                        const isValid = !lpMintBytes.every((b: number) => b === 0);
                        if (!isValid) continue;

                        const lpMint = new PublicKey(lpMintBytes).toBase58();

                        // Check wallet LP token balance
                        const accounts = await connection.getParsedTokenAccountsByOwner(
                            publicKey,
                            { mint: new PublicKey(lpMint) }
                        );
                        const balance = accounts.value.reduce(
                            (sum: number, a: any) => sum + (a.account.data.parsed.info.tokenAmount.uiAmount || 0), 0
                        );
                        if (balance > 0) {
                            positionIds.add(poolId);
                            allIds.add(poolId);
                        }
                    }
                } catch (e) {
                    console.warn("[loadPools] error checking pool", poolId, e);
                }
            }

        } catch (e) {
            console.warn("[loadPools] Step2 outer error:", e);
        }

        // Fetch pool metadata for all known IDs
        if (allIds.size > 0) {
            try {
                const res = await fetch(`https://api-v3-devnet.raydium.io/pools/info/ids?ids=${Array.from(allIds).join(",")}`);
                const json = await res.json();
                const apiPools = (json.data || [])
                    .filter((p: any) => p?.mintA && p?.mintB)
                    .map((p: any) => ({ ...p, type: normalizePoolType(p.type) }));
                // apiPools loaded

                // Check LP token balance for standard/legacy pools
                for (const pool of apiPools) {
                    if ((pool.type === "Standard" || pool.type === "Legacy") && pool.lpMint?.address) {
                        // checking LP mint
                        try {
                            const accounts = await connection.getParsedTokenAccountsByOwner(publicKey, { mint: new PublicKey(pool.lpMint.address) });
                            // LP accounts
                            const hasLp = accounts.value.some((a: any) => a.account.data.parsed.info.tokenAmount.uiAmount > 0);
                            if (hasLp) {
                                positionIds.add(pool.id);
                                allIds.add(pool.id);
                            }
                        } catch { }
                    }
                }
                const mergedPools = new Map<string, any>();

                customPools
                    .map((p: any) => normalizeStoredPool(p))
                    .forEach((pool: any) => mergedPools.set(pool.id || pool.poolId, pool));

                apiPools.forEach((pool: any) => {
                    mergedPools.set(pool.id || pool.poolId, pool);
                });

                setPools(Array.from(mergedPools.values()));
            } catch { }
        }

        setPositionPoolIds(positionIds);
        // final positionPoolIds
        setPoolsLoading(false);
    }, [publicKey, connected, connection]);

    useEffect(() => { loadPools(); }, [loadPools]);

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
        } catch {
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

            await execute({ sendAndConfirm: true });
            notify.success("Transaction confirmed!");
            loadPositions();
        } catch (err) {
            notify.error((err as any)?.message || "Something failed");
        } finally {
            setClaimingId(null);
        }
    };

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
            color: getTokenColor(symbol, mint),
        };
    }).sort((a, b) => b.usd - a.usd);

    const totalUSD = tokenList.reduce((sum, t) => sum + t.usd, 0);

    const topTokens = tokenList.slice(0, 4);
    const othersUSD = tokenList.slice(4).reduce((s, t) => s + t.usd, 0);
    const segments = [
        ...topTokens.map(t => ({ symbol: t.symbol, pct: totalUSD > 0 ? (t.usd / totalUSD) * 100 : 0, color: t.color })),
        ...(othersUSD > 0 ? [{ symbol: "Other", pct: (othersUSD / totalUSD) * 100, color: "#6B7280" }] : []),
    ];

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
        const type = normalizePoolType(pool.type);
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
        const type = normalizePoolType(pool.type).toLowerCase();
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

    return (
        <div className="container mx-auto px-4 pt-28 pb-8 max-w-[1600px]">
            <div className="flex flex-col gap-6">

                {/* Main grid — left + right columns */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                    {/* ── LEFT COLUMN ─────────────────────────── */}
                    <div className="space-y-5 md:sticky md:top-28 self-start">

                        {/* Card 1 — Wallet Overview */}
                        <WalletCard publicKey={publicKey} solBalance={solBalance} prices={prices} balancesLoading={balancesLoading} />

                        {/* Card 2 — Portfolio Value */}
                        <PortfolioCard totalUSD={totalUSD} segments={segments} pricesLoading={pricesLoading} balancesLoading={balancesLoading} />

                        {/* Card 3 — Token Holdings */}
                        <TokenHoldingsCard tokenList={tokenList} balancesLoading={balancesLoading} />

                    </div>

                    {/* RIGHT COLUMN */}
                    <div className="md:col-span-2 space-y-5 min-h-[900px]">

                        {/* Card 4 — My Pools */}
                        <PoolsCard
                            pools={pools}
                            poolsLoading={poolsLoading}
                            positionPoolIds={positionPoolIds}
                            onDeposit={handleDeposit}
                            onWithdraw={handleWithdraw}
                            onRefresh={loadPools}
                        />

                        {/* Card 5 — Farm Rewards */}
                        <FarmRewardsCard
                            pools={pools}
                            positions={positions}
                            claimingId={claimingId}
                            onClaim={handleClaim}
                            onDeposit={handleDeposit}
                        />

                    </div>
                </div>

                {/* Bottom full-width row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Network Stats card */}
                    <NetworkStatsCard solPrice={prices["So11111111111111111111111111111111111111112"] || 0} />

                    {/* Recent Transactions card */}
                    <RecentTransactionsCard publicKey={publicKey} />
                </div>

            </div>
        </div>
    );
}
