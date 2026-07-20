import { useRef } from "react";
import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import { GitCommitHorizontal, Rocket, ShieldCheck, Sparkles } from "lucide-react";
import { EASE, fadeUp } from "./anim";

type Phase = {
  id: string;
  title: string;
  era: string;
  body: string;
  badge: string;
  icon: typeof GitCommitHorizontal;
  style: "gray" | "neutral" | "emerald" | "dashed";
};

// Fases reales de docs/ROADMAP.md — no inventar fechas ni features no planeadas ahí.
const PHASES: Phase[] = [
  {
    id: "origen",
    title: "El origen",
    era: "Era FlowDesk",
    body: "Nexo nació como FlowDesk: una herramienta interna para resolver los cuellos de botella del equipo de TI.",
    badge: "herramienta interna",
    icon: GitCommitHorizontal,
    style: "gray",
  },
  {
    id: "fase-0",
    title: "Preparación open source",
    era: "Completada",
    body: "Licencia AGPL-3.0, CI en GitHub Actions, primera suite de tests del backend e imagen Docker publicada. El repositorio quedó listo como proyecto público (tag v0.1.0).",
    badge: "open source",
    icon: Sparkles,
    style: "emerald",
  },
  {
    id: "fase-1",
    title: "Fundaciones SaaS",
    era: "En progreso",
    body: "Multi-tenancy ✓, plantillas de flujo ✓, registro self-service y códigos de acceso ✓ — construido y probado. Faltan facturación y hosting para habilitar el plan Cloud.",
    badge: "construida en público",
    icon: Rocket,
    style: "emerald",
  },
  {
    id: "fase-2",
    title: "Enterprise",
    era: "Sin fecha",
    body: "SSO/SAML, auditoría y RBAC avanzado para cuentas Enterprise. Se construye contra el primer contrato real, no antes.",
    badge: "a demanda",
    icon: ShieldCheck,
    style: "dashed",
  },
];

const STYLE_MAP = {
  gray: {
    badge: "border-gray-600/50 bg-gray-500/10 text-gray-500",
    dot: "border-gray-600 bg-ink text-gray-500",
    card: "border-hairline bg-surface/70",
    title: "text-gray-400",
    glow: "",
  },
  neutral: {
    badge: "border-indigo-500/30 bg-indigo-500/10 text-indigo-300",
    dot: "border-indigo-500/60 bg-ink text-indigo-400",
    card: "border-hairline bg-surface/70",
    title: "text-gray-200",
    glow: "",
  },
  emerald: {
    badge: "border-emerald-500/50 bg-emerald-500/15 text-emerald-300",
    dot: "border-emerald-400 bg-ink text-emerald-400 shadow-[0_0_20px_2px_rgba(52,211,153,0.5)]",
    card: "border-emerald-500/40 bg-emerald-500/[0.05] shadow-[0_0_50px_-12px_rgba(16,185,129,0.4)]",
    title: "text-white",
    glow: "text-emerald-400",
  },
  dashed: {
    badge: "border-dashed border-emerald-500/40 bg-transparent text-emerald-400/80",
    dot: "border-dashed border-emerald-500/60 bg-ink text-emerald-400",
    card: "border-dashed border-emerald-500/35 bg-surface/40",
    title: "text-gray-300",
    glow: "",
  },
} as const;

export default function Roadmap() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.72", "end 0.6"],
  });
  const progress = useSpring(scrollYProgress, { stiffness: 90, damping: 26 });
  const lineScale = useTransform(progress, [0, 1], [0, 1]);

  return (
    <section id="roadmap" className="relative overflow-hidden bg-ink py-28 md:py-36">
      <div className="bg-dots pointer-events-none absolute inset-0 opacity-40" />
      <div className="pointer-events-none absolute left-1/2 top-24 h-80 w-[36rem] -translate-x-1/2 rounded-full bg-emerald-500/[0.05] blur-[130px]" />

      <div className="relative mx-auto max-w-5xl px-5 md:px-8">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.4 }}
          className="mx-auto max-w-2xl text-center"
        >
          <span className="font-mono text-xs uppercase tracking-widest text-emerald-400">
            {"// roadmap de transición"}
          </span>
          <h2 className="mt-4 font-display text-4xl font-bold tracking-tight text-white md:text-6xl">
            De <span className="text-gray-500 line-through decoration-gray-600">FlowDesk</span> a{" "}
            <span className="text-gradient-flow">NEXO</span>.
          </h2>
          <p className="mt-5 text-sm leading-relaxed text-gray-400 md:text-lg">
            El camino real de una herramienta interna a un motor open-core — el mismo que se
            documenta en <span className="font-mono text-gray-300">docs/ROADMAP.md</span> del
            repositorio.
          </p>
        </motion.div>

        <div ref={ref} className="relative mt-20 md:mt-24">
          {/* base line */}
          <div className="absolute left-5 top-0 h-full w-px bg-hairline md:left-1/2" />
          {/* glowing progress line — grey to emerald */}
          <motion.div
            style={{ scaleY: lineScale }}
            className="absolute left-5 top-0 h-full w-px origin-top bg-gradient-to-b from-gray-500 via-indigo-500 to-emerald-400 shadow-[0_0_16px_1px_rgba(52,211,153,0.5)] md:left-1/2"
          />

          <div className="space-y-14 md:space-y-20">
            {PHASES.map((p, i) => {
              const s = STYLE_MAP[p.style];
              const left = i % 2 === 0;
              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.45 }}
                  transition={{ duration: 0.9, ease: EASE }}
                  className={`relative flex pl-14 md:w-1/2 ${
                    left ? "md:pl-0 md:pr-14" : "md:ml-auto md:pl-14"
                  }`}
                >
                  {/* node on the line */}
                  <span
                    className={`absolute left-5 top-6 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border ${s.dot} ${
                      left ? "md:left-full" : "md:left-0"
                    }`}
                  >
                    <p.icon className="h-4 w-4" />
                  </span>

                  <div
                    className={`w-full rounded-2xl border p-6 backdrop-blur transition-transform duration-500 hover:-translate-y-1 md:p-7 ${s.card}`}
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-mono text-xs text-gray-600">
                        {p.id === "origen" ? "ORIGEN" : p.id.toUpperCase().replace("-", " ")}
                      </span>
                      <span
                        className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest ${s.badge}`}
                      >
                        {p.badge}
                      </span>
                      <span
                        className={`ml-auto font-mono text-[10px] uppercase tracking-widest ${p.style === "emerald" ? "text-emerald-400" : "text-gray-600"}`}
                      >
                        {p.era}
                      </span>
                    </div>
                    <h3
                      className={`mt-3.5 font-display text-2xl font-bold tracking-tight ${s.title}`}
                    >
                      {p.title}
                    </h3>
                    <p className="mt-2.5 text-sm leading-relaxed text-gray-400">{p.body}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
