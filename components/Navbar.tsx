"use client"

import { useState } from "react"
import { Menu, X, Wallet, Settings, Check } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useWallet } from "@solana/wallet-adapter-react";
import { ConnectWalletModal } from "@/components/ConnectWalletModal";

const navLinks = [
    { label: "Swap", href: "/" },
    { label: "Dashboard", href: "/dashboard" },
    { label: "Liquidity", href: "/liquidity" },
    { label: "Get Test USDC", href: "#faucet" },
    { label: "Launch a Token", href: "#launch" },
]

const EXPLORERS = ["Solscan", "Orb", "Explorer", "SolanaFM"]
const LANGUAGES = ["English", "中文", "Español", "日本語", "한국어"]
const RPC_OPTIONS = ["Triton", "Helius", "Custom"]

function SettingsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const [swapSlippage, setSwapSlippage] = useState<string>("0.5")
    const [customSwapSlippage, setCustomSwapSlippage] = useState<string>("0.5")
    const [liqSlippage, setLiqSlippage] = useState<string>("2.5")
    const [customLiqSlippage, setCustomLiqSlippage] = useState<string>("2.5")
    const [versionedTx, setVersionedTx] = useState<boolean>(true)
    const [devnet, setDevnet] = useState<boolean>(false)
    const [explorer, setExplorer] = useState<string>("Solscan")
    const [language, setLanguage] = useState<string>("English")
    const [rpc, setRpc] = useState<string>("Triton")
    const [langOpen, setLangOpen] = useState<boolean>(false)

    const now = new Date()
    const dateStr = `${now.getMonth() + 1}/${now.getDate()}/${String(now.getFullYear()).slice(2)} ${now.getHours()}:${now.getMinutes()} UTC`

    const SlippageSelector = ({
        label,
        presets,
        value,
        customValue,
        onPreset,
        onCustom,
    }: {
        label: string
        presets: string[]
        value: string
        customValue: string
        onPreset: (v: string) => void
        onCustom: (v: string) => void
    }) => (
        <div>
            <p className="text-sm font-medium text-white mb-3 flex items-center gap-1">
                {label}
                <span className="text-white/30 text-xs cursor-pointer hover:text-white ml-1">ⓘ</span>
            </p>
            <div className="flex items-center gap-2 flex-wrap">
                {presets.map((p) => (
                    <button
                        key={p}
                        onClick={() => { onPreset(p); onCustom(p); }}
                        className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${value === p
                            ? "border-[var(--neon-teal)] bg-[var(--neon-teal)]/10 text-[var(--neon-teal)]"
                            : "border-white/10 text-white/50 hover:border-white/20 hover:text-white"}`}
                    >
                        {p}%
                    </button>
                ))}
                <div className="flex items-center gap-2 ml-auto">
                    <span className="text-xs text-white/40">Custom</span>
                    <div className="flex items-center bg-black/40 border border-white/10 rounded-xl overflow-hidden">
                        <input
                            type="number"
                            value={customValue}
                            onChange={(e) => { onCustom(e.target.value); onPreset(e.target.value); }}
                            className="bg-transparent text-white text-sm font-bold w-14 px-3 py-1.5 outline-none text-right"
                        />
                        <span className="text-white/40 text-sm pr-3">%</span>
                    </div>
                </div>
            </div>
        </div>
    )

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-[#11121a] text-white border-white/10 sm:max-w-[500px] p-6 shadow-2xl rounded-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold">Settings</DialogTitle>
                </DialogHeader>

                <div className="flex flex-col gap-6 mt-4">

                    {/* Swap slippage */}
                    <SlippageSelector
                        label="Swap slippage tolerance"
                        presets={["0.1", "0.5", "1"]}
                        value={swapSlippage}
                        customValue={customSwapSlippage}
                        onPreset={setSwapSlippage}
                        onCustom={setCustomSwapSlippage}
                    />

                    <div className="h-px bg-white/5" />

                    {/* Liquidity slippage */}
                    <SlippageSelector
                        label="Liquidity slippage tolerance"
                        presets={["1", "2.5", "3.5"]}
                        value={liqSlippage}
                        customValue={customLiqSlippage}
                        onPreset={setLiqSlippage}
                        onCustom={setCustomLiqSlippage}
                    />

                    <div className="h-px bg-white/5" />

                    {/* Versioned Transaction */}
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium flex items-center gap-1">
                            Versioned Transaction
                            <span className="text-white/30 text-xs cursor-pointer hover:text-white ml-1">ⓘ</span>
                        </p>
                        <button
                            onClick={() => setVersionedTx(!versionedTx)}
                            className={`w-12 h-6 rounded-full border transition-all relative ${versionedTx ? "bg-[var(--neon-teal)] border-[var(--neon-teal)]" : "bg-white/10 border-white/10"}`}
                        >
                            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${versionedTx ? "left-6" : "left-0.5"}`} />
                        </button>
                    </div>

                    <div className="h-px bg-white/5" />

                    {/* Default Explorer */}
                    <div>
                        <p className="text-sm font-medium mb-3 flex items-center gap-1">
                            Default Explorer
                            <span className="text-white/30 text-xs cursor-pointer hover:text-white ml-1">ⓘ</span>
                        </p>
                        <div className="flex gap-2 flex-wrap">
                            {EXPLORERS.map((e) => (
                                <button
                                    key={e}
                                    onClick={() => setExplorer(e)}
                                    className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${explorer === e
                                        ? "border-[var(--neon-teal)] bg-[var(--neon-teal)]/10 text-[var(--neon-teal)]"
                                        : "border-white/10 text-white/50 hover:border-white/20 hover:text-white"}`}
                                >
                                    {e}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="h-px bg-white/5" />

                    {/* Language */}
                    <div className="flex items-center justify-between relative">
                        <p className="text-sm font-medium flex items-center gap-1">
                            Language
                            <span className="text-white/30 text-xs cursor-pointer hover:text-white ml-1">ⓘ</span>
                        </p>
                        <button
                            onClick={() => setLangOpen(!langOpen)}
                            className="flex items-center gap-2 bg-black/30 border border-white/10 hover:border-white/20 rounded-xl px-4 py-2 text-sm font-medium transition-all"
                        >
                            {language}
                            <span className="text-white/40">▾</span>
                        </button>
                        {langOpen && (
                            <div className="absolute top-full right-0 mt-1 bg-[#0f1421] border border-white/10 rounded-xl overflow-hidden z-50 w-40">
                                {LANGUAGES.map((l) => (
                                    <div
                                        key={l}
                                        onClick={() => { setLanguage(l); setLangOpen(false); }}
                                        className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-white/5 text-sm transition-all"
                                    >
                                        <span className={language === l ? "text-[var(--neon-teal)]" : "text-white/70"}>{l}</span>
                                        {language === l && <Check className="h-3.5 w-3.5 text-[var(--neon-teal)]" />}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="h-px bg-white/5" />

                    {/* Color Theme */}
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">Color Theme</p>
                        <div className="flex bg-black/30 border border-white/10 rounded-xl overflow-hidden">
                            <button className="flex items-center gap-1.5 px-4 py-2 bg-[var(--neon-teal)]/10 text-[var(--neon-teal)] text-sm font-medium">
                                🌙
                            </button>
                            <button className="flex items-center gap-1.5 px-4 py-2 text-white/40 hover:text-white text-sm font-medium transition-all">
                                ☀️
                            </button>
                        </div>
                    </div>

                    <div className="h-px bg-white/5" />

                    {/* Devnet */}
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">Devnet</p>
                        <button
                            onClick={() => setDevnet(!devnet)}
                            className={`w-12 h-6 rounded-full border transition-all relative ${devnet ? "bg-[var(--neon-teal)] border-[var(--neon-teal)]" : "bg-white/10 border-white/10"}`}
                        >
                            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${devnet ? "left-6" : "left-0.5"}`} />
                        </button>
                    </div>

                    <div className="h-px bg-white/5" />

                    {/* RPC Connection */}
                    <div>
                        <p className="text-sm font-medium mb-3 flex items-center gap-1">
                            RPC Connection
                            <span className="text-white/30 text-xs cursor-pointer hover:text-white ml-1">ⓘ</span>
                        </p>
                        <div className="flex gap-2 mb-3">
                            {RPC_OPTIONS.map((r) => (
                                <button
                                    key={r}
                                    onClick={() => setRpc(r)}
                                    className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${rpc === r
                                        ? "border-[var(--neon-teal)] bg-[var(--neon-teal)]/10 text-[var(--neon-teal)]"
                                        : "border-white/10 text-white/50 hover:border-white/20 hover:text-white"}`}
                                >
                                    {r}
                                </button>
                            ))}
                        </div>
                        <input
                            type="text"
                            defaultValue="https://aero-dex-frontend.rpcpool.com/"
                            className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white/60 outline-none focus:border-white/20 transition-all"
                        />
                    </div>

                    {/* Version */}
                    <div className="text-xs text-white/20 pt-2">
                        <p>V1.0.0</p>
                        <p>{dateStr}</p>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

export function Navbar() {
    const [mobileOpen, setMobileOpen] = useState(false)
    const [settingsOpen, setSettingsOpen] = useState(false)
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

                        {/* Settings icon */}
                        <button
                            onClick={() => setSettingsOpen(true)}
                            className="hidden sm:flex h-9 w-9 items-center justify-center rounded-lg border border-border/50 bg-secondary/50 text-muted-foreground transition-colors hover:text-foreground hover:border-border cursor-pointer"
                            aria-label="Settings"
                        >
                            <Settings className="h-4 w-4" />
                        </button>

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
                            <button
                                onClick={() => { setMobileOpen(false); setSettingsOpen(true); }}
                                className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
                            >
                                <Settings className="h-4 w-4" /> Settings
                            </button>
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

            <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
            <ConnectWalletModal isOpen={walletModalOpen} onClose={() => setWalletModalOpen(false)} />
        </>
    )
}