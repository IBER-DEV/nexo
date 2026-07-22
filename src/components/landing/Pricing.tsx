import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Check, CheckCircle2, Cloud, Container, Copy, Loader2, Mail, Rocket } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/providers/AuthProvider";
import { ApiError } from "@/lib/api";
import { authService } from "@/services/authService";
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
  const [enteringDemo, setEnteringDemo] = useState(false);
  const [email, setEmail] = useState("");
  const [joiningWaitlist, setJoiningWaitlist] = useState(false);
  const [joinedWaitlist, setJoinedWaitlist] = useState(false);
  const { loginAsDemo } = useAuth();
  const navigate = useNavigate();

  const tryDemo = async () => {
    setEnteringDemo(true);
    try {
      await loginAsDemo();
      navigate({ to: "/" });
    } catch {
      toast.error("La demo pública no está disponible ahora mismo.");
    } finally {
      setEnteringDemo(false);
    }
  };

  const joinWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoiningWaitlist(true);
    try {
      await authService.joinWaitlist(email);
      setJoinedWaitlist(true);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? "Ese correo no se ve bien — revísalo e intenta de nuevo."
          : "No pudimos guardar tu correo. Intenta de nuevo.";
      toast.error(message);
    } finally {
      setJoiningWaitlist(false);
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
                aplica solo si vas a instalar Nexo en tu servidor o a usar Cloud.
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
                  / usuario / mes
                </span>
              </div>
              <p className="mt-1.5 text-xs text-gray-500">
                Estimado para el lanzamiento — el precio final se confirma antes de abrir el acceso
                beta.
              </p>
              <ul className="mt-7 flex-1 space-y-3.5">
                {CLOUD_FEATURES.map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm text-gray-200">
                    <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                    {f}
                  </li>
                ))}
              </ul>
              {joinedWaitlist ? (
                <div className="mt-9 flex w-full items-center justify-center gap-2.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-6 py-3 text-sm font-medium text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" />
                  Listo. Te avisaremos por correo cuando abramos el acceso beta.
                </div>
              ) : (
                <form onSubmit={joinWaitlist} className="mt-9 space-y-2.5">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@empresa.com"
                    className="w-full rounded-full border border-hairline bg-surface px-5 py-3 text-sm text-white placeholder:text-gray-500 focus:border-emerald-500/60 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={joiningWaitlist}
                    className="flex w-full items-center justify-center gap-2.5 rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500 px-6 py-3 text-sm font-semibold text-white transition-all duration-300 animate-pulse-glow hover:brightness-110 disabled:opacity-60"
                  >
                    {joiningWaitlist ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Mail className="h-4 w-4" />
                    )}
                    Unirse a la lista de espera
                  </button>
                </form>
              )}
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
