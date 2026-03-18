const styles: Record<string, string> = {
    Concentrated: "bg-violet-500/20 text-violet-400",
    Standard: "bg-blue-500/20 text-blue-400",
    Legacy: "bg-orange-500/20 text-orange-400",
};

const labels: Record<string, string> = {
    Concentrated: "CLMM",
    Standard: "Standard",
    Legacy: "Legacy",
};

export function PoolTypeBadge({ type }: { type: string }) {
    const cls = styles[type] || "bg-secondary/50 text-muted-foreground";
    return (
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${cls}`}>
            {labels[type] || type}
        </span>
    );
}
