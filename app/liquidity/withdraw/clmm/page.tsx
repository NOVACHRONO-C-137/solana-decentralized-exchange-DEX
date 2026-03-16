"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, Construction } from "lucide-react";

export default function WithdrawCLMMPage() {
    const router = useRouter();
    return (
        <main className="container mx-auto px-4 py-12 max-w-lg text-foreground">
            <button onClick={() => router.back()}
                className="flex items-center text-muted-foreground hover:text-foreground transition-colors mb-6">
                <ChevronLeft className="h-5 w-5 mr-1" /> Back
            </button>
            <div className="bg-card border border-border rounded-2xl p-10 flex flex-col items-center text-center gap-4">
                <Construction className="w-12 h-12 text-[var(--neon-teal)]" />
                <h2 className="text-xl font-bold">CLMM Withdraw Coming Soon</h2>
                <p className="text-sm text-muted-foreground max-w-xs">
                    CLMM position withdrawal requires fetching your position NFTs on-chain. This feature is being built. Use the Raydium devnet interface in the meantime.
                </p>
                <a href="https://devnet.raydium.io/liquidity/" target="_blank" rel="noopener noreferrer"
                    className="px-4 py-2 rounded-xl bg-[var(--neon-teal)]/10 text-[var(--neon-teal)] text-sm font-semibold hover:bg-[var(--neon-teal)]/20 transition-all border border-[var(--neon-teal)]/20">
                    Open Raydium Devnet
                </a>
            </div>
        </main>
    );
}