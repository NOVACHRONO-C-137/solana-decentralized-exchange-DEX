"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface CopyButtonProps {
    text: string;
    className?: string;
}

export function CopyButton({ text, className = "" }: CopyButtonProps) {
    const [copied, setCopied] = useState(false);

    const copy = () => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <button
            onClick={copy}
            className={`p-1 hover:bg-secondary/60 dark:hover:bg-white/10 rounded transition-all ${className}`}
        >
            {copied
                ? <Check className="w-3.5 h-3.5 text-[var(--neon-teal)]" />
                : <Copy className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
            }
        </button>
    );
}
