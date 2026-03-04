"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

export function ThemeToggle() {
    const { resolvedTheme, setTheme } = useTheme()
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) {
        return (
            <button
                className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border/50 bg-secondary/50 text-muted-foreground transition-colors"
                aria-label="Toggle theme"
            >
                <Sun className="h-4 w-4" />
            </button>
        )
    }

    return (
        <button
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border/50 bg-secondary/50 text-muted-foreground transition-all hover:text-foreground hover:border-[var(--neon-teal)]/40 hover:shadow-[0_0_12px_var(--neon-teal-glow)] cursor-pointer"
            aria-label="Toggle theme"
        >
            {resolvedTheme === "dark" ? (
                <Sun className="h-4 w-4 transition-transform" />
            ) : (
                <Moon className="h-4 w-4 transition-transform" />
            )}
        </button>
    )
}
