"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { Raydium, TxVersion, Percent, DEVNET_PROGRAM_ID } from "@raydium-io/raydium-sdk-v2";
import BN from "bn.js";
import Decimal from "decimal.js";
import { ChevronLeft, Loader2, CheckCircle2, AlertCircle, Minus, Plus } from "lucide-react";
import { glassCard } from "@/lib/utils";
import { useTokenBalances } from "@/hooks/useTokenBalances";
import { formatLargeNumber } from "@/lib/utils";
import TokenIcon from "@/components/liquidity/TokenIcon";
import { notify } from "@/lib/toast";
import { parseError } from "@/lib/error-utils";

export default function WithdrawStandardPage() {
    const router = useRouter();
    const params = useSearchParams();
    const { publicKey, sendTransaction, connected } = useWallet();
    const { connection } = useConnection();
    const { balances: tokenBalances } = useTokenBalances();

    // ── URL params ────────────────────────────────────────
    const poolId = params.get("poolId") || "";
    const mintA = params.get("mintA") || "";
    const mintB = params.get("mintB") || "";
    const symbolA = params.get("symbolA") || "Token A";
    const symbolB = params.get("symbolB") || "Token B";
    const logoA = params.get("logoA") || undefined;
    const logoB = params.get("logoB") || undefined;
    const fee = params.get("fee") || "0.25%";

    // ── State ─────────────────────────────────────────────
    const [poolInfo, setPoolInfo] = useState<any>(null);
    const [rpcData, setRpcData] = useState<any>(null);
    const [lpBalance, setLpBalance] = useState<number>(0);
    const [lpMint, setLpMint] = useState<string>("");
    const [lpDecimals, setLpDecimals] = useState<number>(6);
    const [withdrawPct, setWithdrawPct] = useState<number>(100);
    const [loading, setLoading] = useState(true);
    const [txLoading, setTxLoading] = useState(false);
    const [txError, setTxError] = useState<string | null>(null);
    const [txSig, setTxSig] = useState<string | null>(null);
    const [slippage] = useState<number>(1);

    // ── Load pool info from RPC ───────────────────────────
    const loadPool = useCallback(async () => {
        if (!poolId || !publicKey || !connected) return;
        setLoading(true);
        setTxError(null);
        try {
            const raydium = await Raydium.load({
                owner: publicKey,
                connection,
                cluster: "devnet",
                disableFeatureCheck: true,
                disableLoadToken: false,
            });

            const { poolInfo: info, rpcData: rpc } = await raydium.cpmm.getPoolInfoFromRpc(poolId);
            setPoolInfo(info);
            setRpcData(rpc);

            const lpMintAddr = info.lpMint.address;
            const lpDec = info.lpMint.decimals;
            setLpMint(lpMintAddr);
            setLpDecimals(lpDec);

            try {
                const tokenAccounts = await connection.getTokenAccountsByOwner(publicKey, {
                    mint: new PublicKey(lpMintAddr),
                });
                if (tokenAccounts.value.length > 0) {
                    const { AccountLayout } = await import("@solana/spl-token");
                    const decoded = AccountLayout.decode(tokenAccounts.value[0].account.data);
                    const raw = Number(decoded.amount);
                    setLpBalance(raw / Math.pow(10, lpDec));
                } else {
                    setLpBalance(0);
                }
            } catch {
                setLpBalance(0);
            }
        } catch (err: any) {
            const cleanMessage = parseError(err);
            setTxError(cleanMessage);
            notify.error(cleanMessage);
        } finally {
            setLoading(false);
        }
    }, [poolId, publicKey, connected, connection]);

    useEffect(() => { loadPool(); }, [loadPool]);

    // ── Derived: estimated receive amounts ────────────────
    const lpToWithdraw = lpBalance * (withdrawPct / 100);
    const lpToWithdrawRaw = new BN(
        new Decimal(lpToWithdraw).mul(Math.pow(10, lpDecimals)).toFixed(0, Decimal.ROUND_DOWN)
    );

    let estimatedA = 0;
    let estimatedB = 0;
    if (rpcData && lpToWithdraw > 0 && rpcData.lpAmount.gt(new BN(0))) {
        const lpTotalRaw = rpcData.lpAmount;
        estimatedA = (lpToWithdrawRaw.mul(rpcData.baseReserve).div(lpTotalRaw)).toNumber()
            / Math.pow(10, poolInfo?.mintA?.decimals || 6);
        estimatedB = (lpToWithdrawRaw.mul(rpcData.quoteReserve).div(lpTotalRaw)).toNumber()
            / Math.pow(10, poolInfo?.mintB?.decimals || 6);
    }

    // ── Withdraw ──────────────────────────────────────────
    const handleWithdraw = async () => {
        if (!connected || !publicKey || !poolInfo) return;
        if (lpToWithdraw <= 0) {
            const msg = "No LP tokens to withdraw.";
            setTxError(msg);
            notify.error(msg);
            return;
        }
        setTxLoading(true);
        setTxError(null);
        setTxSig(null);

        try {
            let lastTxId = "";

            const wrappedSignAll = async <T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> => {
                for (const tx of txs) {
                    if ("serialize" in tx && "feePayer" in tx) {
                        const sig = await sendTransaction(tx as Transaction, connection);
                        await connection.confirmTransaction(sig, "confirmed");
                        lastTxId = sig;
                    }
                }
                return [];
            };

            const raydium = await Raydium.load({
                owner: publicKey,
                connection,
                cluster: "devnet",
                disableFeatureCheck: true,
                disableLoadToken: false,
                signAllTransactions: wrappedSignAll,
            });

            const slippagePercent = new Percent(
                new BN(Math.floor(slippage * 100)),
                new BN(10000)
            );

            const { execute } = await raydium.cpmm.withdrawLiquidity({
                poolInfo,
                lpAmount: lpToWithdrawRaw,
                slippage: slippagePercent,
                txVersion: TxVersion.LEGACY,
            });

            try {
                await execute({ sendAndConfirm: true });
            } catch (e: any) {
                if (lastTxId) {
                    setTxSig(lastTxId);
                } else {
                    throw e;
                }
            }

            if (lastTxId) {
                setTxSig(lastTxId);
                notify.success("Transaction confirmed!");
            }

        } catch (err: any) {
            const cleanMessage = parseError(err);
            setTxError(cleanMessage);
            notify.error(cleanMessage);
        } finally {
            setTxLoading(false);
        }
    };

    // ── UI ────────────────────────────────────────────────
    if (!connected || !publicKey) {
        return (
            <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
                <p className="text-muted-foreground">Connect your wallet to withdraw liquidity.</p>
            </div>
        );
    }

    return (
        <main className="container mx-auto px-4 py-12 max-w-lg text-foreground">
            {/* Back */}
            <button onClick={() => router.back()}
                className="flex items-center text-muted-foreground hover:text-foreground transition-colors mb-6">
                <ChevronLeft className="h-5 w-5 mr-1" /> Back
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <div className="flex -space-x-2">
                    <TokenIcon symbol={symbolA} logo={logoA} size={36} />
                    <TokenIcon symbol={symbolB} logo={logoB} size={36} />
                </div>
                <div>
                    <h1 className="text-xl font-bold">{symbolA} / {symbolB}</h1>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded font-bold">Standard</span>
                        <span className="text-xs text-[var(--neon-teal)] font-semibold">{fee}</span>
                    </div>
                </div>
            </div>

            {/* Main Card */}
            <div className={`${glassCard} p-6 flex flex-col gap-5`}>

                {loading ? (
                    <div className="flex flex-col items-center py-10 gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-[var(--neon-teal)]" />
                        <p className="text-sm text-muted-foreground">Loading pool data from chain...</p>
                    </div>
                ) : (
                    <>
                        {/* LP Balance */}
                        <div className="bg-white/50 dark:bg-black/20 border border-black/[0.08] dark:border-white/[0.06] rounded-xl px-4 py-3">
                            <p className="text-xs text-muted-foreground mb-1">Your LP Token Balance</p>
                            <p className="text-2xl font-bold text-foreground">
                                {formatLargeNumber(lpBalance)}
                                <span className="text-sm font-normal text-muted-foreground ml-2">LP</span>
                            </p>
                            {lpBalance === 0 && (
                                <p className="text-xs text-yellow-500 mt-1">
                                    No LP tokens found. You may not have liquidity in this pool.
                                </p>
                            )}
                        </div>

                        {/* Withdraw % slider */}
                        <div>
                            <div className="flex justify-between items-center mb-3">
                                <p className="text-sm font-bold">Withdraw Amount</p>
                                <span className="text-lg font-bold text-[var(--neon-teal)]">{withdrawPct}%</span>
                            </div>

                            {/* Percentage buttons */}
                            <div className="flex gap-2 mb-4">
                                {[25, 50, 75, 100].map(pct => (
                                    <button key={pct} onClick={() => setWithdrawPct(pct)}
                                        className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all border ${withdrawPct === pct
                                            ? "bg-[var(--neon-teal)]/15 border-[var(--neon-teal)]/50 text-[var(--neon-teal)]"
                                            : "bg-secondary/50 dark:bg-white/5 border-border text-muted-foreground hover:text-foreground"
                                            }`}>
                                        {pct}%
                                    </button>
                                ))}
                            </div>

                            {/* Slider */}
                            <input
                                type="range" min={1} max={100} value={withdrawPct}
                                onChange={e => setWithdrawPct(Number(e.target.value))}
                                className="w-full accent-[var(--neon-teal)] cursor-pointer"
                            />

                            {/* +/- fine tune */}
                            <div className="flex items-center justify-between mt-3">
                                <button onClick={() => setWithdrawPct(p => Math.max(1, p - 1))}
                                    className="w-9 h-9 rounded-xl bg-secondary/50 dark:bg-white/5 border border-border flex items-center justify-center hover:bg-secondary transition-all">
                                    <Minus className="h-3.5 w-3.5" />
                                </button>
                                <span className="text-xs text-muted-foreground">
                                    = {formatLargeNumber(lpToWithdraw)} LP tokens
                                </span>
                                <button onClick={() => setWithdrawPct(p => Math.min(100, p + 1))}
                                    className="w-9 h-9 rounded-xl bg-secondary/50 dark:bg-white/5 border border-border flex items-center justify-center hover:bg-secondary transition-all">
                                    <Plus className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </div>

                        {/* Estimated receive */}
                        <div className="bg-white/50 dark:bg-black/20 border border-black/[0.08] dark:border-white/[0.06] rounded-xl px-4 py-3 flex flex-col gap-2">
                            <p className="text-xs text-muted-foreground font-semibold mb-1">Estimated Receive</p>
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <TokenIcon symbol={symbolA} logo={logoA} size={20} />
                                    <span className="text-sm font-medium text-foreground">{symbolA}</span>
                                </div>
                                <span className="text-sm font-bold text-foreground">
                                    ~{estimatedA > 0 ? formatLargeNumber(estimatedA) : "0"}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <TokenIcon symbol={symbolB} logo={logoB} size={20} />
                                    <span className="text-sm font-medium text-foreground">{symbolB}</span>
                                </div>
                                <span className="text-sm font-bold text-foreground">
                                    ~{estimatedB > 0 ? formatLargeNumber(estimatedB) : "0"}
                                </span>
                            </div>
                        </div>

                        {/* Slippage info */}
                        <div className="flex justify-between items-center text-xs text-muted-foreground">
                            <span>Slippage tolerance</span>
                            <span className="font-medium text-foreground">{slippage}%</span>
                        </div>

                        {/* Pool ID */}
                        <div className="flex justify-between items-center text-xs text-muted-foreground">
                            <span>Pool ID</span>
                            <span className="font-mono">{poolId ? `${poolId.slice(0, 6)}...${poolId.slice(-4)}` : "—"}</span>
                        </div>

                        {/* Error */}
                        {txError && (
                            <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
                                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                                {txError}
                            </div>
                        )}

                        {/* Success */}
                        {txSig && (
                            <div className="flex items-center gap-2 rounded-xl border border-[var(--neon-teal)]/20 bg-[var(--neon-teal)]/5 px-4 py-3 text-sm text-[var(--neon-teal)]">
                                <CheckCircle2 className="h-4 w-4 shrink-0" />
                                <span>
                                    Withdrawal successful!{" "}
                                    <a href={`https://solscan.io/tx/${txSig}?cluster=devnet`}
                                        target="_blank" rel="noopener noreferrer"
                                        className="underline underline-offset-2 hover:opacity-80">
                                        View on Solscan
                                    </a>
                                </span>
                            </div>
                        )}

                        {/* Submit */}
                        <button
                            onClick={handleWithdraw}
                            disabled={txLoading || lpBalance <= 0 || lpToWithdraw <= 0}
                            className={`w-full font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 ${lpBalance > 0 && lpToWithdraw > 0
                                ? "bg-[var(--neon-teal)] text-black hover:opacity-90 cursor-pointer"
                                : "bg-[var(--neon-teal)]/20 text-[var(--neon-teal)]/50 cursor-not-allowed"
                                } disabled:opacity-60 disabled:cursor-not-allowed`}
                        >
                            {txLoading ? (
                                <>
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    Withdrawing...
                                </>
                            ) : lpBalance <= 0 ? (
                                "No LP tokens to withdraw"
                            ) : (
                                `Withdraw ${withdrawPct}% Liquidity`
                            )}
                        </button>

                        <p className="text-xs text-muted-foreground text-center">
                            You will receive {symbolA} and {symbolB} back to your wallet
                        </p>
                    </>
                )}
            </div>
        </main>
    );
}
