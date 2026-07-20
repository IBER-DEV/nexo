import { motion } from "framer-motion";
import {
  Blocks,
  Bot,
  Check,
  Clock,
  Github,
  Plug,
  Sheet,
  Sparkles,
  Terminal,
  Webhook,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { EASE, fadeUp } from "./anim";

type Capability = {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  status: "disponible" | "roadmap";
};

// Grounded en el estado real del código y en docs/ROADMAP.md — "disponible"
// solo para lo que ya existe hoy (AGPL, sync AppSheet, API REST del propio
// backend). Todo lo demás es dirección de producto, marcado como roadmap,
// no una promesa de fecha.
const CAPABILITIES: Capability[] = [
  {
    id: "open-source",
    label: "Open Source",
    description: "AGPL-3.0, autoalojable con Docker, código público desde el día uno.",
    icon: Github,
    status: "disponible",
  },
  {
    id: "sheets",
    label: "Google Sheets",
    description:
      "Sync bidireccional con AppSheet — migra equipos que hoy viven en hojas de cálculo.",
    icon: Sheet,
    status: "disponible",
  },
  {
    id: "api",
    label: "API REST",
    description: "La misma API que usa la app, con auth JWT — ya puedes construir sobre ella.",
    icon: Plug,
    status: "disponible",
  },
  {
    id: "automatizaciones",
    label: "Automatizaciones",
    description: "Reglas y disparadores sobre actividades y cambios de estado.",
    icon: Workflow,
    status: "roadmap",
  },
  {
    id: "ia",
    label: "IA",
    description: "Asistencia para triage, resúmenes y priorización del backlog.",
    icon: Bot,
    status: "roadmap",
  },
  {
    id: "webhooks",
    label: "Webhooks",
    description: "Notifica a otros sistemas cuando algo cambia en Nexo.",
    icon: Webhook,
    status: "roadmap",
  },
  {
    id: "mcp",
    label: "MCP",
    description: "Conecta Nexo a agentes de IA como fuente de datos y de acciones.",
    icon: Blocks,
    status: "roadmap",
  },
  {
    id: "cli",
    label: "CLI",
    description: "Administra actividades y catálogos desde la terminal.",
    icon: Terminal,
    status: "roadmap",
  },
  {
    id: "sdk",
    label: "SDK",
    description: "Clientes tipados para integrar Nexo en tus propias herramientas.",
    icon: Sparkles,
    status: "roadmap",
  },
];

const AVAILABLE = CAPABILITIES.filter((c) => c.status === "disponible");
const ROADMAP = CAPABILITIES.filter((c) => c.status === "roadmap");

export default function NexoEngine() {
  return (
    <section id="engine" className="relative overflow-hidden bg-ink py-28 md:py-36">
      <div className="bg-dots pointer-events-none absolute inset-0 opacity-30" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-indigo-500/[0.07] blur-[140px]" />

      <div className="relative mx-auto max-w-6xl px-5 md:px-8">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.4 }}
          className="mx-auto max-w-2xl text-center"
        >
          <span className="font-mono text-xs uppercase tracking-widest text-indigo-400">
            {"// el motor"}
          </span>
          <h2 className="mt-4 font-display text-5xl font-black tracking-tight text-white md:text-7xl">
            NEXO <span className="text-gradient-flow">ENGINE</span>
          </h2>
          <p className="mt-5 text-sm leading-relaxed text-gray-400 md:text-lg">
            Nexo no se detiene en backlog y Kanban — es la base para automatizar, integrar y
            construir sobre tu operación de TI.
          </p>
        </motion.div>

        {/* Disponible hoy — tarjetas grandes, la que gana peso visual */}
        <div className="mt-16 grid gap-5 sm:grid-cols-3">
          {AVAILABLE.map((cap, i) => (
            <motion.div
              key={cap.id}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.7, ease: EASE, delay: i * 0.06 }}
              className="relative rounded-2xl border border-emerald-500/40 bg-emerald-500/[0.05] p-6 backdrop-blur transition-transform duration-500 hover:-translate-y-1 shadow-[0_0_50px_-24px_rgba(16,185,129,0.5)]"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-500/50 text-emerald-400">
                  <cap.icon className="h-[18px] w-[18px]" />
                </span>
                <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/50 bg-emerald-500/15 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-emerald-300">
                  <Check className="h-3 w-3" />
                  Disponible
                </span>
              </div>
              <h3 className="mt-4 font-display text-xl font-bold tracking-tight text-white">
                {cap.label}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-gray-400">{cap.description}</p>
            </motion.div>
          ))}
        </div>

        {/* Roadmap — fila secundaria, más compacta a propósito: no es la mayoría del mensaje */}
        <div className="mt-10">
          <span className="font-mono text-[11px] uppercase tracking-widest text-gray-600">
            en el roadmap — todavía no son un producto activo
          </span>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ROADMAP.map((cap, i) => (
              <motion.div
                key={cap.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.6, ease: EASE, delay: i * 0.04 }}
                className="flex items-center gap-3 rounded-xl border border-dashed border-hairline bg-surface/40 px-4 py-3"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-hairline text-gray-500">
                  <cap.icon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-300">{cap.label}</p>
                  <p className="truncate text-xs text-gray-500">{cap.description}</p>
                </div>
                <Clock className="ml-auto h-3.5 w-3.5 shrink-0 text-gray-600" />
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
