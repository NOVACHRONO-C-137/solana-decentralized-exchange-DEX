import { Connection, Keypair } from "@solana/web3.js";
import { Raydium } from "@raydium-io/raydium-sdk-v2";

async function main() {
    const connection = new Connection("https://api.devnet.solana.com");
    const owner = Keypair.generate();

    console.log("Loading Raydium...");
    const raydium = await Raydium.load({
        owner,
        connection,
        cluster: "devnet",
        disableFeatureCheck: true,
        disableLoadToken: true,
        blockhashCommitment: "confirmed",
    });

    console.log("Fetching CPMM config...");
    const configs = await raydium.api.getCpmmConfigs();
    console.log("Configs:", JSON.stringify(configs, null, 2));
}

main().catch(console.error);
