/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "img-v1-devnet.raydium.io",
                pathname: "/icon/**",
            },
            {
                protocol: "https",
                hostname: "img-v1.raydium.io",
                pathname: "/icon/**",
            },
            {
                protocol: "https",
                hostname: "arweave.net",
            },
            {
                protocol: "https",
                hostname: "**.arweave.net",
            },
            {
                protocol: "https",
                hostname: "ipfs.io",
            },
            {
                protocol: "https",
                hostname: "nftstorage.link",
            },
            {
                protocol: "https",
                hostname: "cloudflare-ipfs.com",
            },
            {
                protocol: "https",
                hostname: "gateway.pinata.cloud",
            },
            {
                protocol: "https",
                hostname: "shdw-drive.genesysgo.net",
            },
            {
                protocol: "https",
                hostname: "raw.githubusercontent.com",
            },
        ],
    },
};

export default nextConfig;

