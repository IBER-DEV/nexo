import { useState, type ComponentType } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3,
  Building2,
  CheckSquare,
  Crown,
  GitBranch,
  KeyRound,
  ListChecks,
  Shield,
  ShieldCheck,
  Square,
  Users,
} from "lucide-react";
import { EASE, fadeUp } from "./anim";

type RoleId = "owner" | "admin" | "coordinator" | "member";

const ROLES: {
  id: RoleId;
  name: string;
  icon: typeof Crown;
  blurb: string;
  accent: string;
  accentBorder: string;
  accentBg: string;
}[] = [
  {
    id: "owner",
    name: "OWNER",
    icon: Crown,
    blurb: "Fundó la organización. Todo lo del admin, más los códigos de acceso del equipo.",
    accent: "text-amber-400",
    accentBorder: "border-amber-500/50",
    accentBg: "bg-amber-500/10",
  },
  {
    id: "admin",
    name: "ADMIN",
    icon: Shield,
    blurb: "Gestión de usuarios, flujos de trabajo y catálogos (clientes, procesos, aplicaciones).",
    accent: "text-indigo-400",
    accentBorder: "border-indigo-500/50",
    accentBg: "bg-indigo-500/10",
  },
  {
    id: "coordinator",
    name: "COORDINADOR",
    icon: Users,
    blurb: "Planeación semanal y mensual, asignación de actividades a su equipo, y reportes.",
    accent: "text-emerald-400",
    accentBorder: "border-emerald-500/50",
    accentBg: "bg-emerald-500/10",
  },
  {
    id: "member",
    name: "MIEMBRO",
    icon: GitBranch,
    blurb: "Tablero Kanban y sus propias actividades asignadas.",
    accent: "text-gray-300",
    accentBorder: "border-gray-400/40",
    accentBg: "bg-white/5",
  },
];

/* ---------- Role preview panes — reflejan features reales del producto ---------- */

function OwnerPreview() {
  const codes = [
    { codigo: "NEX4-7K2M-9QRT", rol: "Miembro", usos: "2 / 5", estado: "Vigente", vigente: true },
    {
      codigo: "WM8H-P3XA-K2VD",
      rol: "Coordinador",
      usos: "1 / 1",
      estado: "Agotado",
      vigente: false,
    },
  ];
  const team = [
    { name: "Ana García", role: "Coordinador", initials: "AG" },
    { name: "Carlos Pérez", role: "Miembro", initials: "CP" },
  ];
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-amber-400">
        <KeyRound className="h-4 w-4" />
        <span className="font-mono text-xs uppercase tracking-widest">códigos de acceso</span>
      </div>
      <div className="rounded-lg border border-hairline bg-ink/70 p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
            comparte un código — tu equipo entra solo
          </span>
          <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 font-mono text-[10px] text-amber-400">
            + generar
          </span>
        </div>
        <div className="space-y-2">
          {codes.map((c, i) => (
            <motion.div
              key={c.codigo}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, ease: EASE, delay: 0.1 * i }}
              className={`flex items-center justify-between rounded-md border px-3.5 py-2.5 ${
                c.vigente
                  ? "border-hairline/60 bg-surface/60"
                  : "border-hairline/40 bg-surface/30 opacity-60"
              }`}
            >
              <span className="font-mono text-xs tracking-wider text-gray-200">{c.codigo}</span>
              <div className="flex items-center gap-2 font-mono text-[10px]">
                <span className="rounded-full border border-hairline bg-ink px-2 py-0.5 uppercase tracking-widest text-gray-400">
                  {c.rol}
                </span>
                <span className="text-gray-500">{c.usos}</span>
                <span className={c.vigente ? "text-emerald-400" : "text-gray-600"}>{c.estado}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-hairline bg-ink/70 p-4">
        <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-gray-500">
          acceso del equipo — cambia roles, desactiva sin perder historial
        </div>
        <div className="space-y-2">
          {team.map((u) => (
            <div
              key={u.name}
              className="flex items-center justify-between rounded-md border border-hairline/60 bg-surface/60 px-3.5 py-2.5"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full border border-hairline bg-ink font-mono text-[10px] text-gray-300">
                  {u.initials}
                </span>
                <span className="text-sm text-gray-200">{u.name}</span>
              </div>
              <span className="rounded-full border border-hairline bg-ink px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-gray-400">
                {u.role} ▾
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AdminPreview() {
  const users = [
    { name: "Ana García", role: "Coordinador", initials: "AG" },
    { name: "Carlos Pérez", role: "Miembro", initials: "CP" },
    { name: "María López", role: "Miembro", initials: "ML" },
  ];
  const catalogs = [
    { name: "Clientes", count: 3 },
    { name: "Procesos", count: 6 },
    { name: "Aplicaciones", count: 9 },
  ];
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-indigo-400">
        <Shield className="h-4 w-4" />
        <span className="font-mono text-xs uppercase tracking-widest">usuarios y roles</span>
      </div>
      <div className="space-y-2">
        {users.map((u) => (
          <div
            key={u.name}
            className="flex items-center justify-between rounded-lg border border-hairline bg-ink/70 px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-hairline bg-surface font-mono text-[10px] text-gray-300">
                {u.initials}
              </span>
              <span className="text-sm text-gray-200">{u.name}</span>
            </div>
            <span className="rounded-full border border-hairline bg-surface px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-gray-400">
              {u.role}
            </span>
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-hairline bg-ink/70 p-4">
        <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-gray-500">
          <Building2 className="h-3.5 w-3.5" /> catálogos
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {catalogs.map((c) => (
            <div
              key={c.name}
              className="rounded-lg border border-hairline bg-surface/60 p-3 text-center"
            >
              <div className="font-display text-xl font-bold text-white">{c.count}</div>
              <div className="mt-0.5 font-mono text-[9px] uppercase tracking-widest text-gray-500">
                {c.name}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-hairline bg-ink/70 p-4 font-mono text-[11px] leading-relaxed">
        <span className="text-gray-600">$ </span>
        <span className="text-emerald-400">python manage.py</span>
        <span className="text-gray-300"> seed_data</span>
        <div className="mt-1.5 text-gray-500">✓ usuarios y actividades de prueba creados</div>
      </div>
    </div>
  );
}

function CoordinatorPreview() {
  const statusBreakdown = [
    { label: "Backlog", value: 14, color: "bg-gray-500" },
    { label: "En progreso", value: 9, color: "bg-indigo-500" },
    { label: "En pruebas", value: 4, color: "bg-amber-400" },
    { label: "Finalizado", value: 21, color: "bg-emerald-500" },
  ];
  const weeks = [
    { label: "Semana 1", value: 6 },
    { label: "Semana 2", value: 9 },
    { label: "Semana 3", value: 5 },
    { label: "Semana 4", value: 8 },
  ];
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-emerald-400">
        <BarChart3 className="h-4 w-4" />
        <span className="font-mono text-xs uppercase tracking-widest">planeación y reportes</span>
      </div>
      <div className="rounded-lg border border-hairline bg-ink/70 p-4">
        <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-gray-500">
          actividades por estado
        </div>
        <div className="space-y-2.5">
          {statusBreakdown.map((s, i) => (
            <div key={s.label}>
              <div className="mb-1 flex justify-between font-mono text-[11px] text-gray-400">
                <span>{s.label}</span>
                <span>{s.value}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-hairline/50">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(s.value / 21) * 100}%` }}
                  transition={{ duration: 1, ease: EASE, delay: 0.1 * i }}
                  className={`h-full rounded-full ${s.color}`}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-hairline bg-ink/70 p-4">
        <div className="mb-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-gray-500">
          <span>planeación mensual</span>
          <span className="text-emerald-400">julio</span>
        </div>
        <div className="flex h-20 items-end gap-2">
          {weeks.map((w, i) => (
            <motion.div
              key={w.label}
              initial={{ height: 0 }}
              animate={{ height: `${(w.value / 9) * 100}%` }}
              transition={{ duration: 0.8, ease: EASE, delay: 0.08 * i }}
              className="flex-1 rounded-t bg-gradient-to-t from-indigo-500/60 to-emerald-400/80"
            />
          ))}
        </div>
        <div className="mt-2 flex justify-between font-mono text-[9px] text-gray-600">
          {weeks.map((w) => (
            <span key={w.label}>{w.label.replace("Semana ", "S")}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function MemberPreview() {
  const tasks = [
    { ref: "ACT-0142", t: "Revisar PR — permisos por rol", done: false },
    { ref: "ACT-0139", t: "Corregir timeout en ingress nginx", done: true },
    { ref: "ACT-0135", t: "Documentar rotación de certificados", done: true },
    { ref: "ACT-0128", t: "Dry-run migración de PostgreSQL", done: false },
  ];
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-gray-300">
        <ListChecks className="h-4 w-4" />
        <span className="font-mono text-xs uppercase tracking-widest">mis actividades</span>
      </div>
      <div className="rounded-lg border border-hairline bg-ink/70 p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
            4 actividades asignadas
          </span>
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] text-emerald-400">
            2 finalizadas
          </span>
        </div>
        <div className="space-y-2">
          {tasks.map((task, i) => (
            <motion.div
              key={task.ref}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, ease: EASE, delay: 0.1 * i }}
              className="flex items-center gap-3 rounded-md border border-hairline/60 bg-surface/60 px-3.5 py-2.5"
            >
              {task.done ? (
                <CheckSquare className="h-4 w-4 shrink-0 text-emerald-400" />
              ) : (
                <Square className="h-4 w-4 shrink-0 text-gray-600" />
              )}
              <span className="font-mono text-[9px] text-gray-600">{task.ref}</span>
              <span
                className={`font-mono text-xs ${
                  task.done ? "text-gray-500 line-through" : "text-gray-300"
                }`}
              >
                {task.t}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

const PREVIEWS: Record<RoleId, { title: string; el: ComponentType }> = {
  owner: { title: "owner · códigos de acceso y equipo", el: OwnerPreview },
  admin: { title: "admin · usuarios y catálogos", el: AdminPreview },
  coordinator: { title: "coordinador · planeación y reportes", el: CoordinatorPreview },
  member: { title: "miembro · mis actividades", el: MemberPreview },
};

export default function RoleSelector() {
  const [role, setRole] = useState<RoleId>("owner");
  const active = ROLES.find((r) => r.id === role)!;
  const Preview = PREVIEWS[role].el;

  return (
    <section id="features" className="relative overflow-hidden bg-ink py-28 md:py-36">
      <div className="pointer-events-none absolute right-0 top-1/3 h-96 w-96 rounded-full bg-indigo-500/[0.06] blur-[130px]" />
      <div className="relative mx-auto max-w-7xl px-5 md:px-8">
        <div className="grid gap-14 lg:grid-cols-2 lg:gap-20">
          {/* Left — sticky text + selectors */}
          <div className="lg:sticky lg:top-28 lg:self-start">
            <motion.div
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.4 }}
            >
              <span className="font-mono text-xs uppercase tracking-widest text-indigo-400">
                {"// sistema de roles"}
              </span>
              <h2 className="mt-4 font-display text-4xl font-bold tracking-tight text-white md:text-6xl">
                Un solo motor.
                <br />
                Cuatro <span className="text-gradient-flow">roles reales</span>.
              </h2>
              <p className="mt-5 max-w-md text-sm leading-relaxed text-gray-400 md:text-lg">
                El sistema de roles de Nexo determina qué ve y qué puede hacer cada persona —
                permisos reales de la API, no solo maquillaje visual. El equipo entra con un código
                de acceso: sin invitaciones por correo que se pierden en spam.
              </p>
            </motion.div>

            <motion.div
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.4 }}
              custom={1}
              className="mt-9 space-y-3"
            >
              {ROLES.map((r) => {
                const selected = r.id === role;
                return (
                  <button
                    key={r.id}
                    onClick={() => setRole(r.id)}
                    className={`group flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-all duration-300 ${
                      selected
                        ? `${r.accentBorder} ${r.accentBg} shadow-[0_0_30px_-10px_rgba(99,102,241,0.4)]`
                        : "border-hairline bg-surface/50 hover:border-gray-600"
                    }`}
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                        selected
                          ? `${r.accentBorder} ${r.accent}`
                          : "border-hairline text-gray-500 group-hover:text-gray-300"
                      }`}
                    >
                      <r.icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span
                        className={`block font-mono text-xs font-semibold uppercase tracking-widest ${selected ? r.accent : "text-gray-300"}`}
                      >
                        {r.name}
                      </span>
                      <span className="mt-1 block truncate text-sm text-gray-500">{r.blurb}</span>
                    </span>
                    <span
                      className={`ml-auto h-2 w-2 shrink-0 rounded-full transition-all ${
                        selected
                          ? "bg-emerald-400 shadow-[0_0_10px_2px_rgba(52,211,153,0.6)]"
                          : "bg-hairline"
                      }`}
                    />
                  </button>
                );
              })}
            </motion.div>
          </div>

          {/* Right — live preview card */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 1, ease: EASE, delay: 0.1 }}
            className="relative"
          >
            <div className="overflow-hidden rounded-2xl border border-hairline bg-surface shadow-[0_40px_90px_-40px_rgba(0,0,0,0.9)]">
              <div className="flex items-center justify-between border-b border-hairline px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <ShieldCheck className={`h-4 w-4 ${active.accent}`} />
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={role}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.35, ease: EASE }}
                      className="font-mono text-xs text-gray-400"
                    >
                      {PREVIEWS[role].title}
                    </motion.span>
                  </AnimatePresence>
                </div>
                <span
                  className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest ${active.accentBorder} ${active.accentBg} ${active.accent}`}
                >
                  {active.name}
                </span>
              </div>
              <div className="p-5 md:p-6">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={role}
                    initial={{ opacity: 0, y: 18, scale: 0.985 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -18, scale: 0.985 }}
                    transition={{ type: "spring", stiffness: 100, damping: 18 }}
                  >
                    <Preview />
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
            {/* under-glow keyed to role */}
            <div
              className={`pointer-events-none absolute -bottom-10 left-1/2 h-24 w-3/4 -translate-x-1/2 rounded-full blur-[70px] transition-colors duration-700 ${
                role === "owner"
                  ? "bg-amber-500/20"
                  : role === "admin"
                    ? "bg-indigo-500/20"
                    : role === "coordinator"
                      ? "bg-emerald-500/20"
                      : "bg-gray-500/15"
              }`}
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
