import { PublicKey } from "@solana/web3.js";
import { DEVNET_PROGRAM_ID } from "@raydium-io/raydium-sdk-v2";


export async function discoverOnChainPoolIds(
    connection: any,
    walletPubkey: PublicKey
): Promise<string[]> {
    try {
        const CLMM_PROGRAM = DEVNET_PROGRAM_ID.CLMM_PROGRAM_ID;

        const accounts = await connection.getProgramAccounts(
            new PublicKey(CLMM_PROGRAM),
            {
                filters: [
                    { dataSize: 188 },
                ]
            }
        );


        const poolIds = new Set<string>();
        for (const { account } of accounts) {
            try {
                const poolIdBytes = account.data.subarray(40, 72);
                const poolId = new PublicKey(poolIdBytes).toBase58();
                poolIds.add(poolId);
            } catch { /* skip malformed accounts */ }
        }

        return Array.from(poolIds);
    } catch (err) {
        return [];
    }
}


export async function discoverCreatedPools(
    connection: any,
    walletPubkey: PublicKey
): Promise<string[]> {
    try {
        const CLMM_PROGRAM = DEVNET_PROGRAM_ID.CLMM_PROGRAM_ID;
        const CPMM_PROGRAM = DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM;


        const clmmPromise = connection.getProgramAccounts(
            new PublicKey(CLMM_PROGRAM),
            {
                filters: [
                    { dataSize: 1544 },
                    {
                        memcmp: {
                            offset: 41,
                            bytes: walletPubkey.toBase58(),
                        }
                    }
                ]
            }
        );

        const cpmmPromise = connection.getProgramAccounts(
            new PublicKey(CPMM_PROGRAM),
            {
                filters: [
                    { dataSize: 637 },
                    {
                        memcmp: {
                            offset: 40,
                            bytes: walletPubkey.toBase58(),
                        }
                    }
                ]
            }
        );

        const [clmmAccounts, cpmmAccounts] = await Promise.all([
            clmmPromise.catch(() => []),
            cpmmPromise.catch(() => [])
        ]);

        const poolIds = [
            ...clmmAccounts.map(({ pubkey }: any) => pubkey.toBase58()),
            ...cpmmAccounts.map(({ pubkey }: any) => pubkey.toBase58())
        ];

        return poolIds;
    } catch (err) {
        return [];
    }
}
