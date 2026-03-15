"use client"

import { useState } from "react"
import { Menu, X, Wallet } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useWallet } from "@solana/wallet-adapter-react";
import { ConnectWalletModal } from "@/components/ConnectWalletModal";

const navLinks = [
    { label: "Swap", href: "/" },
    { label: "Dashboard", href: "/dashboard" },
    { label: "Liquidity", href: "/liquidity" },
    { label: "Get Test USDC", href: "#faucet" },
    { label: "Launch a Token", href: "#launch" },
]

export function Navbar() {
    const [mobileOpen, setMobileOpen] = useState(false)
    const pathname = usePathname()
    const [walletModalOpen, setWalletModalOpen] = useState(false);
    const { connected, publicKey, disconnect } = useWallet();

    const shortAddress = publicKey
        ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
        : null;


    return (
        <>
            <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/60 backdrop-blur-md supports-[backdrop-filter]:bg-background/40">
                <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 lg:px-6">
                    {/* Left — Brand Logo */}
                    <div className="flex items-center gap-2 shrink-0">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--neon-teal)]/10 border border-[var(--neon-teal)]/30">
                            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-[var(--neon-teal)]" aria-hidden="true">
                                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                        <span className="text-lg font-semibold tracking-tight text-foreground">AeroDEX</span>
                    </div>

                    {/* Center — Desktop Navigation */}
                    <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
                        {navLinks.map((link) => {
                            const isActive = pathname === link.href
                            return (
                                <Link
                                    key={link.label}
                                    href={link.href}
                                    className={`relative px-3.5 py-2 text-sm font-medium rounded-lg transition-colors ${isActive
                                        ? "text-[var(--neon-teal)] bg-[var(--neon-teal)]/8"
                                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"}`}
                                >
                                    {link.label}
                                    {isActive && (
                                        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-5 rounded-full bg-[var(--neon-teal)] shadow-[0_0_8px_var(--neon-teal-glow)]" />
                                    )}
                                </Link>
                            )
                        })}
                    </nav>

                    {/* Right */}
                    <div className="flex items-center gap-2.5 shrink-0">
                        <ThemeToggle />

                        {connected ? (
                            <div className="hidden sm:flex items-center gap-2">
                                <div className="flex items-center gap-2 rounded-lg border border-[var(--neon-teal)]/30 bg-[var(--neon-teal)]/5 px-3 py-2">
                                    <div className="w-2 h-2 rounded-full bg-[var(--neon-teal)] animate-pulse" />
                                    <span className="text-sm font-medium text-[var(--neon-teal)]">{shortAddress}</span>
                                </div>
                                <button
                                    onClick={disconnect}
                                    className="hidden sm:inline-flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
                                >
                                    Disconnect
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setWalletModalOpen(true)}
                                className="hidden sm:inline-flex items-center gap-2 rounded-lg bg-[var(--neon-teal)] px-4 py-2 text-sm font-semibold text-[#050505] transition-all hover:shadow-[0_0_20px_var(--neon-teal-glow)] hover:brightness-110 cursor-pointer"
                            >
                                <Wallet className="h-4 w-4" />
                                Connect Wallet
                            </button>
                        )}

                        <button
                            onClick={() => setMobileOpen(!mobileOpen)}
                            className="flex md:hidden h-9 w-9 items-center justify-center rounded-lg border border-border/50 bg-secondary/50 text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
                            aria-label="Toggle menu"
                        >
                            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                        </button>
                    </div>
                </div>

                {/* Mobile Navigation */}
                {mobileOpen && (
                    <div className="md:hidden border-t border-border/40 bg-background/80 backdrop-blur-md">
                        <nav className="flex flex-col px-4 py-3 gap-1">
                            {navLinks.map((link) => {
                                const isActive = pathname === link.href
                                return (
                                    <Link
                                        key={link.label}
                                        href={link.href}
                                        onClick={() => setMobileOpen(false)}
                                        className={`px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${isActive
                                            ? "text-[var(--neon-teal)] bg-[var(--neon-teal)]/8"
                                            : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"}`}
                                    >
                                        {link.label}
                                    </Link>
                                )
                            })}
                            {connected ? (
                                <button
                                    onClick={disconnect}
                                    className="mt-2 sm:hidden flex items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-2.5 text-sm font-medium text-red-400 transition-all"
                                >
                                    Disconnect {shortAddress}
                                </button>
                            ) : (
                                <button
                                    onClick={() => { setMobileOpen(false); setWalletModalOpen(true); }}
                                    className="mt-2 sm:hidden flex items-center justify-center gap-2 rounded-lg bg-[var(--neon-teal)] px-4 py-2.5 text-sm font-semibold text-[#050505] transition-all"
                                >
                                    <Wallet className="h-4 w-4" /> Connect Wallet
                                </button>
                            )}
                        </nav>
                    </div>
                )}
            </header>

            <ConnectWalletModal isOpen={walletModalOpen} onClose={() => setWalletModalOpen(false)} />
        </>
    )
}