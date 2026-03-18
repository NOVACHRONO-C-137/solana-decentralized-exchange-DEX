"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import { useState } from "react";
import { X, WalletCards } from "lucide-react";

export function ConnectWalletModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const { wallets, select } = useWallet();
    const [showUninstalled, setShowUninstalled] = useState(false);

    // split into installed / loadable vs uninstalled
    const installedWallets = wallets.filter(
        (w) => w.readyState === WalletReadyState.Installed || w.readyState === WalletReadyState.Loadable
    );
    const uninstalledWallets = wallets.filter(
        (w) => w.readyState === WalletReadyState.NotDetected || w.readyState === WalletReadyState.Unsupported
    );

    const displayWallets = showUninstalled ? [...installedWallets, ...uninstalledWallets] : installedWallets;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            {/* The [&>button]:hidden removes the default UI dialog close X, so we can use our custom one */}
            <DialogContent className="bg-[rgba(220,240,232,0.72)] dark:bg-[rgba(255,255,255,0.02)] backdrop-blur-[6px] border border-black/[0.06] dark:border-[rgba(255,255,255,0.06)] shadow-[0_2px_16px_0_rgba(0,0,0,0.06)] text-foreground w-[95vw] sm:max-w-[420px] rounded-2xl [&>button]:hidden overflow-hidden p-0 gap-0">

                {/* Header */}
                <div className="flex items-center justify-between p-4 sm:p-6 pb-2 sm:pb-2">
                    <h2 className="text-[15px] sm:text-[17px] font-bold tracking-wide">Connect your wallet to NOVADEX</h2>
                    <button onClick={onClose} className="text-foreground/40 hover:text-foreground dark:text-white/40 dark:hover:text-white transition-colors cursor-pointer">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Main Content (Dislaimer & Wallets) */}
                <div className="px-4 sm:px-6 pb-4 sm:pb-6 pt-2">

                    {/* Disclaimer */}
                    <div className="mb-4 sm:mb-6">
                        <div className="bg-secondary/40 dark:bg-secondary/30 rounded-xl p-3 sm:p-4 text-[10px] sm:text-xs text-foreground/70 dark:text-white/60 leading-relaxed font-medium">
                            By connecting your wallet, you have acknowledged that you actually know how to use this DEX.
                        </div>
                    </div>

                    {/* Choose Wallet Title */}
                    <h3 className="font-bold text-[13px] sm:text-[15px] mb-3 sm:mb-4 tracking-wide text-foreground dark:text-white/90">Choose wallet</h3>

                    {/* Wallet Grid */}
                    <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-4 sm:mb-6 max-h-[240px] sm:max-h-[280px] overflow-y-auto pr-1 custom-scrollbar">
                        {displayWallets.length > 0 ? (
                            displayWallets.map((wallet) => (
                                <button
                                    key={wallet.adapter.name}
                                    onClick={() => {
                                        select(wallet.adapter.name);
                                        onClose();
                                    }}
                                    className="flex items-center gap-2 sm:gap-3 bg-secondary/40 dark:bg-black/20 hover:bg-[#92cdd4]/10 dark:hover:bg-[#7bb2b8]/10 border border-transparent hover:border-[#92cdd4]/50 dark:hover:border-[#7bb2b8]/50 p-2.5 sm:p-3.5 rounded-xl transition-all w-full text-left"
                                >
                                    <div className="w-6 h-6 sm:w-7 sm:h-7 shrink-0 bg-white/5 rounded-full flex items-center justify-center overflow-hidden">
                                        <img src={wallet.adapter.icon} alt={wallet.adapter.name} className="w-4 h-4 sm:w-5 sm:h-5 object-contain" />
                                    </div>
                                    <span className="font-bold text-xs sm:text-[13px] truncate">{wallet.adapter.name}</span>
                                    {wallet.readyState === WalletReadyState.Installed && (
                                        <span className="ml-auto text-[8px] sm:text-[10px] bg-[var(--neon-teal)]/10 text-[var(--neon-teal)] px-1 sm:px-1.5 py-0.5 rounded border border-[var(--neon-teal)]/20 whitespace-nowrap">Detected</span>
                                    )}
                                </button>
                            ))
                        ) : (
                            <div className="col-span-2 text-center text-foreground/40 dark:text-white/40 text-sm py-4 bg-secondary/40 dark:bg-secondary/20 rounded-xl">
                                No wallets detected. Try toggling "Show uninstalled wallets".
                            </div>
                        )}
                    </div>

                    {/* Toggle Show Uninstalled */}
                    <div className="flex items-center justify-between bg-secondary/40 dark:bg-secondary/20 p-3 sm:p-4 rounded-xl border border-transparent">
                        <span className="text-xs sm:text-[13px] font-semibold text-foreground dark:text-white/70 flex items-center gap-2">
                            <WalletCards className="w-4 h-4 text-foreground/40 dark:text-white/40" />
                            Show uninstalled wallets
                        </span>
                        <button
                            onClick={() => setShowUninstalled(!showUninstalled)}
                            className={`w-9 h-5 rounded-full transition-colors relative flex items-center ${showUninstalled ? 'bg-[var(--neon-teal)]' : 'bg-black/10 dark:bg-white/10'}`}
                        >
                            <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${showUninstalled ? 'translate-x-[18px]' : 'translate-x-[2px]'}`} />
                        </button>
                    </div>

                </div>

                {/* The "New here?" and MoonPay sections have been removed. */}

            </DialogContent>
        </Dialog>
    );
}