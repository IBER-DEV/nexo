import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Check, CheckCircle2, Cloud, Container, Copy, Mail, Rocket } from "lucide-react";
import { fadeUp } from "./anim";
import { NEXO_DISCUSSIONS_URL, NEXO_REPO_URL } from "./NexoBrandMark";

// El comando debe ser autosuficiente: "docker compose up --build" solo, sin el
// clone previo, no hace nada — es el bug de comprensión #1 del quickstart.
const DOCKER_CMD = `git clone ${NEXO_REPO_URL}.git && cd nexo && docker compose up --build`;
const DOCKER_CMD_LABEL = "git clone && docker compose up --build";

const COMMUNITY_FEATURES = [
  "100% open source (AGPL-3.0)",
  "Kanban, backlog y planeación semanal/mensual",
  "Flujos configurables: estados, prioridades y tipos por organización",
  "Plantillas de inicio: TI clásico · Kanban simple · Mesa de ayuda",
  "Registro self-service y códigos de acceso para tu equipo",
  "Sync opcional con Google Sheets/AppSheet",
];

// $5–10 usd/usuario/mes y Enterprise (contrato anual) son la meta de precio
// documentada en docs/ROADMAP.md — Cloud/Enterprise todavía no están construidos (Fase 1/2).
const CLOUD_FEATURES = [
  "Alojado por nosotros, actualizaciones automáticas",
  "Backups administrados",
  "SSO/SAML y auditoría (Enterprise)",
  "Soporte prioritario",
];

export default function Pricing() {
  const [copied, setCopied] = useState(false);

  const copyCmd = async () => {
    try {
      await navigator.clipboard.writeText(DOCKER_CMD);
    } catch {
      // clipboard may be unavailable (non-secure context) — fall back gracefully
      const ta = document.createElement("textarea");
      ta.value = DOCKER_CMD;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  return (
    <section id="pricing" className="relative overflow-hidden bg-surface py-28 md:py-36">
      <div className="bg-grid-thin pointer-events-none absolute inset-0 opacity-40 mask-fade-b" />
      <div className="pointer-events-none absolute right-1/4 top-0 h-72 w-96 rounded-full bg-indigo-500/[0.07] blur-[120px]" />

      <div className="relative mx-auto max-w-5xl px-5 md:px-8">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.4 }}
          className="mx-auto max-w-2xl text-center"
        >
          <span className="font-mono text-xs uppercase tracking-widest text-emerald-400">
            {"// precios y modelo open core"}
          </span>
          <h2 className="mt-4 font-display text-4xl font-bold tracking-tight text-white md:text-6xl">
            Abierto en el <span className="text-gradient-flow">núcleo</span>.
          </h2>
          <p className="mt-5 text-sm leading-relaxed text-gray-400 md:text-lg">
            Autoaloja el motor completo gratis, para siempre. Cloud y Enterprise están en el roadmap
            — todavía no son un producto activo.
          </p>
        </motion.div>

        <div className="mt-16 grid gap-6 md:grid-cols-2 md:gap-8">
          {/* Community — disponible hoy */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.3 }}
            custom={1}
            className="flex flex-col rounded-2xl border border-hairline bg-ink p-8 transition-transform duration-500 hover:-translate-y-1"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-hairline bg-surface text-gray-300">
                <Container className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-display text-lg font-bold text-white">Community</h3>
                <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
                  self-hosted · disponible hoy
                </p>
              </div>
            </div>
            <div className="mt-7 flex items-baseline gap-2.5">
              <span className="font-display text-5xl font-bold tracking-tight text-white">$0</span>
              <span className="font-mono text-xs uppercase tracking-widest text-emerald-400">
                / gratis para siempre
              </span>
            </div>
            <ul className="mt-7 flex-1 space-y-3.5">
              {COMMUNITY_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-3 text-sm text-gray-300">
                  <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-9 space-y-3">
              <Link
                to="/signup"
                className="flex w-full items-center justify-center gap-2.5 rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-gray-950 transition-all duration-300 hover:bg-emerald-400 hover:shadow-[0_0_24px_-6px_rgba(52,211,153,0.8)]"
              >
                <Rocket className="h-4 w-4" />
                Probar sin instalar
              </Link>
              <button
                onClick={copyCmd}
                className={`group flex w-full items-center justify-center gap-2.5 rounded-full border px-6 py-3 font-mono text-sm transition-all duration-300 ${
                  copied
                    ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-300"
                    : "border-hairline bg-surface text-gray-300 hover:border-gray-500 hover:text-white"
                }`}
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    copiado al portapapeles
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 transition-transform group-hover:scale-110" />
                    {DOCKER_CMD_LABEL}
                  </>
                )}
              </button>
            </div>
          </motion.div>

          {/* Cloud / Enterprise — en el roadmap, no disponible aún */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.3 }}
            custom={2}
            className="relative rounded-2xl bg-gradient-to-br from-indigo-500 via-emerald-500/70 to-emerald-400 p-px transition-transform duration-500 hover:-translate-y-1"
          >
            <span className="absolute -top-3.5 left-1/2 z-10 -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500 px-4 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest text-white shadow-[0_0_20px_-2px_rgba(52,211,153,0.6)]">
              en el roadmap
            </span>
            <div className="flex h-full flex-col rounded-2xl bg-ink p-8">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                  <Cloud className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-display text-lg font-bold text-white">Cloud / Enterprise</h3>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
                    hospedado por nosotros · fase 1/2
                  </p>
                </div>
              </div>
              <div className="mt-7 flex items-baseline gap-2.5">
                <span className="font-display text-5xl font-bold tracking-tight text-white">
                  $5–10
                </span>
                <span className="font-mono text-xs uppercase tracking-widest text-gray-400">
                  / usuario / mes · meta de precio
                </span>
              </div>
              <ul className="mt-7 flex-1 space-y-3.5">
                {CLOUD_FEATURES.map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm text-gray-200">
                    <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href={NEXO_DISCUSSIONS_URL}
                target="_blank"
                rel="noreferrer"
                className="mt-9 flex w-full items-center justify-center gap-2.5 rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500 px-6 py-3 text-sm font-semibold text-white transition-all duration-300 animate-pulse-glow hover:brightness-110"
              >
                <Mail className="h-4 w-4" />
                Súmate a la lista de espera
              </a>
            </div>
          </motion.div>
        </div>

        <motion.p
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          custom={3}
          className="mt-10 text-center font-mono text-xs text-gray-600"
        >
          núcleo bajo AGPL-3.0 · sin feature flags en self-hosted · exporta tus datos cuando quieras
        </motion.p>
        <motion.p
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          custom={4}
          className="mt-2 text-center font-mono text-xs text-gray-600"
        >
          150+ tests corriendo en CI · imagen Docker publicada en GHCR en cada release
        </motion.p>
      </div>
    </section>
  );
}
