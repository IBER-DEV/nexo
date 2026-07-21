import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, LayoutGroup, motion, useInView } from "framer-motion";
import {
  Activity,
  ArrowLeftRight,
  CheckCircle2,
  CircleDashed,
  Loader2,
  Play,
  RotateCcw,
  Rocket,
  Sheet,
  Timer,
} from "lucide-react";
import { EASE, fadeUp } from "./anim";

// ─── Plantillas reales del producto ──────────────────────────────────────────
// Datos espejo de backend/apps/activities/workflow_templates/*.json (estados
// visibles en Kanban, colores hex exactos y prioridades). La landing está
// deliberadamente aislada de la app, así que se duplican como constantes — si
// una plantilla cambia en el backend, actualizar aquí a mano.

type StateCategoria = "todo" | "active" | "done";

type TemplateState = {
  id: string;
  nombre: string;
  color: string;
  categoria: StateCategoria;
};

type TemplateCard = {
  id: string;
  ref: string;
  title: string;
  priority: { nombre: string; color: string };
  assignee: string;
};

type LandingTemplate = {
  key: string;
  nombre: string;
  tagline: string;
  chrome: string;
  states: TemplateState[];
  cards: TemplateCard[];
  /** Estado del tablero por paso de la simulación: cardId -> stateId */
  steps: Record<string, string>[];
};

const GRIS = "#7C8A93";
const AZUL = "#29AFF5";
const AMBAR = "#F0A93B";
const INDIGO = "#5B6EF5";
const VERDE = "#22B573";
const ROJO = "#E5484D";

const TEMPLATES: LandingTemplate[] = [
  {
    key: "ti_clasico",
    nombre: "TI clásico",
    tagline: "equipos de TI e infraestructura",
    chrome: "nexo — tablero / ti-clasico",
    states: [
      { id: "backlog", nombre: "Backlog", color: GRIS, categoria: "todo" },
      { id: "progreso", nombre: "En progreso", color: AZUL, categoria: "active" },
      { id: "pruebas", nombre: "En pruebas", color: AMBAR, categoria: "active" },
      { id: "finalizado", nombre: "Finalizado", color: VERDE, categoria: "done" },
    ],
    cards: [
      {
        id: "db",
        ref: "ACT-0104",
        title: "Migrar BD a PostgreSQL",
        priority: { nombre: "Crítica", color: ROJO },
        assignee: "AR",
      },
      {
        id: "ssl",
        ref: "ACT-0097",
        title: "Renovar certificado SSL",
        priority: { nombre: "Alta", color: AMBAR },
        assignee: "MK",
      },
      {
        id: "cicd",
        ref: "ACT-0112",
        title: "Configurar pipeline CI/CD",
        priority: { nombre: "Media", color: AZUL },
        assignee: "JL",
      },
      {
        id: "docs",
        ref: "ACT-0088",
        title: "Documentar rotación de accesos",
        priority: { nombre: "Baja", color: GRIS },
        assignee: "TW",
      },
    ],
    steps: [
      { db: "backlog", ssl: "backlog", cicd: "progreso", docs: "finalizado" },
      { db: "backlog", ssl: "progreso", cicd: "pruebas", docs: "finalizado" },
      { db: "progreso", ssl: "progreso", cicd: "finalizado", docs: "finalizado" },
      { db: "progreso", ssl: "pruebas", cicd: "finalizado", docs: "finalizado" },
      { db: "pruebas", ssl: "finalizado", cicd: "finalizado", docs: "finalizado" },
      { db: "finalizado", ssl: "finalizado", cicd: "finalizado", docs: "finalizado" },
    ],
  },
  {
    key: "kanban_simple",
    nombre: "Kanban simple",
    tagline: "equipos pequeños y agile puro",
    chrome: "nexo — tablero / kanban-simple",
    states: [
      { id: "pendiente", nombre: "Pendiente", color: GRIS, categoria: "todo" },
      { id: "curso", nombre: "En curso", color: AZUL, categoria: "active" },
      { id: "hecho", nombre: "Hecho", color: VERDE, categoria: "done" },
    ],
    cards: [
      {
        id: "onboarding",
        ref: "PRD-0031",
        title: "Rediseñar onboarding de la app",
        priority: { nombre: "Alta", color: ROJO },
        assignee: "SC",
      },
      {
        id: "metricas",
        ref: "PRD-0028",
        title: "Dashboard de métricas de uso",
        priority: { nombre: "Normal", color: AZUL },
        assignee: "DV",
      },
      {
        id: "feedback",
        ref: "PRD-0034",
        title: "Encuesta de feedback trimestral",
        priority: { nombre: "Baja", color: GRIS },
        assignee: "LP",
      },
      {
        id: "landing",
        ref: "PRD-0025",
        title: "A/B test del pricing",
        priority: { nombre: "Normal", color: AZUL },
        assignee: "SC",
      },
    ],
    steps: [
      { onboarding: "pendiente", metricas: "curso", feedback: "pendiente", landing: "hecho" },
      { onboarding: "curso", metricas: "curso", feedback: "pendiente", landing: "hecho" },
      { onboarding: "curso", metricas: "hecho", feedback: "pendiente", landing: "hecho" },
      { onboarding: "curso", metricas: "hecho", feedback: "curso", landing: "hecho" },
      { onboarding: "hecho", metricas: "hecho", feedback: "curso", landing: "hecho" },
      { onboarding: "hecho", metricas: "hecho", feedback: "hecho", landing: "hecho" },
    ],
  },
  {
    key: "mesa_ayuda",
    nombre: "Mesa de ayuda",
    tagline: "soporte y service desk",
    chrome: "nexo — tablero / mesa-ayuda",
    states: [
      { id: "nuevo", nombre: "Nuevo", color: GRIS, categoria: "todo" },
      { id: "atencion", nombre: "En atención", color: AZUL, categoria: "active" },
      { id: "esperando", nombre: "Esperando al cliente", color: INDIGO, categoria: "active" },
      { id: "resuelto", nombre: "Resuelto", color: VERDE, categoria: "done" },
    ],
    cards: [
      {
        id: "impresora",
        ref: "MDA-0212",
        title: "Impresora de piso 3 sin red",
        priority: { nombre: "Urgente", color: ROJO },
        assignee: "GT",
      },
      {
        id: "vpn",
        ref: "MDA-0209",
        title: "Acceso VPN para proveedor externo",
        priority: { nombre: "Alta", color: AMBAR },
        assignee: "RB",
      },
      {
        id: "correo",
        ref: "MDA-0215",
        title: "Buzón lleno — ampliar cuota",
        priority: { nombre: "Media", color: AZUL },
        assignee: "GT",
      },
      {
        id: "licencia",
        ref: "MDA-0204",
        title: "Renovar licencia de antivirus",
        priority: { nombre: "Baja", color: GRIS },
        assignee: "NP",
      },
    ],
    steps: [
      { impresora: "nuevo", vpn: "atencion", correo: "nuevo", licencia: "resuelto" },
      { impresora: "atencion", vpn: "esperando", correo: "nuevo", licencia: "resuelto" },
      { impresora: "atencion", vpn: "esperando", correo: "atencion", licencia: "resuelto" },
      { impresora: "resuelto", vpn: "esperando", correo: "atencion", licencia: "resuelto" },
      { impresora: "resuelto", vpn: "atencion", correo: "resuelto", licencia: "resuelto" },
      { impresora: "resuelto", vpn: "resuelto", correo: "resuelto", licencia: "resuelto" },
    ],
  },
];

const CATEGORY_ICON: Record<StateCategoria, typeof CircleDashed> = {
  todo: CircleDashed,
  active: Timer,
  done: CheckCircle2,
};

export default function BoardSimulator() {
  const [templateKey, setTemplateKey] = useState(TEMPLATES[0].key);
  const [step, setStep] = useState(0);
  const [running, setRunning] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const inView = useInView(boardRef, { amount: 0.2 });

  const template = TEMPLATES.find((t) => t.key === templateKey) ?? TEMPLATES[0];
  const doneStateIds = new Set(
    template.states.filter((s) => s.categoria === "done").map((s) => s.id),
  );

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setRunning(false);
  };

  // Pause the simulation when scrolled out of view
  useEffect(() => {
    if (!inView && running) stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView]);

  useEffect(() => stop, []);

  const selectTemplate = (key: string) => {
    if (key === templateKey) return;
    stop();
    setTemplateKey(key);
    setStep(0);
  };

  // Autoplay: buena parte del valor de la demo se pierde si nadie descubre el
  // botón "Simular sprint" — así que el sprint arranca solo al elegir plantilla
  // (y en la carga inicial), sin esperar un clic.
  useEffect(() => {
    if (!inView) return;
    const t = setTimeout(() => run(), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateKey, inView]);

  const run = () => {
    if (running) return;
    if (step >= template.steps.length - 1) setStep(0);
    setRunning(true);
    timer.current = setInterval(() => {
      setStep((s) => {
        if (s >= template.steps.length - 1) {
          stop();
          return s;
        }
        return s + 1;
      });
    }, 950);
  };

  const reset = () => {
    stop();
    setStep(0);
  };

  const board = template.steps[step];
  const done = step >= template.steps.length - 1;
  const completedCount = template.cards.filter((c) => doneStateIds.has(board[c.id])).length;
  const velocity = Math.round((step / (template.steps.length - 1)) * 100);

  return (
    <section id="demo" className="relative overflow-hidden bg-surface py-28 md:py-36">
      {/* thin grid overlay */}
      <div className="bg-grid-thin pointer-events-none absolute inset-0 opacity-60 mask-fade-b" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-px w-2/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-hairline to-transparent" />

      <div className="relative mx-auto max-w-7xl px-5 md:px-8">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.4 }}
          className="mx-auto max-w-2xl text-center"
        >
          <span className="font-mono text-xs uppercase tracking-widest text-emerald-400">
            {"// demo interactiva"}
          </span>
          <h2 className="mt-4 font-display text-4xl font-bold tracking-tight text-white md:text-6xl">
            Elige tu flujo. <span className="text-gradient-flow">Míralo funcionar</span>.
          </h2>
          <p className="mt-5 text-sm leading-relaxed text-gray-400 md:text-lg">
            Estas son las tres plantillas reales con las que arranca una organización al registrarse
            — estados, colores y prioridades exactos del producto. Después las ajustas a tu equipo
            sin tocar código: agrega estados, cambia colores, reordena.
          </p>
        </motion.div>

        {/* template picker */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.4 }}
          custom={1}
          className="mt-10 flex flex-wrap items-center justify-center gap-2.5"
        >
          {TEMPLATES.map((t) => {
            const active = t.key === templateKey;
            return (
              <button
                key={t.key}
                onClick={() => selectTemplate(t.key)}
                className={`group rounded-full border px-4 py-2 text-left transition-all duration-300 ${
                  active
                    ? "border-emerald-500/50 bg-emerald-500/10"
                    : "border-hairline bg-surface/70 hover:border-gray-600"
                }`}
              >
                <span
                  className={`block text-sm font-semibold ${
                    active ? "text-emerald-300" : "text-gray-200"
                  }`}
                >
                  {t.nombre}
                </span>
                <span className="block font-mono text-[10px] uppercase tracking-wider text-gray-500">
                  {t.tagline}
                </span>
              </button>
            );
          })}
        </motion.div>

        <motion.div
          ref={boardRef}
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 1, ease: EASE, delay: 0.15 }}
          className="mt-10 rounded-2xl border border-hairline bg-ink/80 shadow-[0_40px_80px_-40px_rgba(0,0,0,0.8)] backdrop-blur"
        >
          {/* window chrome */}
          <div className="flex items-center justify-between border-b border-hairline px-5 py-3.5">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
              <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
              <span className="h-3 w-3 rounded-full bg-[#28c840]" />
              <span className="ml-3 hidden font-mono text-xs text-gray-500 sm:block">
                {template.chrome}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden items-center gap-1.5 font-mono text-xs text-gray-500 md:flex">
                <Activity className="h-3.5 w-3.5 text-emerald-400" />
                velocity {velocity}%
              </span>
              <button
                onClick={run}
                disabled={running}
                className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold transition-all duration-300 ${
                  running
                    ? "cursor-wait bg-hairline text-gray-400"
                    : "bg-emerald-500 text-gray-950 hover:bg-emerald-400 hover:shadow-[0_0_20px_-4px_rgba(52,211,153,0.8)]"
                }`}
              >
                {running ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
                {running ? "Sprint en curso…" : done ? "Repetir" : "Simular sprint"}
              </button>
              <button
                onClick={reset}
                className="rounded-full border border-hairline p-1.5 text-gray-400 transition-colors hover:border-gray-500 hover:text-white"
                aria-label="Reiniciar tablero"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* velocity bar */}
          <div className="border-b border-hairline px-5 py-3">
            <div className="mb-1.5 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-gray-500">
              <span>velocity semanal</span>
              <span className="text-emerald-400">
                {completedCount} / {template.cards.length} actividades finalizadas
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-hairline/60">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-emerald-500 to-emerald-400"
                animate={{ width: `${velocity}%` }}
                transition={{ duration: 0.9, ease: EASE }}
              />
            </div>
          </div>

          {/* kanban columns — se reconstruyen al cambiar de plantilla */}
          <LayoutGroup>
            <motion.div
              key={template.key}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, ease: EASE }}
              className={`grid gap-4 p-5 ${
                template.states.length === 3 ? "md:grid-cols-3" : "md:grid-cols-4"
              }`}
            >
              {template.states.map((state) => {
                const Icon = CATEGORY_ICON[state.categoria];
                const cards = template.cards.filter((c) => board[c.id] === state.id);
                const isDone = state.categoria === "done";
                return (
                  <div
                    key={state.id}
                    className="min-h-[220px] rounded-xl border border-hairline/70 bg-surface/60 p-3"
                    style={{ borderTopColor: `${state.color}66`, borderTopWidth: 2 }}
                  >
                    <div className="mb-3 flex items-center justify-between px-1">
                      <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-300">
                        <Icon className="h-3.5 w-3.5" style={{ color: state.color }} />
                        {state.nombre}
                      </span>
                      <span className="rounded-full bg-hairline/60 px-2 py-0.5 font-mono text-[10px] text-gray-400">
                        {cards.length}
                      </span>
                    </div>
                    <div className="space-y-2.5">
                      <AnimatePresence mode="popLayout">
                        {cards.map((card) => (
                          <motion.div
                            key={card.id}
                            layout
                            layoutId={`${template.key}-${card.id}`}
                            initial={{ opacity: 0, scale: 0.92 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.88 }}
                            transition={{ type: "spring", stiffness: 320, damping: 30 }}
                            whileHover={{ y: -2 }}
                            className={`cursor-default rounded-lg border p-3.5 backdrop-blur transition-colors ${
                              isDone
                                ? "border-emerald-500/20 bg-emerald-500/[0.04]"
                                : "border-hairline bg-ink/70 hover:border-gray-600"
                            }`}
                          >
                            <div className="mb-2 flex items-center justify-between">
                              <span className="font-mono text-[10px] text-gray-500">
                                {card.ref}
                              </span>
                              <span
                                className="rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider"
                                style={{
                                  color: card.priority.color,
                                  borderColor: `${card.priority.color}4d`,
                                  backgroundColor: `${card.priority.color}1a`,
                                }}
                              >
                                {card.priority.nombre}
                              </span>
                            </div>
                            <p
                              className={`text-sm font-medium leading-snug ${
                                isDone
                                  ? "text-gray-500 line-through decoration-gray-600"
                                  : "text-gray-200"
                              }`}
                            >
                              {card.title}
                            </p>
                            <div className="mt-3 flex items-center justify-between">
                              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-hairline bg-surface font-mono text-[9px] text-gray-400">
                                {card.assignee}
                              </span>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                      {cards.length === 0 && (
                        <div className="rounded-lg border border-dashed border-hairline/60 py-6 text-center font-mono text-[10px] uppercase tracking-widest text-gray-600">
                          vacío
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </motion.div>
          </LayoutGroup>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="mt-8 flex justify-center"
        >
          <Link
            to="/signup"
            search={{ template: template.key }}
            className="group flex items-center gap-2.5 rounded-full bg-emerald-500 px-7 py-3 text-sm font-semibold text-gray-950 transition-all duration-300 hover:bg-emerald-400 hover:shadow-[0_0_24px_-6px_rgba(52,211,153,0.8)]"
          >
            <Rocket className="h-4 w-4 transition-transform duration-300 group-hover:-rotate-6" />
            Empieza con "{template.nombre}"
          </Link>
        </motion.div>

        <motion.p
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.6 }}
          className="mx-auto mt-6 max-w-xl text-center font-mono text-xs text-gray-500"
        >
          Cada organización numera sus actividades con su propio prefijo — ACT, PRD, MDA — y es
          dueña de su flujo desde el primer minuto.
        </motion.p>

        {/* Sync con Google Sheets — diferenciador confirmado (docs/roadmap/product.md), hoy
            enterrado como bullet en Pricing. El equipo que vive en una hoja de cálculo es el
            comprador más probable y necesita ver esto sin buscarlo. */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.4 }}
          custom={2}
          className="mx-auto mt-16 max-w-4xl rounded-2xl border border-hairline bg-ink/80 p-6 backdrop-blur md:p-8"
        >
          <div className="flex flex-col items-center gap-6 md:flex-row md:gap-8">
            <div className="flex shrink-0 items-center gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-400">
                <Sheet className="h-5 w-5" />
              </span>
              <ArrowLeftRight className="h-4 w-4 shrink-0 text-gray-600" />
              <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-hairline bg-surface text-gray-300">
                <Activity className="h-5 w-5" />
              </span>
            </div>
            <div className="text-center md:text-left">
              <h3 className="font-display text-lg font-bold text-white">
                ¿Tu equipo vive en Google Sheets?
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-gray-400">
                Nexo sincroniza actividades en ambas direcciones con Google Sheets/AppSheet — migra
                sin big bang, sin pedirle a nadie que abandone su hoja de cálculo de un día para
                otro. Ningún competidor directo lo trae nativo — en Jira, Asana o Monday esto se
                paga aparte, vía middleware.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
