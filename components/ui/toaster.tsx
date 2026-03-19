"use client";
import { Toaster as Sonner } from "sonner";
import { useTheme } from "next-themes";

export function Toaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Sonner
      theme={resolvedTheme as "light" | "dark"}
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: "bg-card border border-border text-foreground font-sans",
          success: "border-[var(--neon-teal)]/40 text-foreground",
          error: "border-red-500/40 text-foreground",
        },
      }}
    />
  );
}
