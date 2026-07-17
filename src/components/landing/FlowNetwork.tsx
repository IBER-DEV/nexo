import { useEffect, useRef } from "react";

/**
 * Interactive "Flow Network" node canvas.
 * Floating nodes represent tasks/backlog items drifting through space,
 * linked by hairline connections. Clicking fires a ripple shockwave that
 * pushes nodes outward. Rendering pauses when the canvas leaves the viewport.
 */

type Node = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hue: "emerald" | "indigo" | "slate";
  pulse: number;
};

type Ripple = {
  x: number;
  y: number;
  radius: number;
  alpha: number;
};

const NODE_COLORS: Record<Node["hue"], string> = {
  emerald: "52, 211, 153",
  indigo: "129, 140, 248",
  slate: "148, 163, 184",
};

export default function FlowNetwork({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let running = true;
    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const nodes: Node[] = [];
    const ripples: Ripple[] = [];
    const mouse = { x: -9999, y: -9999 };

    const seed = () => {
      nodes.length = 0;
      const count = Math.min(110, Math.floor((width * height) / 16000));
      for (let i = 0; i < count; i++) {
        const roll = Math.random();
        nodes.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.22,
          vy: (Math.random() - 0.5) * 0.22,
          r: Math.random() * 1.8 + 0.8,
          hue: roll > 0.72 ? "emerald" : roll > 0.42 ? "indigo" : "slate",
          pulse: Math.random() * Math.PI * 2,
        });
      }
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (nodes.length === 0) seed();
    };

    const LINK_DIST = 130;

    const tick = () => {
      if (!running) return;
      ctx.clearRect(0, 0, width, height);

      // Update ripples -> push nodes
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rp = ripples[i];
        rp.radius += 7.5;
        rp.alpha *= 0.955;
        if (rp.alpha < 0.015) {
          ripples.splice(i, 1);
          continue;
        }
        for (const n of nodes) {
          const dx = n.x - rp.x;
          const dy = n.y - rp.y;
          const dist = Math.hypot(dx, dy) || 1;
          const band = Math.abs(dist - rp.radius);
          if (band < 60) {
            const force = ((60 - band) / 60) * rp.alpha * 1.9;
            n.vx += (dx / dist) * force;
            n.vy += (dy / dist) * force;
          }
        }
        ctx.beginPath();
        ctx.arc(rp.x, rp.y, rp.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(52, 211, 153, ${rp.alpha * 0.55})`;
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(rp.x, rp.y, rp.radius * 0.72, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(129, 140, 248, ${rp.alpha * 0.35})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Drift + mouse repulsion + friction
      for (const n of nodes) {
        const dx = n.x - mouse.x;
        const dy = n.y - mouse.y;
        const md = Math.hypot(dx, dy);
        if (md < 120 && md > 0.1) {
          const f = ((120 - md) / 120) * 0.045;
          n.vx += (dx / md) * f;
          n.vy += (dy / md) * f;
        }
        n.x += n.vx;
        n.y += n.vy;
        n.vx *= 0.985;
        n.vy *= 0.985;
        // keep a minimum drift so the field never dies
        if (Math.abs(n.vx) < 0.05) n.vx += (Math.random() - 0.5) * 0.02;
        if (Math.abs(n.vy) < 0.05) n.vy += (Math.random() - 0.5) * 0.02;
        n.pulse += 0.02;

        if (n.x < -20) n.x = width + 20;
        if (n.x > width + 20) n.x = -20;
        if (n.y < -20) n.y = height + 20;
        if (n.y > height + 20) n.y = -20;
      }

      // Connections
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < LINK_DIST * LINK_DIST) {
            const t = 1 - Math.sqrt(d2) / LINK_DIST;
            const emerald = a.hue === "emerald" || b.hue === "emerald";
            ctx.strokeStyle = emerald
              ? `rgba(52, 211, 153, ${t * 0.16})`
              : `rgba(129, 140, 248, ${t * 0.13})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      // Nodes
      for (const n of nodes) {
        const glow = 0.55 + Math.sin(n.pulse) * 0.3;
        const c = NODE_COLORS[n.hue];
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${c}, ${glow})`;
        ctx.fill();
        if (n.hue !== "slate") {
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.r * 3.2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${c}, ${glow * 0.08})`;
          ctx.fill();
        }
      }

      raf = requestAnimationFrame(tick);
    };

    const onPointer = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };
    const onLeave = () => {
      mouse.x = -9999;
      mouse.y = -9999;
    };
    const onClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      ripples.push({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        radius: 6,
        alpha: 1,
      });
    };

    // Pause rendering while off-screen (keeps RAM / CPU low)
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !running) {
          running = true;
          raf = requestAnimationFrame(tick);
        } else if (!entry.isIntersecting && running) {
          running = false;
          cancelAnimationFrame(raf);
        }
      },
      { threshold: 0.02 },
    );
    io.observe(canvas);

    resize();
    window.addEventListener("resize", resize);
    canvas.addEventListener("pointermove", onPointer);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("click", onClick);
    raf = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointermove", onPointer);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("click", onClick);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`h-full w-full cursor-crosshair ${className}`}
      aria-label="Interactive flow network — click to send a ripple through the backlog"
    />
  );
}
