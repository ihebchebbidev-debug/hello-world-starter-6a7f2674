import { useEffect, useState } from "react";

/**
 * Branded loading screen. Renders a full-viewport teal-gradient splash with the
 * EcoBus mark, an animated GPS pulse, and a thin progress bar. Auto-dismisses
 * once the app has hydrated (or after `minDurationMs` elapses, whichever is later).
 */
export function LoadingScreen({ minDurationMs = 600 }: { minDurationMs?: number }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const start = performance.now();
    const hide = () => {
      const elapsed = performance.now() - start;
      const wait = Math.max(0, minDurationMs - elapsed);
      window.setTimeout(() => setVisible(false), wait);
    };
    // Always dismiss after minDurationMs, regardless of `load` event timing.
    // On SPA hosts (Vercel) the `load` event can fire before this component
    // mounts, so relying on it alone leaves the splash stuck forever,
    // blocking clicks/typing on the page underneath.
    const t = window.setTimeout(() => setVisible(false), minDurationMs);
    if (document.readyState === "complete") hide();
    else window.addEventListener("load", hide, { once: true });
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("load", hide);
    };
  }, [minDurationMs]);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      className="ecobus-splash"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "grid",
        placeItems: "center",
        background:
          "radial-gradient(ellipse at center, #102538 0%, #0E1B2C 70%)",
        animation: "ecobus-fade-out 320ms ease 0s 1 forwards",
        animationDelay: "calc(var(--splash-min, 600ms))",
        pointerEvents: "none",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28 }}>
        <div style={{ position: "relative", width: 96, height: 96 }}>
          {/* Pulse */}
          <span
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "9999px",
              background: "radial-gradient(closest-side, rgba(45,212,191,0.45), transparent 70%)",
              animation: "ecobus-pulse 1.6s ease-in-out infinite",
            }}
          />
          {/* Logo badge */}
          <img
            src="/icon-192.png"
            alt=""
            width={96}
            height={96}
            style={{
              position: "relative",
              width: 96,
              height: 96,
              borderRadius: 22,
              boxShadow: "0 20px 60px -10px rgba(45,212,191,0.4)",
            }}
          />
        </div>

        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontFamily:
                "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: "-0.01em",
              color: "#ffffff",
            }}
          >
            EcoBus
          </div>
          <div
            style={{
              marginTop: 6,
              fontFamily:
                "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
              fontSize: 12,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "rgba(125,211,200,0.85)",
            }}
          >
            Smart school transport
          </div>
        </div>

        {/* Progress bar */}
        <div
          style={{
            width: 160,
            height: 3,
            borderRadius: 999,
            background: "rgba(255,255,255,0.08)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: "40%",
              borderRadius: 999,
              background: "linear-gradient(90deg, #2DD4BF, #229BA6)",
              animation: "ecobus-bar 1.1s ease-in-out infinite",
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes ecobus-pulse {
          0%, 100% { transform: scale(0.95); opacity: 0.7; }
          50% { transform: scale(1.15); opacity: 1; }
        }
        @keyframes ecobus-bar {
          0% { transform: translateX(-110%); }
          100% { transform: translateX(260%); }
        }
        @keyframes ecobus-fade-out {
          to { opacity: 0; visibility: hidden; }
        }
      `}</style>
    </div>
  );
}
