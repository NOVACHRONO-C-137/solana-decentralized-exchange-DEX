"use client";

import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: "bg-card border border-border text-foreground",
          success: "border-[var(--neon-teal)]/30",
          error: "border-red-500/30",
        },
      }}
    />
  );
}
