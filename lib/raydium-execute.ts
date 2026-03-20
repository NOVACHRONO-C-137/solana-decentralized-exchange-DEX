import { Transaction, VersionedTransaction, Connection } from "@solana/web3.js";

/**
 * Shared Raydium transaction executor.
 * Signs all txs via wallet's signAllTransactions, sends manually,
 * then returns signed txs back to SDK so it doesn't crash on serialize.
 */
export async function createWrappedSignAll(
    connection: Connection,
    signAllTransactions: (<T extends Transaction | VersionedTransaction>(txs: T[]) => Promise<T[]>) | undefined,
    onSig: (sig: string) => void
) {
    return async <T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> => {
        if (!signAllTransactions) throw new Error("Wallet does not support signAllTransactions");
        // signing

        const signedTxs = await signAllTransactions(txs);
        for (const tx of signedTxs) {
            try {
                const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
                let rawTx: Buffer;
                if (tx instanceof Transaction) {
                    rawTx = tx.serialize();
                } else {
                    // VersionedTransaction
                    rawTx = Buffer.from((tx as VersionedTransaction).serialize());
                }
                const sig = await connection.sendRawTransaction(rawTx, { skipPreflight: true });
                // sent
                await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
                onSig(sig);
            } catch (e) {
                console.error(e);
            }
        }
        return signedTxs; // return signed so SDK doesn't crash
    };
}

/** Converts a slippage percentage (e.g. 2.5) to integer basis points (250) */
export function slippageToBps(pct: number): number {
    return Math.round(pct * 100);
}
