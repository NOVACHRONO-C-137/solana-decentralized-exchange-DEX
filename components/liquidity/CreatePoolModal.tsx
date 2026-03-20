"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function CreatePoolModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const router = useRouter();
    // Tracks which pool type is selected
    const [poolType, setPoolType] = useState<"concentrated" | "standard" | "legacy">("concentrated");

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-[rgba(220,240,232,0.72)] dark:bg-[rgba(255,255,255,0.02)] backdrop-blur-[6px] border border-black/[0.06] dark:border-[rgba(255,255,255,0.06)] shadow-[0_2px_16px_0_rgba(0,0,0,0.06)] text-foreground w-[95vw] sm:max-w-[420px] p-4 sm:p-6 rounded-2xl">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold text-foreground">Create Pool</DialogTitle>
                </DialogHeader>

                <div className="flex flex-col gap-3 mt-4">
                    <p className="text-xs text-muted-foreground mb-2 leading-relaxed">
                        Select pool type to create a pool for any token pair.<br />
                        Read the guide for <span className="text-[var(--neon-teal)] hover:underline cursor-pointer">CLMM</span> or <span className="text-[var(--neon-teal)] hover:underline cursor-pointer">Standard</span> pools.
                    </p>

                    <div className="flex flex-col gap-2.5">
                        {/* Concentrated Liquidity Radio */}
                        <div
                            onClick={(e) => { e.stopPropagation(); setPoolType("concentrated"); }}
                            className={`p-2.5 sm:p-3.5 rounded-lg border cursor-pointer relative transition-all ${poolType === "concentrated" ? "border-[var(--neon-teal)] bg-[var(--neon-teal)]/10 shadow-[0_0_12px_var(--neon-teal-glow,rgba(20,241,149,0.15))]" : "border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/5 hover:border-[var(--neon-teal)]/40 dark:hover:border-white/30"
                                }`}
                        >
                            <div className="absolute top-0 right-2 sm:right-4 -translate-y-1/2 bg-[#8b5cf6] text-white text-[8px] sm:text-[9px] font-bold px-1.5 sm:px-2 py-0.5 rounded italic tracking-wider">
                                SUGGESTED
                            </div>
                            <div className="flex gap-3 items-start">
                                <div className={`mt-0.5 h-4 w-4 rounded-full border flex items-center justify-center shrink-0 ${poolType === "concentrated" ? "border-[var(--neon-teal)]" : "border-black/20 dark:border-white/30"
                                    }`}>
                                    {poolType === "concentrated" && <div className="h-2 w-2 rounded-full bg-[var(--neon-teal)]" />}
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <p className={`text-sm font-medium ${poolType === "concentrated" ? "text-[var(--neon-teal)]" : "text-black/60 dark:text-foreground"}`}>
                                        Concentrated Liquidity
                                    </p>
                                    <p className={`text-[10px] sm:text-xs ${poolType === "concentrated" ? "text-[var(--neon-teal)]/80" : "text-black/40 dark:text-muted-foreground"}`}>
                                        Custom ranges, increased capital efficiency
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Standard AMM Radio */}
                        <div
                            onClick={(e) => { e.stopPropagation(); setPoolType("standard"); }}
                            className={`p-2.5 sm:p-3.5 rounded-lg border cursor-pointer transition-all ${poolType === "standard" ? "border-indigo-400 bg-indigo-400/10 shadow-[0_0_12px_rgba(129,140,248,0.15)]" : "border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/5 hover:border-indigo-400/40 dark:hover:border-white/30"
                                }`}
                        >
                            <div className="flex gap-3 items-start">
                                <div className={`mt-0.5 h-4 w-4 rounded-full border flex items-center justify-center shrink-0 ${poolType === "standard" ? "border-indigo-400" : "border-black/20 dark:border-white/30"
                                    }`}>
                                    {poolType === "standard" && <div className="h-2 w-2 rounded-full bg-indigo-400" />}
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <p className={`text-sm font-medium ${poolType === "standard" ? "text-indigo-500" : "text-black/60 dark:text-foreground"}`}>
                                        Standard AMM
                                    </p>
                                    <p className={`text-[10px] sm:text-xs ${poolType === "standard" ? "text-indigo-400/80" : "text-black/40 dark:text-muted-foreground"}`}>
                                        Newest CPMM, cheaper, supports Token 2022
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Legacy AMM Radio */}
                        <div
                            onClick={(e) => { e.stopPropagation(); setPoolType("legacy"); }}
                            className={`p-2.5 sm:p-3.5 rounded-lg border cursor-pointer transition-all ${poolType === "legacy" ? "border-[#0D9B5F] bg-[#0D9B5F]/10 dark:border-white/60 dark:bg-white/5 shadow-[0_0_12px_rgba(13,155,95,0.15)]" : "border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/5 hover:border-[#0D9B5F]/40 dark:hover:border-white/30"
                                }`}
                        >
                            <div className="flex gap-3 items-start">
                                <div className={`mt-0.5 h-4 w-4 rounded-full border flex items-center justify-center shrink-0 ${poolType === "legacy" ? "border-[#0D9B5F] dark:border-white/60" : "border-black/20 dark:border-white/30"
                                    }`}>
                                    {poolType === "legacy" && <div className="h-2 w-2 rounded-full bg-[#0D9B5F] dark:bg-white/60" />}
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <p className={`text-sm font-medium ${poolType === "legacy" ? "text-[#0D9B5F] dark:text-foreground/90" : "text-black/60 dark:text-foreground"}`}>
                                        Legacy AMM v4
                                    </p>
                                    <p className={`text-[10px] sm:text-xs ${poolType === "legacy" ? "text-[#0D9B5F]/80" : "text-black/40 dark:text-muted-foreground"}`}>
                                        Legacy AMM program, more expensive due to orderbook market requirement
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ACTION BUTTONS */}
                    <div className="flex flex-col gap-2 mt-4 pt-2">
                        <button
                            onClick={() => {
                                router.push(`/liquidity/create/${poolType === "concentrated" ? "clmm" : poolType}`);
                                onClose();
                            }}
                            className="w-full bg-[var(--neon-teal)] text-black font-bold text-sm sm:text-base py-2.5 sm:py-3.5 rounded-xl hover:shadow-[0_0_15px_var(--neon-teal-glow)] transition-all"
                        >
                            Continue
                        </button>
                        <button
                            onClick={onClose}
                            className="w-full text-muted-foreground font-medium py-2 sm:py-3 text-sm sm:text-base hover:text-foreground transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
