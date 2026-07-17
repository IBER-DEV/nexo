import { motion } from "framer-motion";
import { ArrowRight, Github, MousePointerClick, Terminal } from "lucide-react";
import FlowNetwork from "./FlowNetwork";
import { EASE } from "./anim";
import { NEXO_REPO_URL, NexoBrandMark } from "./NexoBrandMark";

/** Rotating circular SVG badge — "PROYECTO OPEN SOURCE • DALE UNA ESTRELLA •" */
function CircularGithubBadge() {
  return (
    <motion.a
      href={NEXO_REPO_URL}
      target="_blank"
      rel="noreferrer"
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 1, ease: EASE, delay: 1.2 }}
      className="group absolute bottom-8 right-8 z-20 hidden h-28 w-28 items-center justify-center md:flex"
      aria-label="Nexo en GitHub"
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full animate-spin-slow">
        <defs>
          <path id="badge-circle" d="M 50,50 m -38,0 a 38,38 0 1,1 76,0 a 38,38 0 1,1 -76,0" />
        </defs>
        <text className="fill-gray-400 font-mono text-[8.2px] uppercase tracking-[0.22em] transition-colors group-hover:fill-emerald-400">
          <textPath href="#badge-circle">Proyecto open source • Dale una estrella •</textPath>
        </text>
      </svg>
      <span className="flex h-12 w-12 items-center justify-center rounded-full border border-hairline bg-surface/80 backdrop-blur transition-all duration-300 group-hover:border-emerald-500/50 group-hover:shadow-[0_0_24px_-4px_rgba(52,211,153,0.6)]">
        <Github className="h-5 w-5 text-gray-300 transition-colors group-hover:text-emerald-400" />
      </span>
    </motion.a>
  );
}

export default function Hero() {
  return (
    <section
      id="top"
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink"
    >
      {/* Interactive flow-network canvas */}
      <div className="absolute inset-0">
        <FlowNetwork />
      </div>

      {/* Vignette + top glow to keep text legible */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(3,7,18,0.55)_70%,#030712_100%)]" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-indigo-500/10 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 left-1/4 h-72 w-96 rounded-full bg-emerald-500/[0.07] blur-[110px]" />

      {/* Content */}
      <div className="pointer-events-none relative z-10 mx-auto max-w-5xl px-5 pb-24 pt-32 text-center md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: EASE, delay: 0.25 }}
          className="pointer-events-auto mx-auto mb-7 inline-flex items-center gap-2.5 rounded-full border border-hairline bg-surface/70 px-4 py-1.5 backdrop-blur"
        >
          <NexoBrandMark className="h-3.5 w-3.5" />
          <span className="font-mono text-xs uppercase tracking-widest text-gray-400">
            Licencia AGPL-3.0 · núcleo 100% open source
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: EASE, delay: 0.38 }}
          className="font-display text-5xl font-bold leading-[1.1] tracking-tighter text-white md:text-[88px]"
        >
          El motor open-core
          <br />
          para equipos de <span className="text-gradient-flow">TI</span>.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: EASE, delay: 0.52 }}
          className="mx-auto mt-7 max-w-2xl text-sm leading-relaxed text-gray-400 md:text-lg"
        >
          Backlog, planeación semanal y mensual, tablero Kanban y reportes ejecutivos, con roles de
          admin, coordinador y miembro. Nació como herramienta interna —{" "}
          <span className="font-mono text-gray-300">FlowDesk</span> — hoy es open source.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: EASE, delay: 0.66 }}
          className="pointer-events-auto mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
        >
          <a
            href="#roadmap"
            className="group order-2 flex items-center gap-2 rounded-full border border-hairline bg-surface/60 px-6 py-3 text-sm font-medium text-gray-300 backdrop-blur transition-all duration-300 hover:border-gray-500 hover:text-white sm:order-1"
          >
            Ver roadmap de transición
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1.5 group-hover:scale-110" />
          </a>
          <a
            href="#pricing"
            className="group order-1 flex items-center gap-2.5 rounded-full bg-emerald-500 px-7 py-3 text-sm font-semibold text-gray-950 transition-all duration-300 hover:bg-emerald-400 glow-emerald sm:order-2"
          >
            <Terminal className="h-4 w-4 transition-transform duration-300 group-hover:-rotate-6" />
            Autoalojar ahora
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1.4 }}
          className="pointer-events-none mt-14 flex items-center justify-center gap-2 font-mono text-[11px] uppercase tracking-widest text-gray-600"
        >
          <MousePointerClick className="h-3.5 w-3.5 text-gray-500" />
          toca el lienzo — envía una onda por el backlog
        </motion.div>
      </div>

      <CircularGithubBadge />

      {/* bottom fade into next section */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-surface" />
    </section>
  );
}
