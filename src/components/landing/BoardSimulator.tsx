import { useEffect, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion, useInView } from "framer-motion";
import {
  Activity,
  CheckCircle2,
  CircleDashed,
  Loader2,
  Play,
  RotateCcw,
  Timer,
} from "lucide-react";
import { EASE, fadeUp } from "./anim";

type ColumnId = "backlog" | "progress" | "done";

type Card = {
  id: string;
  ref: string;
  title: string;
  tag: string;
  tagColor: string;
  assignee: string;
};

// Códigos y estados reales de Activity (backend/apps/activities/models.py):
// codigo = ACT-{pk:04d}; Status.BACKLOG "Backlog", IN_PROGRESS "En progreso", DONE "Finalizado".
const CARDS: Card[] = [
  {
    id: "db",
    ref: "ACT-0104",
    title: "Migrar BD a PostgreSQL",
    tag: "infraestructura",
    tagColor: "text-indigo-300 border-indigo-500/30 bg-indigo-500/10",
    assignee: "AR",
  },
  {
    id: "ssl",
    ref: "ACT-0097",
    title: "Renovar certificado SSL",
    tag: "seguridad",
    tagColor: "text-amber-300 border-amber-500/30 bg-amber-500/10",
    assignee: "MK",
  },
  {
    id: "cicd",
    ref: "ACT-0112",
    title: "Configurar pipeline CI/CD",
    tag: "devops",
    tagColor: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10",
    assignee: "JL",
  },
  {
    id: "sprint",
    ref: "ACT-0088",
    title: "Refactor de planeación semanal",
    tag: "proceso",
    tagColor: "text-gray-300 border-gray-500/30 bg-gray-500/10",
    assignee: "TW",
  },
];

const COLUMNS: { id: ColumnId; label: string; icon: typeof CircleDashed }[] = [
  { id: "backlog", label: "Backlog", icon: CircleDashed },
  { id: "progress", label: "En progreso", icon: Timer },
  { id: "done", label: "Finalizado", icon: CheckCircle2 },
];

/** Estado del tablero por paso de la simulación: cardId -> columna */
const STEPS: Record<string, ColumnId>[] = [
  { db: "backlog", ssl: "backlog", cicd: "progress", sprint: "done" },
  { db: "backlog", ssl: "backlog", cicd: "done", sprint: "done" },
  { db: "progress", ssl: "backlog", cicd: "done", sprint: "done" },
  { db: "progress", ssl: "progress", cicd: "done", sprint: "done" },
  { db: "done", ssl: "progress", cicd: "done", sprint: "done" },
  { db: "done", ssl: "done", cicd: "done", sprint: "done" },
];

const VELOCITY = [12, 30, 45, 58, 79, 100];

export default function BoardSimulator() {
  const [step, setStep] = useState(0);
  const [running, setRunning] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const inView = useInView(boardRef, { amount: 0.2 });

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

  const run = () => {
    if (running) return;
    if (step >= STEPS.length - 1) setStep(0);
    setRunning(true);
    timer.current = setInterval(() => {
      setStep((s) => {
        if (s >= STEPS.length - 1) {
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

  const board = STEPS[step];
  const done = step >= STEPS.length - 1;
  const completedCount = CARDS.filter((c) => board[c.id] === "done").length;

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
            Mira un sprint <span className="text-gradient-flow">moverse solo</span>.
          </h2>
          <p className="mt-5 text-sm leading-relaxed text-gray-400 md:text-lg">
            Una porción real del tablero de Nexo. Simula un sprint y mira cómo las actividades del
            backlog avanzan por el pipeline mientras la velocity semanal se actualiza en tiempo
            real.
          </p>
        </motion.div>

        <motion.div
          ref={boardRef}
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 1, ease: EASE, delay: 0.15 }}
          className="mt-14 rounded-2xl border border-hairline bg-ink/80 shadow-[0_40px_80px_-40px_rgba(0,0,0,0.8)] backdrop-blur"
        >
          {/* window chrome */}
          <div className="flex items-center justify-between border-b border-hairline px-5 py-3.5">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
              <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
              <span className="h-3 w-3 rounded-full bg-[#28c840]" />
              <span className="ml-3 hidden font-mono text-xs text-gray-500 sm:block">
                nexo — tablero / vista-demo
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden items-center gap-1.5 font-mono text-xs text-gray-500 md:flex">
                <Activity className="h-3.5 w-3.5 text-emerald-400" />
                velocity {VELOCITY[step]}%
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
              <span className="text-emerald-400">{completedCount} / 4 actividades finalizadas</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-hairline/60">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-emerald-500 to-emerald-400"
                animate={{ width: `${VELOCITY[step]}%` }}
                transition={{ duration: 0.9, ease: EASE }}
              />
            </div>
          </div>

          {/* kanban columns */}
          <LayoutGroup>
            <div className="grid gap-4 p-5 md:grid-cols-3">
              {COLUMNS.map((col) => {
                const cards = CARDS.filter((c) => board[c.id] === col.id);
                return (
                  <div
                    key={col.id}
                    className="min-h-[220px] rounded-xl border border-hairline/70 bg-surface/60 p-3"
                  >
                    <div className="mb-3 flex items-center justify-between px-1">
                      <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-300">
                        <col.icon
                          className={`h-3.5 w-3.5 ${
                            col.id === "done"
                              ? "text-emerald-400"
                              : col.id === "progress"
                                ? "text-indigo-400"
                                : "text-gray-500"
                          }`}
                        />
                        {col.label}
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
                            layoutId={card.id}
                            initial={{ opacity: 0, scale: 0.92 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.88 }}
                            transition={{ type: "spring", stiffness: 320, damping: 30 }}
                            whileHover={{ y: -2 }}
                            className={`cursor-default rounded-lg border p-3.5 backdrop-blur transition-colors ${
                              col.id === "done"
                                ? "border-emerald-500/20 bg-emerald-500/[0.04]"
                                : "border-hairline bg-ink/70 hover:border-gray-600"
                            }`}
                          >
                            <div className="mb-2 flex items-center justify-between">
                              <span className="font-mono text-[10px] text-gray-500">
                                {card.ref}
                              </span>
                              <span
                                className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${card.tagColor}`}
                              >
                                {card.tag}
                              </span>
                            </div>
                            <p
                              className={`text-sm font-medium leading-snug ${
                                col.id === "done"
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
            </div>
          </LayoutGroup>
        </motion.div>
      </div>
    </section>
  );
}
