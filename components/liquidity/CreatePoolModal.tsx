//components/liquidity/CreatePoolModal.tsx


"use client";

import { useRouter } from "next/navigation";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2 } from "lucide-react";

export function CreatePoolModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const router = useRouter();
    const [farmType, setFarmType] = useState<"clmm" | "standard">("clmm");
    // Tracks which main card is selected
    const [mainOption, setMainOption] = useState<"pool" | "farm">("pool");
    // Tracks which pool type is selected inside the first card
    const [poolType, setPoolType] = useState<"concentrated" | "standard" | "legacy">("concentrated");

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-[#11121a] text-white border-white/10 sm:max-w-[420px] p-6 shadow-2xl rounded-2xl">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold">I want to...</DialogTitle>
                </DialogHeader>

                <div className="flex flex-col gap-3 mt-4">
                    {/* OPTION 1: CREATE POOL (EXPANDED) */}
                    <div
                        onClick={() => setMainOption("pool")}
                        className={`rounded-xl p-4 cursor-pointer transition-all ${mainOption === "pool"
                            ? "border border-[var(--neon-teal)] bg-[#1a1b26]"
                            : "border border-white/10 bg-[#161722] hover:border-white/30"
                            }`}
                    >
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="font-bold text-base">Create pool</h3>
                            {mainOption === "pool" && <CheckCircle2 className="h-5 w-5 text-[var(--neon-teal)]" />}
                        </div>

                        {mainOption === "pool" && (
                            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                <p className="text-xs text-white/70 mb-4 leading-relaxed">
                                    Select pool type to create a pool for any token pair.<br />
                                    Read the guide for <span className="text-[var(--neon-teal)] hover:underline cursor-pointer">CLMM</span> or <span className="text-[var(--neon-teal)] hover:underline cursor-pointer">Standard</span> pools.
                                </p>

                                <p className="text-sm font-semibold mb-3">Pool type:</p>
                                <div className="flex flex-col gap-2.5">

                                    {/* Concentrated Liquidity Radio */}
                                    <div
                                        onClick={(e) => { e.stopPropagation(); setPoolType("concentrated"); }}
                                        className={`p-3.5 rounded-lg border cursor-pointer relative transition-all ${poolType === "concentrated" ? "border-[var(--neon-teal)] bg-white/5" : "border-white/10 bg-black/20 hover:border-white/30"
                                            }`}
                                    >
                                        <div className="absolute top-0 right-4 -translate-y-1/2 bg-[#8b5cf6] text-white text-[9px] font-bold px-2 py-0.5 rounded italic tracking-wider">
                                            SUGGESTED
                                        </div>
                                        <div className="flex gap-3 items-start">
                                            <div className={`mt-0.5 h-4 w-4 rounded-full border flex items-center justify-center shrink-0 ${poolType === "concentrated" ? "border-[var(--neon-teal)]" : "border-white/30"
                                                }`}>
                                                {poolType === "concentrated" && <div className="h-2 w-2 rounded-full bg-[var(--neon-teal)]" />}
                                            </div>
                                            <div className="flex flex-col gap-0.5">
                                                <p className={`text-sm font-medium ${poolType === "concentrated" ? "text-[var(--neon-teal)]" : "text-white/90"}`}>
                                                    Concentrated Liquidity
                                                </p>
                                                <p className={`text-xs ${poolType === "concentrated" ? "text-[var(--neon-teal)]/70" : "text-white/40"}`}>
                                                    Custom ranges, increased capital efficiency
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Standard AMM Radio */}
                                    <div
                                        onClick={(e) => { e.stopPropagation(); setPoolType("standard"); }}
                                        className={`p-3.5 rounded-lg border cursor-pointer transition-all ${poolType === "standard" ? "border-indigo-400 bg-white/5" : "border-white/10 bg-black/20 hover:border-white/30"
                                            }`}
                                    >
                                        <div className="flex gap-3 items-start">
                                            <div className={`mt-0.5 h-4 w-4 rounded-full border flex items-center justify-center shrink-0 ${poolType === "standard" ? "border-indigo-400" : "border-white/30"
                                                }`}>
                                                {poolType === "standard" && <div className="h-2 w-2 rounded-full bg-indigo-400" />}
                                            </div>
                                            <div className="flex flex-col gap-0.5">
                                                <p className={`text-sm font-medium ${poolType === "standard" ? "text-indigo-400" : "text-white/90"}`}>
                                                    Standard AMM
                                                </p>
                                                <p className={`text-xs ${poolType === "standard" ? "text-indigo-400/70" : "text-white/40"}`}>
                                                    Newest CPMM, cheaper, supports Token 2022
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Legacy AMM Radio */}
                                    <div
                                        onClick={(e) => { e.stopPropagation(); setPoolType("legacy"); }}
                                        className={`p-3.5 rounded-lg border cursor-pointer transition-all ${poolType === "legacy" ? "border-white/60 bg-white/5" : "border-white/10 bg-black/20 hover:border-white/30"
                                            }`}
                                    >
                                        <div className="flex gap-3 items-start">
                                            <div className={`mt-0.5 h-4 w-4 rounded-full border flex items-center justify-center shrink-0 ${poolType === "legacy" ? "border-white/60" : "border-white/30"
                                                }`}>
                                                {poolType === "legacy" && <div className="h-2 w-2 rounded-full bg-white/60" />}
                                            </div>
                                            <div className="flex flex-col gap-0.5">
                                                <p className={`text-sm font-medium ${poolType === "legacy" ? "text-white/90" : "text-white/50"}`}>
                                                    Legacy AMM v4
                                                </p>
                                                <p className={`text-xs ${poolType === "legacy" ? "text-white/60" : "text-white/30"}`}>
                                                    Legacy AMM program, more expensive due to orderbook market requirement
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                </div>
                            </div>
                        )}
                    </div>

                    {/* OPTION 2: CREATE FARM */}
                    <div
                        onClick={() => setMainOption("farm")}
                        className={`rounded-xl p-4 cursor-pointer transition-all ${mainOption === "farm"
                            ? "border border-[var(--neon-teal)] bg-[#1a1b26]"
                            : "border border-white/10 bg-[#161722] hover:border-white/30"}`}
                    >
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="font-bold text-base">Create Farm</h3>
                            {mainOption === "farm" && <CheckCircle2 className="h-5 w-5 text-[var(--neon-teal)]" />}
                        </div>

                        {mainOption === "farm" && (
                            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                <p className="text-xs text-white/70 mt-2 leading-relaxed">
                                    Create a farm for any live pool. Read the instructions for{" "}
                                    <span className="text-[var(--neon-teal)] hover:underline cursor-pointer">CLMM</span> or{" "}
                                    <span className="text-[var(--neon-teal)] hover:underline cursor-pointer">Standard</span> farms.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* ACTION BUTTONS */}
                    <div className="flex flex-col gap-2 mt-4 pt-2">
                        <button
                            onClick={() => {
                                if (mainOption === "pool") {
                                    router.push(`/liquidity/create/${poolType === "concentrated" ? "clmm" : poolType}`);
                                } else if (mainOption === "farm") {
                                    router.push(`/liquidity/create-farm`);
                                }
                                onClose();
                            }}
                            className="w-full bg-[var(--neon-teal)] text-black font-bold text-base py-3.5 rounded-xl hover:shadow-[0_0_15px_var(--neon-teal-glow)] transition-all"
                        >
                            Continue
                        </button>
                        <button
                            onClick={onClose}
                            className="w-full text-white/60 font-medium py-3 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}