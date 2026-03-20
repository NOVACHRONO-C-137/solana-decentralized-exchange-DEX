

import { PublicKey, Connection } from "@solana/web3.js";
import { TokenInfo } from "@/components/liquidity/TokenSelectorModal";

const METADATA_PROGRAM_ID = new PublicKey(
    "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

export function getMetadataPDA(mint: PublicKey): PublicKey {
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

export function parseMetaplexMetadata(
    data: Buffer
): { name: string; symbol: string; uri: string } | null {
    try {
        let offset = 65;

        const nameLen = data.readUInt32LE(offset);
        offset += 4;
        const name = data.slice(offset, offset + nameLen).toString("utf-8").replace(/\0/g, "").trim();
        offset += 32; // max name length

        const symbolLen = data.readUInt32LE(offset);
        offset += 4;
        const symbol = data.slice(offset, offset + symbolLen).toString("utf-8").replace(/\0/g, "").trim();
        offset += 10; // max symbol length

        const uriLen = data.readUInt32LE(offset);
        offset += 4;
        const uri = data.slice(offset, offset + uriLen).toString("utf-8").replace(/\0/g, "").trim();

        return { name, symbol, uri };
    } catch {
        return null;
    }
}

export async function fetchImageFromUri(uri: string): Promise<string | undefined> {
    if (!uri || uri.length < 5) return undefined;

    const urisToTry: string[] = [];
    let cid = "";

    if (uri.startsWith("ipfs://")) {
        cid = uri.replace("ipfs://", "");
    } else if (uri.includes("/ipfs/")) {
        cid = uri.split("/ipfs/")[1];
    }

    if (cid) {
        urisToTry.push(
            `https://gateway.pinata.cloud/ipfs/${cid}`,
            `https://ipfs.io/ipfs/${cid}`,
            `https://cloudflare-ipfs.com/ipfs/${cid}`,
            `https://dweb.link/ipfs/${cid}`
        );
    } else {
        urisToTry.push(uri);
    }

    for (const resolvedUri of urisToTry) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);
            const res = await fetch(resolvedUri, { signal: controller.signal });
            clearTimeout(timeout);
            if (!res.ok) continue;

            const contentType = res.headers.get("content-type") || "";
            if (contentType.startsWith("image/")) return resolvedUri;

            const json = await res.json();
            let imageUrl = json?.image;
            if (!imageUrl) continue;

            if (imageUrl.startsWith("ipfs://")) {
                imageUrl = `https://ipfs.io/ipfs/${imageUrl.replace("ipfs://", "")}`;
            } else if (imageUrl.includes("/ipfs/")) {
                imageUrl = `https://ipfs.io/ipfs/${imageUrl.split("/ipfs/")[1]}`;
            }
            return imageUrl;
        } catch {
            continue;
        }
    }
    return undefined;
}


async function fetchMintDecimals(mint: string, connection: Connection): Promise<number> {
    try {

        const info = await connection.getAccountInfo(new PublicKey(mint));
        if (info?.data && info.data.length >= 45) {
            return info.data[44];
        }
    } catch { /* fall through */ }
    return 6;
}



export async function resolveTokenFromMint(
    mint: string,
    symbolHint: string,
    allLocal: TokenInfo[],
    connection?: Connection
): Promise<TokenInfo> {

    const local = allLocal.find(t => t.mint === mint);
    if (local) return local;


    try {
        const res = await fetch(`https://api-v3-devnet.raydium.io/mint/ids?ids=${mint}`);
        if (res.ok) {
            const json = await res.json();
            const d = json?.data?.[0];
            if (d?.symbol) {
                return {
                    symbol: d.symbol,
                    name: d.name || d.symbol,
                    mint: d.address || mint,
                    decimals: d.decimals ?? 6,
                    color: "bg-gradient-to-br from-[#6B7280] to-[#9CA3AF]",
                    icon: d.symbol.charAt(0).toUpperCase(),
                    logoURI: d.logoURI || undefined,
                };
            }
        }
    } catch { /* fall through */ }


    if (connection) {
        try {
            const mintPubkey = new PublicKey(mint);
            const metaPDA = getMetadataPDA(mintPubkey);

            const [metaAccount, realDecimals] = await Promise.all([
                connection.getAccountInfo(metaPDA),
                fetchMintDecimals(mint, connection),
            ]);

            if (metaAccount?.data) {
                const parsed = parseMetaplexMetadata(Buffer.from(metaAccount.data));
                if (parsed?.symbol) {
                    const logoURI = parsed.uri ? await fetchImageFromUri(parsed.uri) : undefined;
                    return {
                        symbol: parsed.symbol,
                        name: parsed.name || parsed.symbol,
                        mint,
                        decimals: realDecimals,
                        color: "bg-gradient-to-br from-[#6B7280] to-[#9CA3AF]",
                        icon: parsed.symbol.charAt(0).toUpperCase(),
                        logoURI,
                    };
                }
            }


            return {
                symbol: symbolHint || mint.slice(0, 6),
                name: symbolHint || "Unknown Token",
                mint,
                decimals: realDecimals,
                color: "bg-gradient-to-br from-[#6B7280] to-[#9CA3AF]",
                icon: (symbolHint || "?").charAt(0).toUpperCase(),
                logoURI: undefined,
            };
        } catch { /* fall through */ }
    }


    const decimals = connection ? await fetchMintDecimals(mint, connection) : 6;
    return {
        symbol: symbolHint || mint.slice(0, 6),
        name: symbolHint || "Unknown Token",
        mint,
        decimals,
        color: "bg-gradient-to-br from-[#6B7280] to-[#9CA3AF]",
        icon: (symbolHint || "?").charAt(0).toUpperCase(),
        logoURI: undefined,
    };
}