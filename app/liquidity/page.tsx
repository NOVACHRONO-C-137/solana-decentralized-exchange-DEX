import LiquidityPoolsTable from "@/components/liquidity/LiquidityPoolsTable";

export default function LiquidityPage() {
    return (
        <main className="container mx-auto px-4 py-12 flex flex-col min-h-screen items-center">
            <section className="w-full max-w-[1400px]">
                <LiquidityPoolsTable />
            </section>
        </main>
    );
}