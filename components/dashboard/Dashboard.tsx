"use client"

import DeflationarySupplyDashboard from "./DeflationarySupplyDashboard";
import DevnetFaucet from "./DevnetFaucet";

export default function DashboardShell() {
    return (
        <div className="w-full flex flex-col gap-8 p-6 md:p-8 rounded-2xl border border-border/50 bg-background/50 backdrop-blur-md shadow-lg">

            {/* 1. The Shell Header */}
            <div className="flex flex-col gap-2 border-b border-border/50 pb-4">
                <h2 className="text-2xl font-bold tracking-tight text-foreground">
                    Aero DEX Control Center
                </h2>
                <p className="text-sm text-muted-foreground">
                    Monitor real-time deflationary burns and claim Devnet test tokens.
                </p>
            </div>

            {/* 2. The Shell Content (The Lovable UI Lego Blocks) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full items-start">
                <DeflationarySupplyDashboard />
                <DevnetFaucet />
            </div>

        </div>
    );
}