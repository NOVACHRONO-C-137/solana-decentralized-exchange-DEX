"use client";

import React, { useState, useEffect, Suspense, useRef } from "react";
import { formatLargeNumber } from "@/lib/utils";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, RefreshCw, Loader2, ArrowDownUp } from "lucide-react";
import Image from "next/image";
import { createWrappedSignAll, slippageToBps } from "@/lib/raydium-execute";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { Raydium, TxVersion, Percent } from "@raydium-io/raydium-sdk-v2";
import { DEVNET_TOKENS } from "@/components/liquidity/TokenSelectorModal";
import BN from "bn.js";
import Decimal from "decimal.js";
import TokenIcon from "@/components/liquidity/TokenIcon";
import { SlippageSettings } from "@/components/liquidity/SlippageSettings";
import { parseError } from "@/lib/error-utils";

function PositionPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const poolName = searchParams.get("pool") || "SOL / USDC";
  const fee = searchParams.get("fee") || "0.25%";
  const poolId = searchParams.get("poolId") || "";

  const { publicKey, sendTransaction, signAllTransactions, connected } = useWallet();
  const { connection } = useConnection();

  const [depositA, setDepositA] = useState<string>("");
  const [depositB, setDepositB] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
  const [txSig, setTxSig] = useState<string | null>(null);

  const [showSlippageSettings, setShowSlippageSettings] = useState(false);
  const [slippageTab, setSlippageTab] = useState<"Auto" | "Custom">("Auto");
  const [customSlippage, setCustomSlippage] = useState<string>("2.5");
  const slippageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (slippageRef.current && !slippageRef.current.contains(event.target as Node)) {
        setShowSlippageSettings(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [isInverted, setIsInverted] = useState(false);

  const tokens = poolName.split("-");
  const tokenA = tokens[0] || "TOKEN A";
  const tokenB = tokens[1] || "TOKEN B";

  const aInfo = DEVNET_TOKENS.find((t) => t.symbol === tokenA) || {
    symbol: tokenA, mint: searchParams.get("mintA") || "", decimals: parseInt(searchParams.get("decimalsA") || "6"), logoURI: searchParams.get("logoA") || undefined, name: tokenA
  };
  const bInfo = DEVNET_TOKENS.find((t) => t.symbol === tokenB) || {
    symbol: tokenB, mint: searchParams.get("mintB") || "", decimals: parseInt(searchParams.get("decimalsB") || "6"), logoURI: searchParams.get("logoB") || undefined, name: tokenB
  };

  const [tokenAInfo, setTokenAInfo] = useState<any>(aInfo);
  const [tokenBInfo, setTokenBInfo] = useState<any>(bInfo);

  const [balanceA, setBalanceA] = useState<number>(0);
  const [balanceB, setBalanceB] = useState<number>(0);
  const [isFetchingBalances, setIsFetchingBalances] = useState(false);

  const fetchBalances = async () => {
    if (!publicKey || !connection || !tokenAInfo?.mint || !tokenBInfo?.mint) return;
    setIsFetchingBalances(true);
    try {
      const getBal = async (mint: string) => {
        if (mint === "11111111111111111111111111111111" || mint === "So11111111111111111111111111111111111111112") {
          const bal = await connection.getBalance(publicKey);
          return bal / 10 ** 9;
        }
        const accounts = await connection.getParsedTokenAccountsByOwner(publicKey, { mint: new PublicKey(mint) });
        if (accounts.value.length > 0) return accounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
        return 0;
      };
      setBalanceA(await getBal(tokenAInfo.mint));
      setBalanceB(await getBal(tokenBInfo.mint));
    } catch { } finally {
      setIsFetchingBalances(false);
    }
  };

  useEffect(() => {
    fetchBalances();
  }, [publicKey, connection, tokenAInfo.mint, tokenBInfo.mint]);

  const [poolPrice, setPoolPrice] = useState<number | null>(null);
  const [poolLoading, setPoolLoading] = useState(false);

  useEffect(() => {
    if (!poolId) return;
    const fetchPoolData = async () => {
      setPoolLoading(true);
      try {
        const res = await fetch(`https://api-v3-devnet.raydium.io/pools/info/ids?ids=${poolId}`);
        const data = await res.json();
        const poolInfo = data.data?.[0];
        if (poolInfo) {
          if (poolInfo.price) setPoolPrice(poolInfo.price);
        }
      } catch { } finally {
        setPoolLoading(false);
      }
    };
    fetchPoolData();
  }, [poolId]);

  const handleDepositAChange = (val: string) => {
    setDepositA(val);
    if (poolPrice && val && parseFloat(val) > 0) {
      const parsedA = parseFloat(val);
      const amountBValue = parsedA * poolPrice;
      setDepositB(isFinite(amountBValue) ? amountBValue.toFixed(6) : "");
    } else {
      setDepositB("");
    }
  };

  const handleDepositBChange = (val: string) => {
    setDepositB(val);
    if (poolPrice && val && parseFloat(val) > 0) {
      const parsedB = parseFloat(val);
      const amountAValue = parsedB / poolPrice;
      setDepositA(isFinite(amountAValue) ? amountAValue.toFixed(6) : "");
    } else {
      setDepositA("");
    }
  };

  const handleSetPercentage = (percent: number, isTopInput: boolean) => {
    const isTokenA = isInverted ? !isTopInput : isTopInput;
    const maxBalance = isTokenA ? balanceA : balanceB;
    const tokenSymbol = isTokenA ? tokenAInfo.symbol : tokenBInfo.symbol;
    let usableBalance = maxBalance;

    if (tokenSymbol === "SOL" && percent === 1) {
      usableBalance = Math.max(0, usableBalance - 0.02);
    }

    const calculatedAmount = (usableBalance * percent).toFixed(6);
    if (isTopInput) {
      isInverted ? handleDepositBChange(calculatedAmount) : handleDepositAChange(calculatedAmount);
    } else {
      isInverted ? handleDepositAChange(calculatedAmount) : handleDepositBChange(calculatedAmount);
    }
  };

  const topToken = isInverted ? tokenB : tokenA;
  const topTokenInfo = isInverted ? tokenBInfo : tokenAInfo;
  const topDeposit = isInverted ? depositB : depositA;
  const setTopDeposit = isInverted ? setDepositB : setDepositA;

  const bottomToken = isInverted ? tokenA : tokenB;
  const bottomTokenInfo = isInverted ? tokenAInfo : tokenBInfo;
  const bottomDeposit = isInverted ? depositA : depositB;
  const setBottomDeposit = isInverted ? setDepositA : setDepositB;

  const persistDepositedPool = () => {
    try {
      const stored = localStorage.getItem("aeroCustomPools");
      const customPools = stored ? JSON.parse(stored) : [];
      let found = false;
      const updated = customPools.map((p: any) => {
        if (p.id === poolId) {
          found = true;
          const totalA = parseFloat(p.depositedA || "0") + parseFloat(depositA);
          const totalB = parseFloat(p.depositedB || "0") + parseFloat(depositB);
          return {
            ...p,
            type: "Standard",
            liquidity: `${totalA} ${tokenAInfo.symbol} + ${totalB} ${tokenBInfo.symbol}`,
            depositedA: totalA.toString(),
            depositedB: totalB.toString(),
          };
        }
        return p;
      });

      if (!found) {
        updated.push({
          id: poolId,
          name: `${tokenAInfo.symbol}-${tokenBInfo.symbol}`,
          symbolA: tokenAInfo.symbol,
          symbolB: tokenBInfo.symbol,
          mintA: tokenAInfo.mint,
          mintB: tokenBInfo.mint,
          decimalsA: tokenAInfo.decimals,
          decimalsB: tokenBInfo.decimals,
          logoA: tokenAInfo.logoURI,
          logoB: tokenBInfo.logoURI,
          type: "Standard",
          depositedA: depositA,
          depositedB: depositB,
          liquidity: `${depositA} ${tokenAInfo.symbol} + ${depositB} ${tokenBInfo.symbol}`,
        });
      }

      localStorage.setItem("aeroCustomPools", JSON.stringify(updated));
    } catch { }
  };


  const handleAddLiquidity = async () => {
    if (!publicKey || !connected) {
      setTxError("Please connect your wallet first.");
      return;
    }
    if (!poolId || !tokenAInfo || !tokenBInfo) {
      setTxError("Missing pool or token info.");
      return;
    }
    if (!depositA || !depositB || parseFloat(depositA) <= 0 || parseFloat(depositB) <= 0) {
      setTxError("Please enter valid deposit amounts.");
      return;
    }

    setLoading(true);
    setTxError(null);
    setTxSig(null);

    try {
      let manualTxId = "";
      const wrappedSignAll = await createWrappedSignAll(
        connection,
        signAllTransactions,
        (sig) => {
          manualTxId = sig;
        }
      );

      const raydium = await Raydium.load({
        owner: publicKey,
        connection,
        cluster: "devnet",
        disableFeatureCheck: true,
        disableLoadToken: true,
        signAllTransactions: wrappedSignAll,
      });

      let poolInfo: any;
      try {
        const res = await raydium.api.fetchPoolById({ ids: poolId });
        if (res && res.length > 0) poolInfo = res[0];
      } catch (apiErr: any) {
        throw new Error("Could not fetch CPMM pool info from API.");
      }

      if (!poolInfo) throw new Error("Pool not found on Raydium API. It may take a few minutes for new pools to be indexed.");

      const poolKeys = await raydium.cpmm.getCpmmPoolKeys(poolId);
      const rpcData = await raydium.cpmm.getRpcPoolInfo(poolInfo.id, true);

      const inputAmount = new BN(new Decimal(depositA).mul(10 ** tokenAInfo.decimals).toFixed(0));

      const maxSlippage = slippageTab === "Auto" ? 2.5 : parseFloat(customSlippage);

      const baseIn = poolInfo.mintA.address === tokenAInfo.mint;

      const { execute } = await raydium.cpmm.addLiquidity({
        poolInfo: poolInfo as any,
        poolKeys,
        inputAmount,
        baseIn,
        slippage: new Percent(slippageToBps(maxSlippage), 10000) as any,
        txVersion: TxVersion.LEGACY,
      });

      let txId = "";
      try {
        const result = await execute({ sendAndConfirm: true });
        txId = result?.txId || "";
      } catch (err: any) {
        if (!manualTxId) {
          throw err;
        }
      }

      const confirmedTxId = txId || manualTxId;
      if (!confirmedTxId) {
        throw new Error("Liquidity transaction did not return a confirmed signature.");
      }

      setTxSig(confirmedTxId);
      persistDepositedPool();
      setDepositA("");
      setDepositB("");
    } catch (err: any) {
      const cleanMessage = parseError(err);
      setTxError(cleanMessage);
    } finally {
      setLoading(false);
    }
  };

  const totalDeposit = (parseFloat(depositA) || 0) * (poolPrice || 1) + (parseFloat(depositB) || 0);

  return (
    <main className="min-h-screen text-foreground bg-background px-4 pt-24 pb-8">
      <div className="max-w-2xl mx-auto">
        <button onClick={() => router.back()} className="flex items-center text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ChevronLeft className="h-5 w-5 mr-1" /> Back
        </button>

        <div className="bg-[rgba(220,240,232,0.45)] dark:bg-[rgba(255,255,255,0.03)] backdrop-blur-[6px] border border-black/[0.06] dark:border-[rgba(255,255,255,0.08)] shadow-[0_2px_16px_0_rgba(0,0,0,0.06)] dark:shadow-[0_2px_12px_0_rgba(0,0,0,0.12)] rounded-2xl px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              <TokenIcon symbol={tokenAInfo?.symbol} logo={tokenAInfo?.logoURI} size={32} className="z-10" />
              <TokenIcon symbol={tokenBInfo?.symbol} logo={tokenBInfo?.logoURI} size={32} />
            </div>
            <span className="text-lg font-bold">{tokenA} / {tokenB}</span>
            <span className="text-xs bg-[var(--neon-teal)]/10 text-[var(--neon-teal)] border border-[var(--neon-teal)]/20 px-2 py-0.5 rounded-full">Standard AMM</span>
          </div>
        </div>

        <div className="w-full bg-[rgba(220,240,232,0.45)] dark:bg-[rgba(255,255,255,0.03)] backdrop-blur-[6px] border border-black/[0.06] dark:border-[rgba(255,255,255,0.08)] shadow-[0_2px_16px_0_rgba(0,0,0,0.06)] dark:shadow-[0_2px_12px_0_rgba(0,0,0,0.12)] rounded-2xl p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold">Add Deposit Amount</h3>
            <div className="flex items-center gap-2 relative" ref={slippageRef}>
              <button
                onClick={() => setShowSlippageSettings(!showSlippageSettings)}
                className="text-xs text-foreground flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary/50 dark:bg-white/5 hover:bg-secondary dark:hover:bg-secondary dark:bg-white/10"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><line x1="4" x2="20" y1="21" y2="21" /><line x1="4" x2="20" y1="14" y2="14" /><line x1="4" x2="20" y1="7" y2="7" /><circle cx="8" cy="21" r="3" /><circle cx="16" cy="14" r="3" /><circle cx="12" cy="7" r="3" /></svg>
                <span>{slippageTab === "Auto" ? "2.5" : customSlippage}%</span>
              </button>
              {showSlippageSettings && (
                <div className="absolute top-full right-0 mt-2 w-72 bg-card border border-border rounded-2xl p-4 shadow-2xl z-50">
                  <div className="mb-4 flex items-center gap-2">
                    <p className="text-sm font-bold">Max Slippage</p>
                  </div>
                  <SlippageSettings
                    tab={slippageTab}
                    value={customSlippage}
                    onTabChange={setSlippageTab}
                    onValueChange={setCustomSlippage}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="bg-white/50 dark:bg-black/20 border border-black/[0.08] dark:border-white/[0.06] rounded-xl p-4">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <TokenIcon symbol={topTokenInfo?.symbol} logo={topTokenInfo?.logoURI} size={28} className="!border-0" />
                <span className="font-bold text-sm">{topToken}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground flex items-center gap-1">{isFetchingBalances && <Loader2 className="w-3 h-3 animate-spin" />} {formatLargeNumber(isInverted ? balanceB : balanceA)}</span>
                <button onClick={() => handleSetPercentage(0.5, true)} className="text-xs bg-secondary/50 dark:bg-white/5 hover:bg-secondary dark:hover:bg-secondary dark:bg-white/10 px-2 py-1 rounded-lg text-muted-foreground transition-all">50%</button>
                <button onClick={() => handleSetPercentage(1, true)} className="text-xs bg-secondary/50 dark:bg-white/5 hover:bg-secondary dark:hover:bg-secondary dark:bg-white/10 px-2 py-1 rounded-lg text-muted-foreground transition-all">Max</button>
              </div>
            </div>
            <input type="number" placeholder="0" value={topDeposit} onChange={(e) => { const val = e.target.value; if (Number(val) < 0) return; isInverted ? handleDepositBChange(val) : handleDepositAChange(val); }} className={`bg-transparent font-bold text-foreground outline-none w-full text-right text-2xl`} />
          </div>

          <div className="flex justify-center -my-3 z-10 relative">
            <button onClick={() => setIsInverted(!isInverted)} className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-[var(--neon-teal)] hover:border-[var(--neon-teal)]/30 transition-all shadow-lg">
              <ArrowDownUp className="h-4 w-4" />
            </button>
          </div>

          <div className="bg-white/50 dark:bg-black/20 border border-black/[0.08] dark:border-white/[0.06] rounded-xl p-4">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <TokenIcon symbol={bottomTokenInfo?.symbol} logo={bottomTokenInfo?.logoURI} size={28} className="!border-0" />
                <span className="font-bold text-sm">{bottomToken}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground flex items-center gap-1">{isFetchingBalances && <Loader2 className="w-3 h-3 animate-spin" />} {formatLargeNumber(isInverted ? balanceA : balanceB)}</span>
                <button onClick={() => handleSetPercentage(0.5, false)} className="text-xs bg-secondary/50 dark:bg-white/5 hover:bg-secondary dark:hover:bg-secondary dark:bg-white/10 px-2 py-1 rounded-lg text-muted-foreground transition-all">50%</button>
                <button onClick={() => handleSetPercentage(1, false)} className="text-xs bg-secondary/50 dark:bg-white/5 hover:bg-secondary dark:hover:bg-secondary dark:bg-white/10 px-2 py-1 rounded-lg text-muted-foreground transition-all">Max</button>
              </div>
            </div>
            <input type="number" placeholder="0" value={bottomDeposit} onChange={(e) => { const val = e.target.value; if (Number(val) < 0) return; isInverted ? handleDepositAChange(val) : handleDepositBChange(val); }} className={`bg-transparent font-bold text-foreground outline-none w-full text-right text-2xl`} />
          </div>

          <div className="bg-white/50 dark:bg-black/20 border border-black/[0.08] dark:border-white/[0.06] rounded-xl px-4 py-3 flex flex-col gap-2 mt-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Estimated Total Deposit</span>
              <span className="text-sm font-bold">${formatLargeNumber(totalDeposit)}</span>
            </div>
            <div className="flex justify-between items-center mt-2 border-t border-border/50 pt-2">
              <span className="text-xs text-muted-foreground">Pool Deposit Ratio</span>
              <span className="text-xs font-bold text-foreground/70">50% / 50%</span>
            </div>
          </div>

          {txError && <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-xs text-red-400">⚠ {txError}</div>}
          {txSig && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 text-xs text-green-400">
              ✅ Liquidity added! <a href={`https://solscan.io/tx/${txSig}?cluster=devnet`} target="_blank" rel="noopener noreferrer" className="underline hover:text-green-300">View on Solscan</a>
            </div>
          )}

          <button disabled={loading || (!depositA && !depositB) || !poolId} onClick={handleAddLiquidity} className={`w-full font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 ${loading ? "bg-[var(--neon-teal)]/50 text-black/70 cursor-wait" : (depositA || depositB) && poolId ? "bg-[var(--neon-teal)] text-black hover:opacity-90 cursor-pointer" : "bg-[var(--neon-teal)]/20 text-[var(--neon-teal)]/50 cursor-not-allowed"}`}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "Adding Liquidity..." : !poolId ? "Mock Pool — Cannot Deposit" : depositA || depositB ? "Deposit standard liquidity" : "Enter Token Amount"}
          </button>
        </div>
      </div>
    </main>
  );
}

export default function StandardPositionPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Loading...</div>}>
      <PositionPageInner />
    </Suspense>
  );
}
