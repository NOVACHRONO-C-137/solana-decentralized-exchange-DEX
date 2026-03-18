"use client";

import { useState } from "react";
import { TOKEN_GRADIENTS } from "@/lib/tokens";

interface TokenIconProps {
    symbol: string;
    logo?: string;
    size?: number;
    className?: string;
}

export default function TokenIcon({ symbol, logo, size = 28, className = "" }: TokenIconProps) {
    const [imgError, setImgError] = useState(false);
    const gradient = TOKEN_GRADIENTS[symbol] || "from-[#6B7280] to-[#9CA3AF]";

    if (logo && !imgError) {
        return (
            <div
                className={`rounded-full overflow-hidden border border-card flex-shrink-0 ${className}`}
                style={{ width: size, height: size }}
            >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={logo}
                    alt={symbol}
                    width={size}
                    height={size}
                    className="rounded-full object-cover w-full h-full"
                    onError={() => setImgError(true)}
                />
            </div>
        );
    }

    if (symbol === "SOL") {
        return (
            <div
                className={`rounded-full bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center flex-shrink-0 ${className}`}
                style={{ width: size, height: size }}
            >
                <svg viewBox="0 0 24 24" fill="none" style={{ width: size * 0.55, height: size * 0.55 }}>
                    <path d="M5.5 17.5L8.5 14.5H18.5L15.5 17.5H5.5Z" fill="white" stroke="white" strokeWidth="0.5" />
                    <path d="M5.5 6.5L8.5 9.5H18.5L15.5 6.5H5.5Z" fill="white" stroke="white" strokeWidth="0.5" />
                    <path d="M5.5 12L8.5 9H18.5L15.5 12H5.5Z" fill="white" stroke="white" strokeWidth="0.5" />
                </svg>
            </div>
        );
    }

    return (
        <div
            className={`rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center font-bold text-white flex-shrink-0 border border-card ${className}`}
            style={{ width: size, height: size, fontSize: size * 0.38 }}
        >
            {symbol ? symbol.charAt(0) : "?"}
        </div>
    );
}
