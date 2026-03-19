"use client";
import { useState, useEffect } from "react";

export default function AppLoader() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // hide after fonts + first paint settle
    const t = setTimeout(() => setVisible(false), 600);
    return () => clearTimeout(t);
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-background transition-opacity duration-500 ${visible ? "opacity-100" : "opacity-0 pointer-events-none"}`}
    >
      <div className="relative flex items-center justify-center">
        {/* spinning ring */}
        <div className="absolute w-24 h-24 rounded-full border-4 border-transparent border-t-[var(--neon-teal)] animate-spin" />
        {/* logo */}
        <img src="/nova-icon.svg" alt="NOVADEX" className="w-12 h-12" />
      </div>
    </div>
  );
}
