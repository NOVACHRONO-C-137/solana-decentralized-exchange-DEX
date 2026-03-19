"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { TokenInfo } from "@/components/liquidity/TokenSelectorModal";

export interface TokenBalance {
    mint: string;
    balance: number;       // human-readable (already divided by decimals)
    rawBalance: bigint;    // raw lamports/base units
    decimals: number;
}

// Metaplex Token Metadata Program ID
const METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

/**
 * Derive the Metaplex metadata PDA for a given mint.
 */
function getMetadataPDA(mint: PublicKey): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
        [
            Buffer.from("metadata"),
            METADATA_PROGRAM_ID.toBuffer(),
            mint.toBuffer(),
        ],
        METADATA_PROGRAM_ID
    );
    return pda;
}

/**
 * Parse raw Metaplex metadata account data into name, symbol, and URI.
 */
function parseMetaplexMetadata(data: Buffer): { name: string; symbol: string; uri: string } | null {
    try {
        // key (1) + update_authority (32) + mint (32) = 65
        let offset = 65;

        // Name: 4-byte length prefix + actual string
        // BUT advance by MAX name length (32), not actual length
        const nameLen = data.readUInt32LE(offset);
        offset += 4;
        const name = data.slice(offset, offset + nameLen).toString("utf-8").replace(/\0/g, "").trim();
        offset += 32; // ← MAX name length (not nameLen!)

        // Symbol: 4-byte length prefix + actual string
        // Advance by MAX symbol length (10)
        const symbolLen = data.readUInt32LE(offset);
        offset += 4;
        const symbol = data.slice(offset, offset + symbolLen).toString("utf-8").replace(/\0/g, "").trim();
        offset += 10; // ← MAX symbol length (not symbolLen!)

        // URI: 4-byte length prefix + actual string
        // Advance by MAX uri length (200)
        const uriLen = data.readUInt32LE(offset);
        offset += 4;
        const uri = data.slice(offset, offset + uriLen).toString("utf-8").replace(/\0/g, "").trim();
        // No need to advance further, URI is the last field we need

        return { name, symbol, uri };
    } catch {
        return null;
    }
}
/**
 * Fetch the image URL from a Metaplex JSON metadata URI.
 * The URI points to a JSON file with an "image" field.
 */
/**
 * Fetch the image URL from a Metaplex JSON metadata URI.
 * Safely handles rate limits by extracting CIDs and using multiple gateways.
 */
async function fetchImageFromMetadataUri(uri: string): Promise<string | undefined> {
    if (!uri || uri.length < 5) return undefined;

    const urisToTry: string[] = [];

    // Extract the CID whether it's "ipfs://" or an HTTP gateway link
    let cid = "";
    if (uri.startsWith("ipfs://")) {
        cid = uri.replace("ipfs://", "");
    } else if (uri.includes("/ipfs/")) {
        // Splits "https://gateway.pinata.cloud/ipfs/Qm..." to get the "Qm..." part
        cid = uri.split("/ipfs/")[1];
    }

    if (cid) {
        // If we found a CID, always use fallbacks to avoid 429 Rate Limits
        urisToTry.push(
            `https://gateway.pinata.cloud/ipfs/${cid}`,
            `https://ipfs.io/ipfs/${cid}`,
            `https://cloudflare-ipfs.com/ipfs/${cid}`,
            `https://dweb.link/ipfs/${cid}` // Added an extra reliable gateway
        );
    } else {
        // It's a standard HTTPS link (like an AWS S3 bucket), just try it directly
        urisToTry.push(uri);
    }

    for (const resolvedUri of urisToTry) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);
            const res = await fetch(resolvedUri, { signal: controller.signal });
            clearTimeout(timeout);

            if (!res.ok) {
                continue;
            }

            const contentType = res.headers.get("content-type") || "";

            if (contentType.startsWith("image/")) {
                return resolvedUri;
            }

            const json = await res.json();
            let imageUrl = json?.image;
            if (!imageUrl) continue;

            // Resolve IPFS image URLs inside the JSON too!
            if (imageUrl.startsWith("ipfs://")) {
                const imgCid = imageUrl.replace("ipfs://", "");
                // Use a reliable gateway for the final image render
                imageUrl = `https://ipfs.io/ipfs/${imgCid}`;
            } else if (imageUrl.includes("/ipfs/")) {
                const imgCid = imageUrl.split("/ipfs/")[1];
                imageUrl = `https://ipfs.io/ipfs/${imgCid}`;
            }

            return imageUrl;

        } catch (error) {
            continue;
        }
    }

    return undefined;
}
// Random gradient colors for discovered tokens
const DISCOVERED_COLORS = [
    "bg-gradient-to-br from-rose-500 to-orange-500",
    "bg-gradient-to-br from-cyan-500 to-blue-500",
    "bg-gradient-to-br from-green-500 to-emerald-500",
    "bg-gradient-to-br from-violet-500 to-fuchsia-500",
    "bg-gradient-to-br from-amber-500 to-yellow-500",
    "bg-gradient-to-br from-pink-500 to-red-500",
    "bg-gradient-to-br from-teal-500 to-lime-500",
];

// NFT / Position token keywords to filter out
const NFT_FILTER_KEYWORDS = [
    "raydium concentrated liquidity",
    "raydium lp",
    "position",
    "nft",
    "receipt",
];

/**
 * Hook that fetches all SPL token balances + native SOL for the connected wallet.
 * Auto-discovers unknown tokens via Metaplex metadata.
 * Filters out NFTs and position tokens.
 */
export function useTokenBalances() {
    const { publicKey, connected } = useWallet();
    const { connection } = useConnection();
    const [balances, setBalances] = useState<Map<string, TokenBalance>>(new Map());
    const [discoveredTokens, setDiscoveredTokens] = useState<TokenInfo[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchBalances = useCallback(async () => {
        if (!publicKey || !connected) {
            setBalances(new Map());
            setDiscoveredTokens([]);
            return;
        }

        setLoading(true);
        const newBalances = new Map<string, TokenBalance>();
        const unknownMints: { mint: string; decimals: number }[] = [];

        try {
            // 1. Fetch native SOL balance
            const solLamports = await connection.getBalance(publicKey);
            newBalances.set("So11111111111111111111111111111111111111112", {
                mint: "So11111111111111111111111111111111111111112",
                balance: solLamports / LAMPORTS_PER_SOL,
                rawBalance: BigInt(solLamports),
                decimals: 9,
            });

            // 2. Fetch all SPL token accounts
            const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
                publicKey,
                { programId: TOKEN_PROGRAM_ID }
            );

            const { DEVNET_TOKENS } = await import("@/components/liquidity/TokenSelectorModal");
            const knownMints = new Set(DEVNET_TOKENS.map(t => t.mint));

            for (const { account } of tokenAccounts.value) {
                const parsed = account.data.parsed?.info;
                if (!parsed) continue;

                const mint: string = parsed.mint;
                const decimals: number = parsed.tokenAmount?.decimals || 0;
                const uiAmount: number = parsed.tokenAmount?.uiAmount || 0;
                const rawAmount: string = parsed.tokenAmount?.amount || "0";

                // Skip zero balances
                if (uiAmount === 0 && rawAmount === "0") continue;

                // ── FILTER: Skip NFTs (decimals === 0) ──
                if (decimals === 0) continue;

                // Aggregate balances
                const existing = newBalances.get(mint);
                if (existing) {
                    newBalances.set(mint, {
                        mint,
                        balance: existing.balance + uiAmount,
                        rawBalance: existing.rawBalance + BigInt(rawAmount),
                        decimals,
                    });
                } else {
                    newBalances.set(mint, {
                        mint,
                        balance: uiAmount,
                        rawBalance: BigInt(rawAmount),
                        decimals,
                    });
                }

                // Track unknown mints for metadata lookup
                if (!knownMints.has(mint)) {
                    unknownMints.push({ mint, decimals });
                }
            }

            // 3. Fetch Metaplex metadata for unknown tokens
            if (unknownMints.length > 0) {
                const metadataPDAs = unknownMints.map(m => getMetadataPDA(new PublicKey(m.mint)));
                const metadataAccounts = await connection.getMultipleAccountsInfo(metadataPDAs);

                // Parse on-chain metadata first
                const parsedMetas: { mint: string; decimals: number; name: string; symbol: string; uri: string }[] = [];

                for (let i = 0; i < unknownMints.length; i++) {
                    const { mint, decimals } = unknownMints[i];
                    const metaAccount = metadataAccounts[i];

                    if (metaAccount?.data) {
                        const metadata = parseMetaplexMetadata(Buffer.from(metaAccount.data));

                        if (metadata && metadata.symbol) {
                            // ── FILTER: Skip NFTs / position tokens by name ──
                            const nameLower = metadata.name.toLowerCase();
                            if (NFT_FILTER_KEYWORDS.some(kw => nameLower.includes(kw))) {
                                newBalances.delete(mint);
                                continue;
                            }

                            parsedMetas.push({ mint, decimals, ...metadata });
                        }
                    }
                }

                // 4. Fetch actual image URLs from each token's metadata JSON URI (with concurrency limiting)
                const images: (string | undefined)[] = [];
                const chunkSize = 4;
                for (let i = 0; i < parsedMetas.length; i += chunkSize) {
                    const chunk = parsedMetas.slice(i, i + chunkSize);
                    const results = await Promise.all(chunk.map(m => fetchImageFromMetadataUri(m.uri)));
                    images.push(...results);
                }

                const newTokens: TokenInfo[] = parsedMetas.map((meta, i) => {
                    const colorIdx = i % DISCOVERED_COLORS.length;
                    const token: TokenInfo = {
                        symbol: meta.symbol,
                        name: meta.name || meta.symbol,
                        mint: meta.mint,
                        decimals: meta.decimals,
                        color: DISCOVERED_COLORS[colorIdx],
                        icon: meta.symbol.charAt(0).toUpperCase(),
                        logoURI: images[i] || undefined,
                    };
                    return token;
                });

                setDiscoveredTokens(newTokens);
            } else {
                setDiscoveredTokens([]);
            }
        } catch (err) {
        } finally {
            setLoading(false);
            setBalances(newBalances);
        }
    }, [publicKey, connected, connection]);

    useEffect(() => {
        fetchBalances();
    }, [fetchBalances]);

    const getBalance = useCallback(
        (mint: string): number => {
            return balances.get(mint)?.balance ?? 0;
        },
        [balances]
    );

    return { balances, discoveredTokens, loading, refetch: fetchBalances, getBalance };
}
