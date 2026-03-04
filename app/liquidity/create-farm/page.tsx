"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Check, Search } from "lucide-react";

type PoolKind = "clmm" | "standard";

export default function CreateFarmPage() {
    const router = useRouter();
    const [currentStep, setCurrentStep] = useState<number>(1);
    const [poolKind, setPoolKind] = useState<PoolKind>("clmm");
    const [searchQuery, setSearchQuery] = useState<string>("");

    // Step 2 state
    const [rewardToken, setRewardToken] = useState<string>("");
    const [rewardAmount, setRewardAmount] = useState<string>("");
    const [farmDays, setFarmDays] = useState<string>("7");

    // Stepper
    const renderStepper = () => (
        <div className="w-full md:w-1/3 flex flex-col gap-4">
            <button
                onClick={() => router.back()}
                className="flex items-center text-white/60 hover:text-white transition-colors w-fit mb-2"
            >
                <ChevronLeft className="h-5 w-5 mr-1" /> Back
            </button>

            <div className="bg-[#161722] border border-white/10 rounded-2xl p-6 flex flex-col gap-6">
                {[
                    { n: 1, label: "Select Pool" },
                    { n: 2, label: "Add Rewards" },
                    { n: 3, label: "Review Farm Detail" },
                ].map(({ n, label }, i, arr) => (
                    <div key={n} className="flex gap-4">
                        <div className="flex flex-col items-center">
                            <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 border-2 transition-all
                                ${currentStep > n ? "bg-[var(--neon-teal)] border-[var(--neon-teal)] text-black" :
                                    currentStep === n ? "border-[var(--neon-teal)] text-[var(--neon-teal)]" :
                                        "border-white/20 text-white/40"}`}>
                                {currentStep > n ? <Check className="h-4 w-4" /> : n}
                            </div>
                            {i < arr.length - 1 && <div className="w-0.5 h-12 bg-white/10 mt-2" />}
                        </div>
                        <div className={`pt-1 ${currentStep < n ? "opacity-40" : ""}`}>
                            <p className={`text-xs font-medium mb-0.5 ${currentStep >= n ? "text-[var(--neon-teal)]" : "text-white/40"}`}>
                                Step {n}
                            </p>
                            <p className={`text-sm font-bold ${currentStep === n ? "text-white" : "text-white/60"}`}>
                                {label}
                            </p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="bg-[#161722] border border-white/10 rounded-2xl p-5">
                <h4 className="flex items-center text-sm font-bold mb-2">
                    <span className="w-4 h-4 rounded-full border border-white/40 text-white/60 flex items-center justify-center text-[10px] mr-2">!</span>
                    Please Note
                </h4>
                <p className="text-xs text-white/50 leading-relaxed">
                    A farm can be created for any pool that is already live. For detailed instructions, read the guide for{" "}
                    <span className="text-[var(--neon-teal)] cursor-pointer hover:underline">CLMM</span> or{" "}
                    <span className="text-[var(--neon-teal)] cursor-pointer hover:underline">Standard</span> farms.
                </p>
            </div>
        </div>
    );

    // Step 1 — Select Pool
    const renderStep1 = () => (
        <div className="w-full md:w-2/3">
            <h2 className="text-xl font-bold mb-6">First, select a pool for farm rewards</h2>

            <div className="bg-[#161722] border border-white/10 rounded-2xl p-6 flex flex-col gap-5">
                <div>
                    <p className="text-sm font-bold mb-3">Select Pool</p>

                    {/* Pool type toggle */}
                    <div className="flex gap-3 mb-5">
                        <button
                            onClick={() => setPoolKind("clmm")}
                            className={`flex items-center gap-2 flex-1 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${poolKind === "clmm"
                                ? "border-[var(--neon-teal)] text-[var(--neon-teal)] bg-[var(--neon-teal)]/5"
                                : "border-white/10 text-white/40 hover:border-white/20"}`}
                        >
                            <div className={`w-3 h-3 rounded-full border-2 flex items-center justify-center ${poolKind === "clmm" ? "border-[var(--neon-teal)]" : "border-white/30"}`}>
                                {poolKind === "clmm" && <div className="w-1.5 h-1.5 rounded-full bg-[var(--neon-teal)]" />}
                            </div>
                            Concentrated Liquidity
                        </button>
                        <button
                            onClick={() => setPoolKind("standard")}
                            className={`flex items-center gap-2 flex-1 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${poolKind === "standard"
                                ? "border-[var(--neon-teal)] text-[var(--neon-teal)] bg-[var(--neon-teal)]/5"
                                : "border-white/10 text-white/40 hover:border-white/20"}`}
                        >
                            <div className={`w-3 h-3 rounded-full border-2 flex items-center justify-center ${poolKind === "standard" ? "border-[var(--neon-teal)]" : "border-white/30"}`}>
                                {poolKind === "standard" && <div className="w-1.5 h-1.5 rounded-full bg-[var(--neon-teal)]" />}
                            </div>
                            Standard AMM
                        </button>
                    </div>

                    {/* Search */}
                    <div className="relative mb-3">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                        <input
                            type="text"
                            placeholder="Search for a pair or enter AMM ID"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-black/20 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white outline-none focus:border-white/20 transition-all placeholder:text-white/30"
                        />
                    </div>

                    {/* Empty state */}
                    {!searchQuery && (
                        <p className="text-xs text-white/40 py-2">Select from your created pools:</p>
                    )}

                    {/* Mock pool results when searching */}
                    {searchQuery && (
                        <div className="bg-black/20 border border-white/10 rounded-xl overflow-hidden">
                            <p className="text-xs text-white/30 px-4 py-3 text-center">No pools found. Try a different search.</p>
                        </div>
                    )}

                    <p className="text-xs text-white/40 mt-4">
                        Can&apos;t find what you want?{" "}
                        <span
                            onClick={() => router.push("/liquidity/create")}
                            className="text-[var(--neon-teal)] cursor-pointer hover:underline"
                        >
                            Create a new pool
                        </span>
                    </p>
                </div>

                <button
                    onClick={() => setCurrentStep(2)}
                    className="w-full bg-[var(--neon-teal)] text-black font-bold py-4 rounded-xl hover:opacity-90 transition-all"
                >
                    Continue
                </button>
            </div>
        </div>
    );

    // Step 2 — Add Rewards
    const renderStep2 = () => (
        <div className="w-full md:w-2/3">
            <h2 className="text-xl font-bold mb-6">Next, add farm rewards</h2>

            <div className="bg-[#161722] border border-white/10 rounded-2xl p-6 flex flex-col gap-5">
                <div>
                    <p className="text-sm font-bold mb-2">Reward Token</p>
                    <input
                        type="text"
                        placeholder="Enter token symbol or address"
                        value={rewardToken}
                        onChange={(e) => setRewardToken(e.target.value)}
                        className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20 placeholder:text-white/30"
                    />
                </div>

                <div>
                    <p className="text-sm font-bold mb-2">Total Reward Amount</p>
                    <input
                        type="number"
                        placeholder="0"
                        value={rewardAmount}
                        onChange={(e) => setRewardAmount(e.target.value)}
                        className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20 placeholder:text-white/30"
                    />
                </div>

                <div>
                    <p className="text-sm font-bold mb-2">Farm Duration (days)</p>
                    <div className="flex gap-2">
                        {["7", "14", "30", "60"].map((d) => (
                            <button
                                key={d}
                                onClick={() => setFarmDays(d)}
                                className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all ${farmDays === d
                                    ? "border-[var(--neon-teal)] text-[var(--neon-teal)] bg-[var(--neon-teal)]/5"
                                    : "border-white/10 text-white/40 hover:border-white/20"}`}
                            >
                                {d}d
                            </button>
                        ))}
                    </div>
                </div>

                {rewardToken && rewardAmount && (
                    <div className="bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-xs text-white/50">
                        Daily rewards: <span className="text-white font-medium">
                            {(parseFloat(rewardAmount) / parseInt(farmDays)).toFixed(4)} {rewardToken}/day
                        </span>
                    </div>
                )}

                <div className="flex gap-3">
                    <button
                        onClick={() => setCurrentStep(1)}
                        className="flex-1 border border-white/10 text-white/60 font-bold py-4 rounded-xl hover:border-white/20 hover:text-white transition-all"
                    >
                        Back
                    </button>
                    <button
                        onClick={() => setCurrentStep(3)}
                        disabled={!rewardToken || !rewardAmount}
                        className={`flex-1 font-bold py-4 rounded-xl transition-all ${rewardToken && rewardAmount
                            ? "bg-[var(--neon-teal)] text-black hover:opacity-90 cursor-pointer"
                            : "bg-[var(--neon-teal)]/20 text-[var(--neon-teal)]/50 cursor-not-allowed"}`}
                    >
                        Continue
                    </button>
                </div>
            </div>
        </div>
    );

    // Step 3 — Review
    const renderStep3 = () => (
        <div className="w-full md:w-2/3">
            <h2 className="text-xl font-bold mb-6">Review farm details</h2>

            <div className="bg-[#161722] border border-white/10 rounded-2xl p-6 flex flex-col gap-4">
                <div className="flex flex-col gap-3">
                    {[
                        { label: "Pool Type", value: poolKind === "clmm" ? "Concentrated Liquidity" : "Standard AMM" },
                        { label: "Reward Token", value: rewardToken },
                        { label: "Total Rewards", value: `${rewardAmount} ${rewardToken}` },
                        { label: "Duration", value: `${farmDays} days` },
                        { label: "Daily Rate", value: `${(parseFloat(rewardAmount) / parseInt(farmDays)).toFixed(4)} ${rewardToken}/day` },
                    ].map(({ label, value }) => (
                        <div key={label} className="flex justify-between items-center py-2 border-b border-white/5">
                            <span className="text-sm text-white/50">{label}</span>
                            <span className="text-sm font-bold text-white">{value}</span>
                        </div>
                    ))}
                </div>

                <p className="text-xs text-yellow-400/80 mt-2">
                    Note: A creation fee is required to initialize the farm on-chain.
                </p>

                <div className="flex gap-3 mt-2">
                    <button
                        onClick={() => setCurrentStep(2)}
                        className="flex-1 border border-white/10 text-white/60 font-bold py-4 rounded-xl hover:border-white/20 hover:text-white transition-all"
                    >
                        Back
                    </button>
                    <button
                        className="flex-1 bg-[var(--neon-teal)] text-black font-bold py-4 rounded-xl hover:opacity-90 transition-all"
                    >
                        Create Farm
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <main className="container mx-auto px-4 py-12 flex flex-col items-center min-h-screen text-white">
            <div className="w-full max-w-5xl flex flex-col md:flex-row gap-8">
                {renderStepper()}
                {currentStep === 1 && renderStep1()}
                {currentStep === 2 && renderStep2()}
                {currentStep === 3 && renderStep3()}
            </div>
        </main>
    );
}
