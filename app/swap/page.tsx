"use client";

import { Suspense } from "react";
import SwapCard from "@/components/SwapCard";
import SwapStatsPanel from "@/components/SwapStatsPanel";
import { useSearchParams } from "next/navigation";

function SwapPageInner() {
    const searchParams = useSearchParams();
    const fromToken = searchParams.get('from') ?? '';
    const toToken = searchParams.get('to') ?? '';
    const fromMint = searchParams.get('fromMint') ?? '';
    const toMint = searchParams.get('toMint') ?? '';

    return (
        <main className="min-h-screen bg-[#0d0e14] text-white px-4 py-8">
            <div className="flex items-start justify-center min-h-screen px-4 py-24 gap-6 max-w-6xl mx-auto w-full relative z-10">
                <div className="w-full flex-1">
                    <SwapCard />
                </div>
                <div className="w-full flex-1 pt-[72px]">
                    <SwapStatsPanel
                        fromToken={fromToken}
                        toToken={toToken}
                        fromMint={fromMint}
                        toMint={toMint}
                    />
                </div>
            </div>
        </main>
    );
}

export default function SwapPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-[#0d0e14] flex items-center justify-center text-white/40">
                Loading...
            </div>
        }>
            <SwapPageInner />
        </Suspense>
    );
}
