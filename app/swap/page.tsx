"use client";

import { Suspense } from "react";
import SwapCard from "@/components/SwapCard";

function SwapPageInner() {
    return (
        <main className="min-h-screen bg-[#0d0e14] text-white px-4 py-8">
            <div className="max-w-xl mx-auto flex justify-center">
                <SwapCard />
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
