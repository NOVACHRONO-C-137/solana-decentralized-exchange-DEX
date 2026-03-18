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
        <main className="min-h-screen bg-background text-foreground px-4 py-8 transition-colors">
            <div className="flex flex-col lg:flex-row items-center lg:items-start justify-center min-h-screen px-4 pt-28 pb-12 gap-8 lg:gap-6 max-w-6xl mx-auto w-full relative z-10">
                <div className="w-full max-w-lg lg:max-w-none lg:w-1/2 flex justify-center lg:justify-end">
                    <SwapCard />
                </div>
                <div className="w-full max-w-lg lg:max-w-none lg:w-1/2 lg:pt-[72px] flex justify-center lg:justify-start">
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
            <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground transition-colors">
                Loading...
            </div>
        }>
            <SwapPageInner />
        </Suspense>
    );
}
