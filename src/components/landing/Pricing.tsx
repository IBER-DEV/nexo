import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Cloud,
  Container,
  Copy,
  Loader2,
  Rocket,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/providers/AuthProvider";
import { fadeUp } from "./anim";
import { NEXO_REPO_URL } from "./NexoBrandMark";

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

// Cloud está disponible y es gratis: el mismo producto, alojado por nosotros.
// La lista de espera que vivía acá se quitó el 2026-09-16 — era un embudo sin
// nada al final: `/auth/signup/` lleva abierto desde el punto 4 de la Fase 1 y
// ya entregaba una organización completa. Ver docs/roadmap/sustainability.md.
const CLOUD_FEATURES = [
  "Exactamente el mismo producto, sin features recortadas",
  "Alojado por nosotros, actualizaciones automáticas",
  "Backups administrados",
  "Sin límite de usuarios ni tarjeta de crédito",
];

export default function Pricing() {
  const [copied, setCopied] = useState(false);
  const [enteringDemo, setEnteringDemo] = useState(false);
  const { loginAsDemo } = useAuth();
  const navigate = useNavigate();

  const tryDemo = async () => {
    setEnteringDemo(true);
    try {
      await loginAsDemo();
      navigate({ to: "/dashboard" });
    } catch {
      toast.error("La demo pública no está disponible ahora mismo.");
    } finally {
      setEnteringDemo(false);
    }
  };

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
            {"// precios"}
          </span>
          <h2 className="mt-4 font-display text-4xl font-bold tracking-tight text-white md:text-6xl">
            Gratis. <span className="text-gradient-flow">Todo</span>.
          </h2>
          <p className="mt-5 text-sm leading-relaxed text-gray-400 md:text-lg">
            Sin planes, sin límite de usuarios, sin tarjeta. El motor completo bajo AGPL-3.0 en tu
            servidor, y —cuando abramos— el mismo producto alojado por nosotros, también gratis.
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
                <h3 className="font-display text-lg font-bold text-white">Self-hosted</h3>
                <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
                  en tu servidor · disponible hoy
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
              <button
                onClick={tryDemo}
                disabled={enteringDemo}
                className="flex w-full items-center justify-center gap-2.5 rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-gray-950 transition-all duration-300 hover:bg-emerald-400 hover:shadow-[0_0_24px_-6px_rgba(52,211,153,0.8)] disabled:opacity-60"
              >
                {enteringDemo ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Rocket className="h-4 w-4" />
                )}
                {enteringDemo ? "entrando…" : "Probar sin instalar"}
              </button>
              <p className="text-center text-xs text-gray-500">
                Entra directo a una demo con datos de muestra — sin registro.{" "}
                <Link
                  to="/signup"
                  className="text-gray-300 underline underline-offset-2 hover:text-white"
                >
                  Crear cuenta
                </Link>{" "}
                aplica cuando vayas a usarlo en serio.
              </p>
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

          {/* Nexo Cloud — mismo producto, gratis y disponible hoy */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.3 }}
            custom={2}
            className="relative rounded-2xl bg-gradient-to-br from-indigo-500 via-emerald-500/70 to-emerald-400 p-px transition-transform duration-500 hover:-translate-y-1"
          >
            <span className="absolute -top-3.5 left-1/2 z-10 -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500 px-4 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest text-white shadow-[0_0_20px_-2px_rgba(52,211,153,0.6)]">
              disponible ahora
            </span>
            <div className="flex h-full flex-col rounded-2xl bg-ink p-8">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                  <Cloud className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-display text-lg font-bold text-white">Nexo Cloud</h3>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
                    alojado por nosotros · sin instalar nada
                  </p>
                </div>
              </div>
              <div className="mt-7 flex items-baseline gap-2.5">
                <span className="font-display text-5xl font-bold tracking-tight text-white">
                  $0
                </span>
                <span className="font-mono text-xs uppercase tracking-widest text-emerald-400">
                  / también gratis
                </span>
              </div>
              <p className="mt-1.5 text-xs text-gray-500">
                Sin tarjeta, sin lista de espera y sin período de prueba que venza. Creas tu
                organización y ya estás trabajando.
              </p>
              <ul className="mt-7 flex-1 space-y-3.5">
                {CLOUD_FEATURES.map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm text-gray-200">
                    <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-9 space-y-3">
                <Link
                  to="/signup"
                  className="flex w-full items-center justify-center gap-2.5 rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500 px-6 py-3 text-sm font-semibold text-white transition-all duration-300 animate-pulse-glow hover:brightness-110"
                >
                  Crear mi organización gratis
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <p className="text-center text-xs text-gray-500">
                  Toma menos de un minuto. Después invitas a tu equipo con un código de acceso.
                </p>
              </div>
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
          AGPL-3.0 · ninguna feature detrás de un pago · exporta tus datos cuando quieras
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
