import { useEffect, useState, useRef } from "react";

function LaserBeams() {
  return (
    <div className="laser-beams-container" aria-hidden="true">
      <div className="laser-beam laser-beam-1" />
      <div className="laser-beam laser-beam-2" />
      <div className="laser-beam laser-beam-3" />
      <div className="laser-beam laser-beam-4" />
    </div>
  );
}

function LaserFlashes() {
  const [flashes, setFlashes] = useState<Array<{ id: number; x: number; y: number; size: number; color: string }>>([]);
  const flashTimeouts = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    let idCounter = 0;
    const colors = [
      "rgba(0, 255, 255, 0.08)",
      "rgba(138, 43, 226, 0.06)",
      "rgba(0, 255, 255, 0.05)",
      "rgba(200, 50, 255, 0.05)",
    ];

    const spawn = () => {
      const id = idCounter++;
      const flash = {
        id,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: 80 + Math.random() * 200,
        color: colors[Math.floor(Math.random() * colors.length)],
      };
      setFlashes((prev) => [...prev.slice(-4), flash]);
      const t = setTimeout(() => {
        flashTimeouts.current.delete(t);
        setFlashes((prev) => prev.filter((f) => f.id !== id));
      }, 2200);
      flashTimeouts.current.add(t);
    };

    const interval = setInterval(spawn, 4000 + Math.random() * 3000);
    const firstTimeout = setTimeout(spawn, 2000);
    return () => {
      clearInterval(interval);
      clearTimeout(firstTimeout);
      flashTimeouts.current.forEach((t) => clearTimeout(t));
      flashTimeouts.current.clear();
    };
  }, []);

  return (
    <div className="laser-flashes" aria-hidden="true">
      {flashes.map((f) => (
        <div
          key={f.id}
          className="laser-flash"
          style={{
            left: `${f.x}%`,
            top: `${f.y}%`,
            width: f.size,
            height: f.size,
            background: `radial-gradient(circle, ${f.color} 0%, transparent 70%)`,
          }}
        />
      ))}
    </div>
  );
}

function ScanLine() {
  return <div className="scan-line" aria-hidden="true" />;
}

export function LaserEffects() {
  return (
    <>
      <LaserBeams />
      <LaserFlashes />
      <ScanLine />
    </>
  );
}

export function LogoBeams() {
  return (
    <div className="logo-beams" aria-hidden="true">
      <svg
        viewBox="0 0 800 300"
        className="logo-beams-svg"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id="cyan-beam-l" x1="50%" y1="50%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="rgba(0,255,255,0.5)" />
            <stop offset="40%" stopColor="rgba(0,255,255,0.15)" />
            <stop offset="100%" stopColor="rgba(0,255,255,0)" />
          </linearGradient>
          <linearGradient id="cyan-beam-r" x1="50%" y1="50%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(0,255,255,0.5)" />
            <stop offset="40%" stopColor="rgba(0,255,255,0.15)" />
            <stop offset="100%" stopColor="rgba(0,255,255,0)" />
          </linearGradient>
          <linearGradient id="mag-beam-l" x1="50%" y1="50%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(200,50,255,0.5)" />
            <stop offset="40%" stopColor="rgba(200,50,255,0.15)" />
            <stop offset="100%" stopColor="rgba(200,50,255,0)" />
          </linearGradient>
          <linearGradient id="mag-beam-r" x1="50%" y1="50%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(200,50,255,0.5)" />
            <stop offset="40%" stopColor="rgba(200,50,255,0.15)" />
            <stop offset="100%" stopColor="rgba(200,50,255,0)" />
          </linearGradient>
          <filter id="beam-glow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <line x1="400" y1="150" x2="0" y2="30" stroke="url(#cyan-beam-l)" strokeWidth="1.5" filter="url(#beam-glow)" className="beam-line beam-line-1" />
        <line x1="400" y1="150" x2="800" y2="270" stroke="url(#cyan-beam-r)" strokeWidth="1.5" filter="url(#beam-glow)" className="beam-line beam-line-2" />

        <line x1="400" y1="150" x2="50" y2="280" stroke="url(#mag-beam-l)" strokeWidth="1" filter="url(#beam-glow)" className="beam-line beam-line-3" />
        <line x1="400" y1="150" x2="750" y2="20" stroke="url(#mag-beam-r)" strokeWidth="1" filter="url(#beam-glow)" className="beam-line beam-line-4" />

        <circle cx="400" cy="150" r="4" fill="rgba(0,255,255,0.6)" className="beam-origin-pulse" />
      </svg>
    </div>
  );
}
