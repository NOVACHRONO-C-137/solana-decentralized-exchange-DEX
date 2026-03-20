import { Transaction, VersionedTransaction, Connection } from "@solana/web3.js";

export async function createWrappedSignAll(
    connection: Connection,
    signAllTransactions: (<T extends Transaction | VersionedTransaction>(txs: T[]) => Promise<T[]>) | undefined,
    onSig: (sig: string) => void
) {
    return async <T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> => {
        if (!signAllTransactions) throw new Error("Wallet does not support signAllTransactions");


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
            } catch { }
        }
        return signedTxs;
    };
}


export function slippageToBps(pct: number): number {
    return Math.round(pct * 100);
}
