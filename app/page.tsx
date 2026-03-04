import SwapCard from "@/components/SwapCard";

export default function Home() {
  return (
    <main className="container mx-auto px-4 py-8 flex items-center justify-center min-h-[calc(100vh-64px)]">
      {/* Centered Swap Interface */}
      <section className="w-full flex justify-center -mt-20">
        <SwapCard />
      </section>
    </main>
  );
}