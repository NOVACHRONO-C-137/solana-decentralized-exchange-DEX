"use client";

interface SlippageSettingsProps {
    tab: "Auto" | "Custom";
    value: string;
    onTabChange: (tab: "Auto" | "Custom") => void;
    onValueChange: (value: string) => void;
}

export function SlippageSettings({ tab, value, onTabChange, onValueChange }: SlippageSettingsProps) {
    return (
        <>
            <div className="flex bg-secondary/40 dark:bg-secondary/40 dark:bg-black/30 border border-border rounded-xl p-1 mb-4">
                {(["Auto", "Custom"] as const).map((t) => (
                    <button
                        key={t}
                        onClick={() => onTabChange(t)}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                            tab === t
                                ? "bg-secondary dark:bg-[#0D9B5F]/15 text-foreground dark:bg-white/10 dark:text-white"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        {t}
                    </button>
                ))}
            </div>

            {tab === "Custom" && (
                <div className="relative">
                    <input
                        type="number"
                        value={value}
                        onChange={(e) => onValueChange(e.target.value)}
                        className="w-full bg-secondary/40 dark:bg-secondary/40 dark:bg-black/30 border border-border rounded-xl px-4 py-3 text-sm font-bold text-foreground outline-none focus:border-[var(--neon-teal)]/50 transition-all placeholder:text-muted-foreground/30"
                        placeholder="0.0"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">%</span>
                </div>
            )}

            {(parseFloat(value) > 5 || tab === "Auto") && (
                <p className="text-[10px] text-yellow-500/80 mt-3 text-center">
                    {tab === "Auto"
                        ? "Auto is set to 2.5% for Devnet pairs."
                        : "High slippage tolerance. Your transaction might be front-run."}
                </p>
            )}
        </>
    );
}
