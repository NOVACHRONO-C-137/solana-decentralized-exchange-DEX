"use client";
import { useRouter } from "next/navigation";
import { ChevronLeft, Check } from "lucide-react";
import { glassCard } from "@/lib/utils";

interface Step { n: number; label: string; }

interface StepperSidebarProps {
    currentStep: number;
    steps: Step[];
    note?: React.ReactNode;
}

export function StepperSidebar({ currentStep, steps, note }: StepperSidebarProps) {
    const router = useRouter();
    return (
        <div className="w-full md:w-1/3 flex flex-col gap-4">
            <button onClick={() => router.back()} className="flex items-center text-muted-foreground hover:text-foreground transition-colors w-fit mb-2">
                <ChevronLeft className="h-5 w-5 mr-1" /> Back
            </button>
            <div className={`${glassCard} p-6 flex flex-col gap-6`}>
                {steps.map(({ n, label }, i) => (
                    <div key={n} className="flex gap-4">
                        <div className="flex flex-col items-center">
                            <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 border-2 transition-all ${currentStep > n ? "bg-[var(--neon-teal)] border-[var(--neon-teal)] text-black" : currentStep === n ? "border-[var(--neon-teal)] text-[var(--neon-teal)]" : "border-border text-muted-foreground"}`}>
                                {currentStep > n ? <Check className="h-4 w-4" /> : n}
                            </div>
                            {i < steps.length - 1 && <div className="w-0.5 h-12 bg-border mt-2" />}
                        </div>
                        <div className={`pt-1 ${currentStep < n ? "opacity-40" : ""}`}>
                            <p className={`text-xs font-medium mb-0.5 ${currentStep >= n ? "text-[var(--neon-teal)]" : "text-muted-foreground"}`}>Step {n}</p>
                            <p className={`text-sm font-bold ${currentStep === n ? "text-foreground" : "text-muted-foreground"}`}>{label}</p>
                        </div>
                    </div>
                ))}
            </div>
            {note && (
                <div className={`${glassCard} p-5`}>
                    <h4 className="flex items-center text-sm font-bold mb-2">
                        <span className="w-4 h-4 rounded-full border border-white/40 text-muted-foreground flex items-center justify-center text-[10px] mr-2">!</span>
                        Please Note
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">{note}</p>
                </div>
            )}
        </div>
    );
}
