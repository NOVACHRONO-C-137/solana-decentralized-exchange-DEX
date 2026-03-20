"use client";
import { useState, useEffect, useRef } from "react";

interface Dot {
  x: number; y: number; baseX: number; baseY: number;
  vx: number; vy: number; radius: number; opacity: number;
  pulseOffset: number;
}

export default function AppLoader() {
  const [visible, setVisible] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dotsRef = useRef<Dot[]>([]);
  const animRef = useRef<number>(0);


  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 2800);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!visible || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    const SPACING = 32;
    const WAVE_AMPLITUDE = 15;
    const WAVE_FREQUENCY = 0.05;

    function initDots() {
      const dots: Dot[] = [];
      const cols = Math.ceil(canvas.width / SPACING) + 1;
      const rows = Math.ceil(canvas.height / SPACING) + 1;
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const bx = i * SPACING;
          const by = j * SPACING;
          dots.push({
            x: bx, y: by, baseX: bx, baseY: by,
            vx: 0, vy: 0,
            radius: 1.0 + Math.random() * 0.5,
            opacity: 0.1 + Math.random() * 0.2,
            pulseOffset: Math.random() * Math.PI * 2
          });
        }
      }
      dotsRef.current = dots;
    }

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initDots();
    }

    function draw(time: number) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const dots = dotsRef.current;

      for (const d of dots) {
        const dx = d.baseX - centerX;
        const dy = d.baseY - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);


        const wave = Math.sin(dist * WAVE_FREQUENCY - time * 0.005) * WAVE_AMPLITUDE;


        const breathe = Math.sin(time * 0.002) * 5;
        const angle = Math.atan2(dy, dx);


        d.x = d.baseX + Math.cos(angle) * (wave + breathe);
        d.y = d.baseY + Math.sin(angle) * (wave + breathe);


        const proximityToCenter = Math.max(0, 1 - dist / 300);
        const finalOpacity = Math.min(0.8, d.opacity + (proximityToCenter * 0.5));
        const finalRadius = d.radius + (proximityToCenter * 1.5);


        ctx.beginPath();
        ctx.arc(d.x, d.y, finalRadius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(20, 241, 149, ${finalOpacity})`;

        if (proximityToCenter > 0.5) {
          ctx.shadowColor = 'rgba(20, 241, 149, 0.4)';
          ctx.shadowBlur = 8;
        } else {
          ctx.shadowBlur = 0;
        }

        ctx.fill();
      }

      animRef.current = requestAnimationFrame(draw);
    }

    window.addEventListener('resize', resize);
    resize();

    draw(0);

    animRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-background transition-opacity duration-1000 ${visible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
    >
      {/* Quantum Dot Background */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-0 pointer-events-none opacity-60 animate-in fade-in duration-500"
      />

      <div className="relative z-10 flex items-center justify-center">
        {/* spinning ring */}
        <div className="absolute w-24 h-24 rounded-full border-4 border-transparent border-t-[var(--neon-teal)] animate-spin" />

        {/* Secondary pulsing ring to blend with waves */}
        <div className="absolute w-24 h-24 rounded-full border-2 border-[var(--neon-teal)] opacity-20 animate-ping" />

        {/* logo */}
        <img src="/nova-icon.svg" alt="NOVADEX" className="w-12 h-12 relative z-20" />

        <p className="absolute -bottom-20 w-48 text-center text-[10px] uppercase tracking-[0.2em] text-[var(--neon-teal)] opacity-40 font-bold animate-pulse">
          Establishing Secure Link...
        </p>
      </div>
    </div>
  );
}