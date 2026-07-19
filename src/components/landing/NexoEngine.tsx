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

        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map((cap, i) => {
            const available = cap.status === "disponible";
            return (
              <motion.div
                key={cap.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.7, ease: EASE, delay: i * 0.05 }}
                className={`relative rounded-2xl border p-5 backdrop-blur transition-transform duration-500 hover:-translate-y-1 ${
                  available
                    ? "border-emerald-500/40 bg-emerald-500/[0.05] shadow-[0_0_50px_-24px_rgba(16,185,129,0.5)]"
                    : "border-dashed border-hairline bg-surface/40"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                      available
                        ? "border-emerald-500/50 text-emerald-400"
                        : "border-hairline text-gray-500"
                    }`}
                  >
                    <cap.icon className="h-4 w-4" />
                  </span>
                  <span
                    className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest ${
                      available
                        ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
                        : "border-dashed border-gray-600/50 bg-transparent text-gray-500"
                    }`}
                  >
                    {available ? <Check className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                    {available ? "Disponible" : "Roadmap"}
                  </span>
                </div>
                <h3 className="mt-4 font-display text-lg font-bold tracking-tight text-white">
                  {cap.label}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-gray-400">{cap.description}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
