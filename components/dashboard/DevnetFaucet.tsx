"use client"

import { useState } from "react";

const DevnetFaucet = () => {
    const [claimed, setClaimed] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleClaim = () => {
        setLoading(true);
        setTimeout(() => {
            setLoading(false);
            setClaimed(true);
            setTimeout(() => setClaimed(false), 3000);
        }, 1500);
    };

    return (
        <div className="glass-card rounded-2xl p-8 md:p-10 animate-fade-in" style={{ animationDelay: "0.15s" }}>
            <div className="flex items-center gap-3 mb-6">
                <div className="h-3 w-3 rounded-full bg-primary animate-pulse-glow" />
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Devnet Faucet
                </h2>
            </div>

            <p className="text-muted-foreground text-sm mb-8 max-w-md">
                Claim test tokens to explore the exchange on Solana Devnet. Tokens reset every 24 hours.
            </p>

            <button
                onClick={handleClaim}
                disabled={loading}
                className="w-full sm:w-auto px-10 py-4 rounded-xl font-semibold text-base
          bg-faucet-btn text-faucet-btn-foreground
          hover:opacity-90 active:scale-[0.98]
          transition-all duration-200 ease-out
          disabled:opacity-50 disabled:cursor-not-allowed
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
                {loading ? (
                    <span className="flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Claiming…
                    </span>
                ) : claimed ? (
                    <span className="flex items-center gap-2">
                        <svg className="h-5 w-5 text-neon-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        1,000 USDC Claimed!
                    </span>
                ) : (
                    "Get 1,000 Test USDC"
                )}
            </button>
        </div>
    );
};

export default DevnetFaucet;
