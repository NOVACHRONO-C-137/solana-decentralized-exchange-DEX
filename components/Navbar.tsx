"use client"

import { useState, useEffect } from "react"
import { Menu, X, Wallet } from "lucide-react"
import { useTheme } from "next-themes"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useWallet } from "@solana/wallet-adapter-react";
import { ConnectWalletModal } from "@/components/ConnectWalletModal";

const navLinks = [
    { label: "Swap", href: "/" },
    { label: "Dashboard", href: "/dashboard" },
    { label: "Liquidity", href: "/liquidity" },
]

export function Navbar() {
    const [mobileOpen, setMobileOpen] = useState(false)
    const pathname = usePathname()
    const { resolvedTheme, setTheme } = useTheme()
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

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
                        <div className="flex h-9 w-9 items-center justify-center">
                            <svg
                                className="h-9 w-9 text-[#0D9B5F] dark:text-[#14F195] transition-colors duration-200"
                                fill="currentColor"
                                version="1.1"
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 512 512"
                                enableBackground="new 0 0 512 512"
                            >
                                <g>
                                    <path display="inline" d="M489.893,354.61c-1.497-2.021-3.843-4.861-6.504-7.59c-27.663-28.39-48.33-61.907-59.479-99.042 c-0.503-1.732-1.019-3.452-1.472-5.182c-0.479-1.745-0.898-3.524-1.335-5.288c-8.899-37.706-7.814-77.089,2.004-115.486 c0,0,1.493-6.344,1.88-8.964c8.242-48.507-21.633-96.222-70.113-109.215C305.47-9.393,254.819,18.316,238.671,66.11 c-0.669,1.784-2.021,6.288-2.046,6.36c-10.625,37.641-29.076,71.826-55.15,99.8c-29.6,31.094-67.264,53.192-109.473,64.497 C20.573,250.551-9.979,303.506,3.81,354.951c13.794,51.433,66.666,81.978,118.123,68.179c38.404-9.801,77.79-10.907,115.499-1.996 c1.759,0.438,3.522,0.869,5.277,1.344c1.755,0.457,3.493,0.978,5.24,1.472c37.115,11.137,70.674,31.792,99.023,59.484 c3.484,3.484,6.495,5.938,9.307,7.917c38.108,29.044,92.336,26.814,127.089-7.917C518.632,448.177,520.67,392.478,489.893,354.61z M371.823,305.299c-13.498,50.347-65.247,80.234-115.606,66.731c-50.344-13.478-80.227-65.247-66.736-115.599 c13.494-50.35,65.247-80.227,115.591-66.738C355.435,203.189,385.318,254.936,371.823,305.299z" />
                                </g>
                            </svg>
                        </div>
                        <span
                            className="text-xl tracking-wide text-[#0a7a4a] dark:text-[#a3ffe3] transition-colors duration-200"
                            style={{ fontFamily: "var(--font-cagliostro)" }}
                        >
                            AeroDEX
                        </span>
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
                        {mounted && (
                            <button
                                onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-secondary/60 dark:hover:bg-white/10 transition-all"
                                aria-label="Toggle theme"
                            >
                                {/* Sun/flower — shown in dark mode */}
                                <span className="hidden dark:inline-flex">
                                    <svg height="22px" width="22px" viewBox="0 0 511.999 511.999" xmlns="http://www.w3.org/2000/svg">
                                        <g fill="#14F195" opacity="0.4">
                                            <path d="M172.752,27.264c0,0,36.179,16.549,47.962,48.892c5.194,14.273,4.779,29.225,2.691,41.498c-10.991,2.578-21.504,6.438-31.35,11.418c-9.494-8.073-19.429-19.253-24.622-33.525C155.662,63.191,172.752,27.264,172.752,27.264z" />
                                            <path d="M161.334,99.081c9.771,11.632,14.487,25.842,16.725,38.09c-9.331,6.124-17.894,13.33-25.515,21.441c-11.682-4.313-24.861-11.456-34.632-23.088c-22.145-26.383-18.372-65.995-18.372-65.995S139.189,72.698,161.334,99.081z" />
                                            <path d="M113.372,140.931c13.154,7.583,22.459,19.315,28.747,30.067c-6.64,8.878-12.261,18.548-16.687,28.86c-12.449-0.05-27.25-2.226-40.404-9.834c-29.828-17.228-39.838-55.733-39.838-55.733S83.556,123.715,113.372,140.931z" />
                                            <path d="M82.613,196.651c14.952,2.628,27.703,10.463,37.285,18.41c-3.156,10.488-5.131,21.478-5.759,32.846c-11.72,4.188-26.395,7.218-41.36,4.565c-33.915-5.973-56.5-38.732-56.5-38.732S48.71,190.678,82.613,196.651z" />
                                            <path d="M72.779,259.54c14.964-2.653,29.64,0.365,41.36,4.565c0.629,11.355,2.603,22.346,5.759,32.846c-9.582,7.935-22.334,15.769-37.285,18.41c-33.903,5.973-66.334-17.102-66.334-17.102S38.864,265.513,72.779,259.54z" />
                                            <path d="M85.028,321.976c13.154-7.595,27.955-9.771,40.404-9.834c4.426,10.324,10.06,19.982,16.687,28.873c-6.288,10.739-15.593,22.459-28.747,30.055c-29.816,17.215-68.183,6.627-68.183,6.627S55.199,339.191,85.028,321.976z" />
                                            <path d="M152.544,353.389c7.621,8.111,16.184,15.317,25.515,21.428c-2.238,12.248-6.954,26.458-16.725,38.103c-22.145,26.383-61.794,29.552-61.794,29.552s-3.773-39.612,18.372-65.982C127.683,364.845,140.861,357.702,152.544,353.389z" />
                                            <path d="M192.055,382.928c9.846,4.98,20.359,8.828,31.35,11.406c2.087,12.273,2.502,27.225-2.691,41.498c-11.783,32.356-47.962,48.905-47.962,48.905s-17.09-35.927-5.319-68.296C172.626,402.168,182.561,391.001,192.055,382.928z" />
                                            <path d="M272.662,397.112c6.162,10.84,11.682,24.748,11.682,39.939c0,34.456-28.344,62.373-28.344,62.373s-28.344-27.917-28.344-62.373c0-15.191,5.52-29.099,11.682-39.939c5.458,0.654,11.028,0.981,16.662,0.981C261.634,398.093,267.204,397.766,272.662,397.112z" />
                                            <path d="M344.567,416.441c11.783,32.369-5.307,68.296-5.307,68.296s-36.179-16.549-47.962-48.905c-5.194-14.273-4.779-29.225-2.704-41.498c11.003-2.578,21.504-6.426,31.35-11.418C329.426,390.976,339.361,402.168,344.567,416.441z" />
                                            <path d="M359.456,353.389c11.682,4.313,24.874,11.456,34.645,23.101c22.145,26.37,18.372,65.982,18.372,65.982s-39.662-3.169-61.794-29.552c-9.771-11.645-14.499-25.855-16.725-38.103C343.284,368.705,351.848,361.5,359.456,353.389z" />
                                            <path d="M386.568,312.142c12.449,0.063,27.25,2.238,40.404,9.834c29.841,17.215,39.838,55.721,39.838,55.721s-38.354,10.588-68.183-6.627c-13.154-7.595-22.459-19.315-28.747-30.055C376.508,332.124,382.142,322.466,386.568,312.142z" />
                                            <path d="M439.233,259.54c33.915,5.973,56.488,38.719,56.488,38.719s-32.419,23.075-66.334,17.102c-14.952-2.641-27.716-10.5-37.285-18.423c3.156-10.5,5.131-21.491,5.759-32.834C409.581,259.905,424.268,256.887,439.233,259.54z" />
                                            <path d="M495.721,213.741c0,0-22.572,32.758-56.488,38.732c-14.964,2.653-29.652-0.377-41.372-4.565c-0.629-11.355-2.59-22.359-5.759-32.834c9.57-7.935,22.334-15.794,37.285-18.423C463.302,190.678,495.721,213.741,495.721,213.741z" />
                                            <path d="M398.628,140.931c29.828-17.215,68.183-6.64,68.183-6.64s-9.997,38.505-39.838,55.733c-13.154,7.608-27.955,9.783-40.404,9.834c-4.426-10.312-10.048-19.982-16.687-28.86C376.168,160.246,385.474,148.514,398.628,140.931z" />
                                            <path d="M412.473,69.529c0,0,3.773,39.612-18.372,65.995c-9.771,11.632-22.962,18.775-34.645,23.088c-7.608-8.111-16.172-15.291-25.502-21.441c2.226-12.248,6.954-26.458,16.725-38.09C372.811,72.698,412.473,69.529,412.473,69.529z" />
                                            <path d="M339.26,27.264c0,0,17.09,35.927,5.307,68.283c-5.206,14.273-15.141,25.465-24.622,33.538c-9.846-4.992-20.347-8.853-31.35-11.431c-2.075-12.273-2.49-27.225,2.704-41.498C303.081,43.813,339.26,27.264,339.26,27.264z" />
                                            <path d="M256,12.576c0,0,28.344,27.917,28.344,62.373c0,15.191-5.521,29.112-11.682,39.926c-5.458-0.654-11.028-0.981-16.662-0.981c-5.634,0-11.204,0.327-16.662,0.981c-6.162-10.815-11.682-24.735-11.682-39.926C227.655,40.493,256,12.576,256,12.576z" />
                                        </g>
                                        <path style={{ fill: "#0D9B5F" }} d="M256,113.894c5.634,0,11.204,0.327,16.662,0.981c5.407,0.616,10.727,1.559,15.933,2.779c11.003,2.578,21.504,6.438,31.35,11.431c4.841,2.414,9.519,5.131,14.009,8.086c9.331,6.149,17.895,13.33,25.502,21.441c3.71,3.911,7.193,8.061,10.425,12.387c6.64,8.878,12.261,18.548,16.687,28.86c2.138,4.929,3.986,10.022,5.533,15.216c3.169,10.475,5.131,21.478,5.759,32.834c0.163,2.666,0.239,5.37,0.239,8.086c0,2.716-0.075,5.445-0.239,8.111c-0.629,11.343-2.603,22.334-5.759,32.834c-1.547,5.194-3.408,10.274-5.533,15.203c-4.426,10.324-10.06,19.982-16.687,28.873c-3.244,4.313-6.715,8.463-10.425,12.374c-7.608,8.111-16.172,15.317-25.502,21.428c-4.489,2.955-9.167,5.671-14.009,8.098c-9.846,4.992-20.347,8.84-31.35,11.418c-5.206,1.22-10.525,2.163-15.933,2.779c-5.458,0.654-11.028,0.981-16.662,0.981c-5.634,0-11.204-0.327-16.662-0.981c-5.407-0.616-10.727-1.559-15.933-2.779c-10.991-2.578-21.504-6.426-31.35-11.406c-4.829-2.44-9.507-5.156-13.996-8.111c-9.331-6.112-17.894-13.317-25.515-21.428c-3.71-3.911-7.18-8.061-10.425-12.374c-6.627-8.891-12.261-18.548-16.687-28.873c-2.125-4.929-3.986-10.01-5.533-15.191c-3.156-10.5-5.131-21.491-5.759-32.846c-0.163-2.666-0.239-5.395-0.239-8.111c0-2.716,0.075-5.42,0.239-8.086c0.629-11.368,2.603-22.359,5.759-32.846c1.547-5.194,3.408-10.274,5.533-15.203c4.426-10.312,10.048-19.982,16.687-28.86c3.232-4.326,6.715-8.476,10.425-12.387c7.621-8.111,16.184-15.317,25.515-21.441c4.489-2.955,9.167-5.671,13.996-8.098c9.846-4.98,20.359-8.84,31.35-11.418c5.206-1.22,10.525-2.163,15.933-2.779C244.795,114.221,250.366,113.894,256,113.894z" />
                                    </svg>
                                </span>

                                {/* Moon — shown in light mode */}
                                <span className="inline-flex dark:hidden">
                                    <svg viewBox="0 0 1024 1024" width="22px" height="22px" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M445.3888 611.09248m-308.47488 0a308.47488 308.47488 0 1 0 616.94976 0 308.47488 308.47488 0 1 0-616.94976 0Z" fill="#0D9B5F" opacity="0.15" />
                                        <path d="M445.39392 927.28832c-174.35648 0-316.19584-141.83936-316.19584-316.19584s141.83936-316.19584 316.19584-316.19584 316.19584 141.83936 316.19584 316.19584-141.83936 316.19584-316.19584 316.19584z m0-616.95488c-165.83168 0-300.75392 134.92224-300.75392 300.75392s134.92224 300.75392 300.75392 300.75392 300.75392-134.92224 300.75392-300.75392-134.92224-300.75392-300.75392-300.75392z" fill="#0a7a4a" />
                                        <path d="M543.0272 328.09472c96.59392 49.50016 137.47712 165.22752 124.61056 280.50432-28.07296 251.58656-325.77024 278.72768-355.61984 268.71808a297.38496 297.38496 0 0 0 136.01792 32.78848c165.00224 0 298.76224-133.76 298.76224-298.76224 0-131.77856-85.36064-243.54816-203.77088-283.24864z" fill="#0D9B5F" opacity="0.5" />
                                        <path d="M337.26464 186.14272m-81.7152 0a81.7152 81.7152 0 1 0 163.4304 0 81.7152 81.7152 0 1 0-163.4304 0Z" fill="#0D9B5F" opacity="0.2" />
                                        <path d="M337.26976 275.57376c-49.32096 0-89.43616-40.1152-89.43616-89.43616 0-49.31072 40.1152-89.42592 89.43616-89.42592s89.43616 40.1152 89.43616 89.42592c0 49.32096-40.1152 89.43616-89.43616 89.43616z m0-163.41504c-40.79616 0-73.99424 33.18784-73.99424 73.984s33.19808 73.99424 73.99424 73.99424 73.99424-33.19808 73.99424-73.99424-33.19808-73.984-73.99424-73.984z" fill="#0a7a4a" />
                                        <path d="M383.17056 232.1408c26.31168-5.8112 53.56544-9.10336 81.62816-9.10336 208.33792 0 377.23136 168.89344 377.23136 377.23136 0 115.79392-52.28032 219.27936-134.4 288.47616l10.496 21.248c89.61024-73.38496 146.82112-184.86272 146.82112-309.72416 0-220.99968-179.15392-400.1536-400.1536-400.1536a401.0496 401.0496 0 0 0-92.12416 10.7776l10.50112 21.248z" fill="#0a7a4a" />
                                        <path d="M323.57376 702.87872c-20.70016 0-37.53984-16.83968-37.53984-37.53984 0-20.70016 16.83968-37.53984 37.53984-37.53984s37.53984 16.83968 37.53984 37.53984c0 20.70016-16.83968 37.53984-37.53984 37.53984z" fill="#0D9B5F" />
                                        <path d="M501.01248 649.30304a19.328 19.328 0 0 1-19.3024-19.3024 19.32288 19.32288 0 0 1 19.3024-19.29216 19.31264 19.31264 0 0 1 19.29216 19.29216c0 10.63936-8.6528 19.3024-19.29216 19.3024z" fill="#0D9B5F" />
                                        <path d="M677.2992 629.33504c-17.73056 0-32.1536-14.4384-32.1536-32.16896s14.42304-32.16896 32.1536-32.16896 32.16896 14.4384 32.16896 32.16896-14.4384 32.16896-32.16896 32.16896z" fill="#0D9B5F" />
                                    </svg>
                                </span>
                            </button>
                        )}

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