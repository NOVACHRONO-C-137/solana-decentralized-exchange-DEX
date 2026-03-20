export function parseError(error: any): string {
    const message = error?.message || String(error);

    if (message.includes("429") || message.toLowerCase().includes("too many requests")) {
        return "The network is busy. Please wait a few seconds and try again.";
    }

    if (message.includes("User rejected")) {
        return "Transaction cancelled in wallet.";
    }

    if (message.includes("0x1") || message.includes("insufficient lamps") || message.toLowerCase().includes("insufficient funds")) {
        return "Insufficient SOL for transaction fees.";
    }

    if (message.includes("Slippage tolerance exceeded") || message.includes("Price impact too high")) {
        return "Price moved too fast or impact was too high. Try a smaller amount or higher slippage.";
    }

    if (message.includes("Simulation failed")) {
        return "Transaction simulation failed. This can happen if the pool liquidity is too low.";
    }

    return "Something went wrong. Please try again later.";
}
