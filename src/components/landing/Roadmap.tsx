import { useRef } from "react";
import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import { Check, CircleDashed, MoveRight, Sparkles } from "lucide-react";
import { EASE, fadeUp } from "./anim";

type Phase = {
  id: string;
  title: string;
  era: string;
  items: string[];
  badge: string;
  icon: typeof Sparkles;
  style: "neutral" | "emerald" | "dashed";
};

// Roadmap orientado a valor para el usuario final — sin detalle técnico
// interno (commits, arquitectura, tareas de README). No inventar features
// que no estén en docs/ROADMAP.md, solo traducir el lenguaje.
const PHASES: Phase[] = [
  {
    id: "hoy",
    title: "Disponible hoy",
    era: "Listo para usar",
    items: [
      "Kanban, backlog y planeación semanal/mensual para todo tu equipo",
      "Flujos de trabajo a tu medida: define tus propios estados, prioridades y tipos de actividad",
      "Plantillas de inicio: TI clásico, Kanban simple o mesa de ayuda",
      "Tu equipo entra solo con un código de acceso — sin invitaciones por correo que se pierden en spam",
      "Reportes y métricas de avance por persona, equipo y periodo",
      "Sincronización opcional con Google Sheets, si ya vives ahí",
    ],
    badge: "core del producto",
    icon: Check,
    style: "emerald",
  },
  {
    id: "proximamente",
    title: "En desarrollo",
    era: "Próximamente",
    items: [
      "Plan Cloud: nosotros alojamos y actualizamos por ti, sin que toques un servidor",
      "Facturación simple por número de usuarios activos",
      "Respaldos automáticos administrados",
    ],
    badge: "en construcción",
    icon: MoveRight,
    style: "neutral",
  },
  {
    id: "futuro",
    title: "Futuro",
    era: "Sin fecha",
    items: [
      "Inicio de sesión único (SSO/SAML) para tu empresa",
      "Auditoría de actividad para cumplimiento y seguridad",
      "Permisos más finos por equipo o proyecto",
      "Integraciones adicionales (Slack, Jira, calendario)",
    ],
    badge: "bajo evaluación",
    icon: CircleDashed,
    style: "dashed",
  },
];

const STYLE_MAP = {
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
            {"// lo que viene"}
          </span>
          <h2 className="mt-4 font-display text-4xl font-bold tracking-tight text-white md:text-6xl">
            De backlog en hojas de cálculo a un motor que{" "}
            <span className="text-gradient-flow">se adapta a tu equipo</span>.
          </h2>
          <p className="mt-5 text-sm leading-relaxed text-gray-400 md:text-lg">
            Lo que ya puedes usar hoy, lo que estamos construyendo y hacia dónde va el producto.
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
                    <ul className="mt-3.5 space-y-2">
                      {p.items.map((item) => (
                        <li
                          key={item}
                          className="flex items-start gap-2.5 text-sm leading-relaxed text-gray-400"
                        >
                          <p.icon
                            className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${s.glow || "text-gray-500"}`}
                          />
                          {item}
                        </li>
                      ))}
                    </ul>
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
