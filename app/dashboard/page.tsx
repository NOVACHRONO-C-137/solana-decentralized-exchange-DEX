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


export default function DashboardPage() {
    const router = useRouter();
    const { publicKey, connected } = useWallet();
    const { connection } = useConnection();
    const { balances: tokenBalances, discoveredTokens, loading: balancesLoading } = useTokenBalances();

    const [prices, setPrices] = useState<Record<string, number>>({});
    const [pricesLoading, setPricesLoading] = useState(false);

    const [pools, setPools] = useState<any[]>([]);
    const [poolsLoading, setPoolsLoading] = useState(false);
    const [createdPoolIds, setCreatedPoolIds] = useState<Set<string>>(new Set());

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
        const allIds = new Set<string>();
        const createdIds = new Set<string>();

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
                parsed.forEach((p: any) => {
                    if (p.id) {
                        allIds.add(p.id);
                        createdIds.add(p.id);
                    }
                });
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
            accounts.forEach(({ pubkey }) => {
                allIds.add(pubkey.toBase58());
                createdIds.add(pubkey.toBase58());
            });
        } catch { }

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
            cpmmAccounts.forEach(({ pubkey }) => {
                allIds.add(pubkey.toBase58());
                createdIds.add(pubkey.toBase58());
            });
        } catch {
        }

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
            ammAccounts.forEach(({ pubkey }) => {
                allIds.add(pubkey.toBase58());
                createdIds.add(pubkey.toBase58());
            });
        } catch {
        }

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
        } catch {
        }

        setCreatedPoolIds(createdIds);

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
                const missingPools: any[] = [];
                for (const [id, local] of Array.from(localPoolMap.entries())) {
                    if (!apiIds.has(id)) {
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
        } catch {
        } finally {
            setPoolsLoading(false);
        }
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
                            positions={positions}
                            poolsLoading={poolsLoading}
                            createdPoolIds={createdPoolIds}
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

                        <style dangerouslySetInnerHTML={{
                            __html: `
                            .custom-scrollbar-teal::-webkit-scrollbar { width: 5px; }
                            .custom-scrollbar-teal::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); border-radius: 8px; }
                            .custom-scrollbar-teal::-webkit-scrollbar-thumb { background: rgba(20,241,149,0.35); border-radius: 8px; }
                            .custom-scrollbar-teal::-webkit-scrollbar-thumb:hover { background: rgba(20,241,149,0.7); }
                        ` }} />
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
