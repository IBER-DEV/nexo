import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { ArrowUpRight, Eye, Github, MessagesSquare } from "lucide-react";
import { EASE } from "./anim";
import { NEXO_DISCUSSIONS_URL, NEXO_REPO_URL, NexoBrandMark } from "./NexoBrandMark";

// Comando real de autoalojamiento (README.md) — no una CLI ficticia: Nexo no
// distribuye un binario `nexo`, se levanta con Docker Compose.
const CMD = "docker compose up --build";
const CTA = "¿Listo para ordenar el trabajo de tu equipo de TI?";

const BOOT_LINES = [
  { text: "▸ clonando github.com/IBER-DEV/nexo … ok", color: "text-gray-500" },
  { text: "▸ montando módulos: kanban, backlog, planeación … ok", color: "text-gray-500" },
  {
    text: "▸ plantillas de flujo: ti_clasico · kanban_simple · mesa_ayuda … ok",
    color: "text-gray-500",
  },
  { text: "▸ guardas de rol [owner · admin · coordinador · miembro] … ok", color: "text-gray-500" },
  { text: "✓ listo para autoalojar", color: "text-emerald-400" },
];

function useUtcClock() {
  // Arranca en null para que el HTML de SSR y la hidratación coincidan;
  // el reloj real solo existe en el cliente.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!now) return "UTC: --";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `UTC: ${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())} ${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`;
}

export default function Footer() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.35 });
  const clock = useUtcClock();

  const [cmdLen, setCmdLen] = useState(0);
  const [bootStep, setBootStep] = useState(0);
  const [ctaLen, setCtaLen] = useState(0);
  const [showPortal, setShowPortal] = useState(false);

  // Sequential typing: command -> boot lines -> big CTA -> portal
  useEffect(() => {
    if (!inView) return;
    let i = 0;
    const typeCmd = setInterval(() => {
      i++;
      setCmdLen(i);
      if (i >= CMD.length) {
        clearInterval(typeCmd);
        let b = 0;
        const boot = setInterval(() => {
          b++;
          setBootStep(b);
          if (b >= BOOT_LINES.length) {
            clearInterval(boot);
            let c = 0;
            const typeCta = setInterval(() => {
              c++;
              setCtaLen(c);
              if (c >= CTA.length) {
                clearInterval(typeCta);
                setShowPortal(true);
              }
            }, 34);
          }
        }, 260);
      }
    }, 55);
    return () => clearInterval(typeCmd);
  }, [inView]);

  const socials = [
    { icon: Github, label: "GitHub", href: NEXO_REPO_URL },
    { icon: MessagesSquare, label: "Discussions", href: NEXO_DISCUSSIONS_URL },
  ];

  return (
    <footer
      id="terminal"
      className="sticky bottom-0 z-0 flex min-h-screen flex-col justify-end bg-[#02040c]"
    >
      {/* ambient glows */}
      <div className="pointer-events-none absolute left-1/4 top-16 h-72 w-72 rounded-full bg-emerald-500/[0.07] blur-[110px]" />
      <div className="pointer-events-none absolute bottom-24 right-1/4 h-72 w-72 rounded-full bg-indigo-500/[0.08] blur-[110px]" />

      <div
        ref={ref}
        className="relative mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center px-5 py-24 md:px-8"
      >
        <div className="overflow-hidden rounded-2xl border border-hairline bg-ink/90 shadow-[0_60px_120px_-40px_rgba(0,0,0,0.9)]">
          {/* terminal chrome */}
          <div className="flex items-center justify-between border-b border-hairline px-5 py-3">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
            </div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-gray-600">
              guest@nexo: ~
            </span>
            <span className="font-mono text-[10px] text-gray-600">{clock}</span>
          </div>

          <div className="min-h-[300px] p-6 font-mono md:p-9">
            {/* command line */}
            <p className="text-sm md:text-base">
              <span className="text-emerald-400">guest@nexo</span>
              <span className="text-gray-600">:</span>
              <span className="text-indigo-400">~</span>
              <span className="text-gray-600">$ </span>
              <span className="text-gray-100">{CMD.slice(0, cmdLen)}</span>
              {cmdLen < CMD.length && <span className="terminal-caret" />}
            </p>

            {/* boot lines */}
            <div className="mt-3 space-y-1.5 text-xs md:text-sm">
              {BOOT_LINES.slice(0, bootStep).map((l) => (
                <motion.p
                  key={l.text}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, ease: EASE }}
                  className={l.color}
                >
                  {l.text}
                </motion.p>
              ))}
            </div>

            {/* big typed CTA */}
            <h2 className="mt-9 font-display text-3xl font-bold leading-tight tracking-tight text-white md:text-5xl">
              {CTA.slice(0, ctaLen)}
              {bootStep >= BOOT_LINES.length && ctaLen <= CTA.length && (
                <span className="terminal-caret" />
              )}
            </h2>

            {/* portal: email + socials */}
            <motion.div
              initial={false}
              animate={{ opacity: showPortal ? 1 : 0, y: showPortal ? 0 : 16 }}
              transition={{ duration: 0.8, ease: EASE }}
              className={showPortal ? "pointer-events-auto" : "pointer-events-none"}
            >
              <a
                href={`${NEXO_REPO_URL}/subscription`}
                target="_blank"
                rel="noreferrer"
                className="mt-8 flex max-w-lg items-center gap-3 rounded-lg border border-hairline bg-surface/80 px-5 py-3.5 font-mono text-sm text-gray-200 transition-all duration-300 hover:border-emerald-500/60 hover:text-white hover:shadow-[0_0_24px_-4px_rgba(52,211,153,0.5)]"
              >
                <Eye className="h-4 w-4 shrink-0 text-emerald-400" />
                <span>Watch releases en GitHub — así te enteras cuando haya novedades</span>
              </a>
              <p className="mt-3 max-w-lg font-mono text-[11px] text-gray-600">
                sin newsletter falsa: la actividad del repo es la única fuente de novedades hoy
              </p>

              <div className="mt-8 flex items-center gap-3">
                {socials.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={s.label}
                    className="group flex h-10 w-10 items-center justify-center rounded-lg border border-hairline bg-surface/60 text-gray-400 transition-all duration-300 hover:border-emerald-500/50 hover:text-emerald-400 hover:shadow-[0_0_18px_-4px_rgba(52,211,153,0.6)]"
                  >
                    <s.icon className="h-[18px] w-[18px]" />
                  </a>
                ))}
                <a
                  href="#top"
                  className="group ml-2 flex items-center gap-1.5 font-mono text-xs text-gray-500 transition-colors hover:text-emerald-400"
                >
                  volver arriba
                  <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </a>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* bottom bar */}
      <div className="relative border-t border-hairline/60">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-5 py-6 font-mono text-[11px] text-gray-600 md:flex-row md:px-8">
          <span className="flex items-center gap-2.5">
            <NexoBrandMark className="h-4.5 w-4.5" />© {new Date().getFullYear()} Nexo · gestión de
            actividades TI, open source
          </span>
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,0.7)]" />
            {clock}
          </span>
          <span>AGPL-3.0 · código abierto en GitHub</span>
        </div>
      </div>
    </footer>
  );
}
