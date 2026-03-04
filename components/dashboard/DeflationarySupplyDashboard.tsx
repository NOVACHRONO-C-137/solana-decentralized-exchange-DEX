"use client"

import { useEffect, useState } from "react";

const BASE_SUPPLY = 999_945_230;
const BURN_TODAY = 54_770;

const DeflationarySupplyDashboard = () => {
    const [supply, setSupply] = useState(BASE_SUPPLY);

    useEffect(() => {
        const interval = setInterval(() => {
            setSupply((prev) => {
                const burn = Math.floor(Math.random() * 5) + 1;
                return Math.max(0, prev - burn);
            });
        }, 1200);
        return () => clearInterval(interval);
    }, []);

    const formatted = supply.toLocaleString("en-US");

    return (
        <div className="glass-card rounded-2xl p-8 md:p-10 counter-glow animate-fade-in">
            {/* Header */}
            <div className="flex items-center gap-3 mb-8">
                <div className="h-3 w-3 rounded-full bg-neon-teal animate-pulse-glow" />
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Deflationary Supply Dashboard
                </h2>
            </div>

            {/* Live Counter */}
            <div className="text-center space-y-3">
                <p className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
                    Live Total Supply
                </p>
                <p className="font-mono text-4xl sm:text-5xl md:text-6xl font-bold text-primary neon-glow-purple leading-none py-2">
                    {formatted}
                    <span className="text-neon-teal neon-glow-teal ml-3 text-2xl sm:text-3xl md:text-4xl font-semibold">
                        MCC
                    </span>
                </p>
            </div>

            {/* Divider */}
            <div className="my-8 h-px bg-border" />

            {/* Burned today */}
            <div className="flex items-center justify-center gap-3">
                <svg className="w-5 h-5 text-neon-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
                </svg>
                <p className="text-sm text-muted-foreground">
                    Total Burned Today:{" "}
                    <span className="font-mono font-semibold text-accent neon-glow-teal">
                        {BURN_TODAY.toLocaleString("en-US")} MCC
                    </span>
                </p>
            </div>
        </div>
    );
};

export default DeflationarySupplyDashboard;
