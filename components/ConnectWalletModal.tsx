"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import { useState } from "react";
import { X, WalletCards, CreditCard } from "lucide-react";

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
            <DialogContent className="bg-[#1b1d28] text-white border border-white/10 sm:max-w-[480px] p-0 shadow-2xl rounded-[20px] overflow-hidden font-sans [&>button]:hidden">

                {/* Header */}
                <div className="flex items-center justify-between p-6 pb-4">
                    <h2 className="text-[17px] font-bold tracking-wide">Connect your wallet to AeroDEX</h2>
                    <button onClick={onClose} className="text-white/40 hover:text-white transition-colors cursor-pointer">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Disclaimer */}
                <div className="px-6 mb-5">
                    <div className="bg-[#2a2c3c] rounded-xl p-4 text-xs text-white/60 leading-relaxed font-medium">
                        By connecting your wallet, you acknowledge that you have read,
                        understand and accept the terms in the <a href="#" className="text-[var(--neon-teal)] hover:underline font-bold">disclaimer</a>
                    </div>
                </div>

                {/* Wallets Section */}
                <div className="px-6 pb-6">
                    <h3 className="font-bold text-[15px] mb-4 tracking-wide text-white/90">Choose wallet</h3>

                    {/* Wallet Grid */}
                    <div className="grid grid-cols-2 gap-3 mb-5 max-h-[280px] overflow-y-auto pr-1 custom-scrollbar">
                        {displayWallets.length > 0 ? (
                            displayWallets.map((wallet) => (
                                <button
                                    key={wallet.adapter.name}
                                    onClick={() => {
                                        select(wallet.adapter.name);
                                        onClose();
                                    }}
                                    className="flex items-center gap-3 bg-[#13141f] hover:bg-white/5 border border-transparent hover:border-white/10 p-3.5 rounded-xl transition-all w-full text-left"
                                >
                                    <div className="w-7 h-7 shrink-0 bg-white/5 rounded-full flex items-center justify-center overflow-hidden">
                                        <img src={wallet.adapter.icon} alt={wallet.adapter.name} className="w-5 h-5 object-contain" />
                                    </div>
                                    <span className="font-bold text-[13px] truncate">{wallet.adapter.name}</span>
                                    {wallet.readyState === WalletReadyState.Installed && (
                                        <span className="ml-auto text-[10px] bg-[var(--neon-teal)]/10 text-[var(--neon-teal)] px-1.5 py-0.5 rounded border border-[var(--neon-teal)]/20 whitespace-nowrap">Detected</span>
                                    )}
                                </button>
                            ))
                        ) : (
                            <div className="col-span-2 text-center text-white/40 text-sm py-4 bg-[#13141f] rounded-xl">
                                No wallets detected. Try toggling "Show uninstalled wallets".
                            </div>
                        )}
                    </div>

                    {/* Toggle Show Uninstalled */}
                    <div className="flex items-center justify-between bg-[#13141f] p-4 rounded-xl mb-3 border border-transparent">
                        <span className="text-[13px] font-semibold text-white/70 flex items-center gap-2">
                            <WalletCards className="w-4 h-4 text-white/40" />
                            Show uninstalled wallets
                        </span>
                        <button
                            onClick={() => setShowUninstalled(!showUninstalled)}
                            className={`w-9 h-5 rounded-full transition-colors relative flex items-center ${showUninstalled ? 'bg-[var(--neon-teal)]' : 'bg-white/10'}`}
                        >
                            <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${showUninstalled ? 'translate-x-[18px]' : 'translate-x-[2px]'}`} />
                        </button>
                    </div>

                    {/* Get Started */}
                    <button className="flex items-center justify-between w-full bg-[#13141f] p-4 rounded-xl text-sm transition-colors hover:bg-white/5 border border-transparent hover:border-white/10 group">
                        <span className="font-bold text-[13px] text-white/70 flex items-center gap-2">
                            <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 text-white/40"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" /><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M12 16v.01M12 8v4" /></svg>
                            New here?
                        </span>
                        <span className="text-[var(--neon-teal)] font-bold text-[13px] group-hover:underline flex items-center gap-1">
                            Get started on AeroDEX <span className="text-base leading-none mb-0.5 ml-0.5">›</span>
                        </span>
                    </button>
                </div>

                {/* Footer Buy Crypto */}
                <div className="bg-[#13141f] p-4 text-center text-xs text-white/40 border-t border-white/5 font-bold flex items-center justify-center gap-1.5 cursor-pointer hover:text-white transition-colors">
                    Buy Crypto with fiat <span className="flex items-center text-white/80 ml-1"><div className="w-2.5 h-2.5 rounded-full bg-purple-500 mr-1.5" />MoonPay</span> <span className="text-sm">›</span>
                </div>
            </DialogContent>
        </Dialog>
    );
}
