import DashboardShell from "@/components/dashboard/Dashboard";

export default function DashboardPage() {
    return (
        <main className="container mx-auto px-4 py-8 flex flex-col min-h-screen items-center">
            <section className="w-full max-w-4xl mt-10">
                <DashboardShell />
            </section>
        </main>
    );
}