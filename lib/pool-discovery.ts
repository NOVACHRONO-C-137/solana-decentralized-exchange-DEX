import { PublicKey } from "@solana/web3.js";
import { DEVNET_PROGRAM_ID } from "@raydium-io/raydium-sdk-v2";

// ── Discover pool IDs from on-chain CLMM positions ───────
export async function discoverOnChainPoolIds(
    connection: any,
    walletPubkey: PublicKey
): Promise<string[]> {
    try {
        const CLMM_PROGRAM = DEVNET_PROGRAM_ID.CLMM_PROGRAM_ID;

        // Fetch all PersonalPosition accounts (size = 188 bytes) owned by the wallet
        // PersonalPosition layout: discriminator(8) + nftMint(32) + poolId(32) + ...
        // The poolId is at offset 40 (bytes 40-72)
        const accounts = await connection.getProgramAccounts(
            new PublicKey(CLMM_PROGRAM),
            {
                filters: [
                    { dataSize: 188 },  // PersonalPosition account size
                ]
            }
        );

        // Extract unique pool IDs from position accounts
        // PersonalPosition layout: discriminator(8) + nftMint(32) + poolId(32) + ...
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

// ── Discover pool IDs by scanning PoolState accounts ──────
// PoolState accounts have a creator field we can match
export async function discoverCreatedPools(
    connection: any,
    walletPubkey: PublicKey
): Promise<string[]> {
    try {
        const CLMM_PROGRAM = DEVNET_PROGRAM_ID.CLMM_PROGRAM_ID;
        const CPMM_PROGRAM = DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM;

        // PoolState accounts are 1544 bytes. The owner/creator is at offset 73.
        // Layout: discriminator(8) + bump(1) + ammConfig(32) + creator(32) + ...
        // So creator starts at offset 41
        const clmmPromise = connection.getProgramAccounts(
            new PublicKey(CLMM_PROGRAM),
            {
                filters: [
                    { dataSize: 1544 },  // PoolState account size
                    {
                        memcmp: {
                            offset: 41,  // creator field offset
                            bytes: walletPubkey.toBase58(),
                        }
                    }
                ]
            }
        );

        // CPMM pool size is 637 bytes. poolCreator is at offset 40.
        const cpmmPromise = connection.getProgramAccounts(
            new PublicKey(CPMM_PROGRAM),
            {
                filters: [
                    { dataSize: 637 },  // Cpmm Pool info size
                    {
                        memcmp: {
                            offset: 40,  // poolCreator field offset
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
