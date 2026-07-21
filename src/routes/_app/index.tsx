import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { activitiesService } from "@/services/activitiesService";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAuth } from "@/providers/AuthProvider";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/activities/StatusBadge";
import { PriorityBadge } from "@/components/activities/PriorityBadge";
import { PulseBand } from "@/components/dashboard/PulseBand";
import { InsightCard } from "@/components/dashboard/InsightCard";
import { LoadRing } from "@/components/dashboard/LoadRing";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Rocket } from "lucide-react";

export const Route = createFileRoute("/_app/")({
  head: () => ({
    meta: [
      { title: "Dashboard · Nexo" },
      {
        name: "description",
        content: "Métricas ejecutivas y resumen de actividades del equipo TI.",
      },
    ],
  }),
  component: DashboardPage,
});

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function EmptyDashboard() {
  const { workspace } = useWorkspace();
  const { user } = useAuth();
  const prefix = workspace?.organization?.codigo_prefix || "ACT";

  return (
    <div className="space-y-6">
      <PageHeader title="Pulso del equipo" description="Resumen ejecutivo del equipo de sistemas" />
      <Card className="flex flex-col items-center gap-4 p-12 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Rocket className="h-6 w-6" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-lg font-semibold">
            Tu espacio está listo — falta la primera actividad
          </h3>
          <p className="max-w-md text-sm text-muted-foreground">
            En cuanto la crees, obtendrá el código{" "}
            <span className="font-mono font-medium text-foreground">{prefix}-0001</span> y este
            dashboard empieza a mostrar métricas reales de tu equipo.
          </p>
        </div>
        <Button asChild size="lg" className="gap-2">
          <Link to="/activities" search={{ q: "", new: true }}>
            Crear mi primera actividad
          </Link>
        </Button>
        {user?.rol === "owner" && (
          <p className="text-xs text-muted-foreground">
            ¿Ya tienes equipo?{" "}
            <Link to="/users" className="text-primary hover:underline">
              Genera un código de acceso para invitarlos
            </Link>
          </p>
        )}
      </Card>
    </div>
  );
}

function DashboardPage() {
  const { isAdmin, isCoordinator } = useAuth();
  const canSeeTeamBreakdown = isAdmin || isCoordinator;
  const { stateById, isDone, isOpen } = useWorkspace();
  const { data, isLoading } = useQuery({
    queryKey: ["activities"],
    queryFn: () => activitiesService.list(),
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Pulso del equipo" description="Resumen ejecutivo del equipo TI" />
        <Skeleton className="h-40 rounded-2xl" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-20 rounded-lg" />
          <Skeleton className="h-20 rounded-lg" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return <EmptyDashboard />;
  }

  const now = Date.now();
  const total = data.length;
  const pendientes = data.filter((a) => isOpen(a.estado_id)).length;
  const finalizadas = data.filter((a) => isDone(a.estado_id)).length;
  const vencidas = data.filter(
    (a) => new Date(a.fechaLimite).getTime() < now && isOpen(a.estado_id),
  ).length;
  const backlog = data.filter((a) => stateById[a.estado_id]?.categoria === "todo").length;

  // Por responsable
  const porResponsable = Object.entries(
    data.reduce<Record<string, number>>((acc, a) => {
      acc[a.responsable] = (acc[a.responsable] || 0) + 1;
      return acc;
    }, {}),
  )
    .map(([name, value]) => ({ name: name.split(" ")[0], value }))
    .sort((a, b) => b.value - a.value);

  // Por estado
  const porEstado = Object.entries(
    data.reduce<Record<number, number>>((acc, a) => {
      acc[a.estado_id] = (acc[a.estado_id] || 0) + 1;
      return acc;
    }, {}),
  ).map(([key, value]) => ({ name: stateById[Number(key)]?.nombre ?? "—", value }));

  // Por aplicación
  const porApp = Object.entries(
    data.reduce<Record<string, number>>((acc, a) => {
      acc[a.aplicacion] = (acc[a.aplicacion] || 0) + 1;
      return acc;
    }, {}),
  ).map(([name, value]) => ({ name, value }));

  // Progreso semanal (8 semanas)
  const semanas: { name: string; creadas: number; finalizadas: number }[] = [];
  for (let i = 7; i >= 0; i--) {
    const start = new Date();
    start.setDate(start.getDate() - i * 7 - 7);
    const end = new Date();
    end.setDate(end.getDate() - i * 7);
    const creadas = data.filter((a) => {
      const t = new Date(a.fechaInicio).getTime();
      return t >= start.getTime() && t < end.getTime();
    }).length;
    const finalizadas = data.filter((a) => {
      const t = new Date(a.fechaLimite).getTime();
      return isDone(a.estado_id) && t >= start.getTime() && t < end.getTime();
    }).length;
    semanas.push({ name: `S${8 - i}`, creadas, finalizadas });
  }

  const recientes = [...data]
    .sort((a, b) => new Date(b.fechaInicio).getTime() - new Date(a.fechaInicio).getTime())
    .slice(0, 5);

  // Pulso: actividades con categoría "en curso" hoy, y % de las abiertas que
  // no están vencidas — el sparkline es real (progreso semanal ya calculado).
  const enMovimiento = data.filter((a) => stateById[a.estado_id]?.categoria === "active").length;
  const abiertas = pendientes;
  const onTimePct = abiertas > 0 ? Math.round(((abiertas - vencidas) / abiertas) * 100) : null;
  const sparkValues = semanas.map((s) => s.creadas);
  const sparkMax = Math.max(1, ...sparkValues);
  const sparkMin = Math.min(...sparkValues);
  const sparkRange = Math.max(1, sparkMax - sparkMin);
  const sparkStepX = 800 / Math.max(1, sparkValues.length - 1);
  const sparkPoints = sparkValues
    .map(
      (v, i) =>
        `${(i * sparkStepX).toFixed(1)},${(56 - ((v - sparkMin) / sparkRange) * 48).toFixed(1)}`,
    )
    .join(" ");

  // Conclusiones: solo se muestran cuando hay señal real detrás — nada de
  // números fijos. Cada regla tiene un umbral mínimo para no generar ruido.
  type Insight = { n: string; title: string; sub: string; color: string };
  const insights: Insight[] = [];
  const weekMs = 7 * 86_400_000;
  const dueSoon = data.filter((a) => {
    const due = new Date(a.fechaLimite).getTime();
    return isOpen(a.estado_id) && due >= now && due <= now + weekMs;
  }).length;
  if (dueSoon > 0) {
    insights.push({
      n: "01",
      title: `${dueSoon} actividad${dueSoon === 1 ? "" : "es"} vencerá${dueSoon === 1 ? "" : "n"} esta semana`,
      sub: "Revisa el backlog priorizado",
      color: "var(--priority-high)",
    });
  }
  if (canSeeTeamBreakdown && porResponsable.length > 1) {
    const top = porResponsable[0];
    const rest = porResponsable.slice(1);
    const restAvg = rest.reduce((s, p) => s + p.value, 0) / rest.length;
    const pct = restAvg > 0 ? Math.round(((top.value - restAvg) / restAvg) * 100) : 0;
    if (pct >= 20) {
      insights.push({
        n: "02",
        title: `${top.name} tiene ${pct}% más carga que el resto`,
        sub: "Considera redistribuir asignaciones",
        color: "var(--primary)",
      });
    }
  }
  if (porApp.length > 1) {
    const totalApp = porApp.reduce((s, p) => s + p.value, 0);
    const topApp = [...porApp].sort((a, b) => b.value - a.value)[0];
    const pct = Math.round((topApp.value / totalApp) * 100);
    if (pct >= 25) {
      insights.push({
        n: "03",
        title: `${topApp.name} concentra el ${pct}% de las actividades`,
        sub: "Posible punto de fricción recurrente",
        color: "var(--chart-2)",
      });
    }
  }
  const overdueByApp = data.reduce<Record<string, number>>((acc, a) => {
    const due = new Date(a.fechaLimite).getTime();
    if (due < now && isOpen(a.estado_id)) acc[a.aplicacion] = (acc[a.aplicacion] || 0) + 1;
    return acc;
  }, {});
  const topOverdueApp = Object.entries(overdueByApp).sort((a, b) => b[1] - a[1])[0];
  if (topOverdueApp && topOverdueApp[1] >= 2) {
    insights.push({
      n: "04",
      title: `${topOverdueApp[0]} tiene ${topOverdueApp[1]} actividades vencidas`,
      sub: "Candidato a causa raíz",
      color: "var(--destructive)",
    });
  }

  // Carga por persona: relativa al promedio del equipo (no una capacidad
  // fija que no tenemos) — arriba de 100% se pinta como sobrecarga.
  const teamAvgLoad =
    porResponsable.length > 0
      ? porResponsable.reduce((s, p) => s + p.value, 0) / porResponsable.length
      : 0;
  const loadRings = porResponsable.slice(0, 4).map((p) => ({
    name: p.name,
    pct: teamAvgLoad > 0 ? Math.round((p.value / teamAvgLoad) * 100) : 0,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pulso del equipo"
        description="Resumen ejecutivo del equipo de sistemas"
        actions={
          <Button asChild>
            <Link to="/activities" search={{ q: "" }}>
              Ver actividades
            </Link>
          </Button>
        }
      />

      <PulseBand movingCount={enMovimiento} onTimePct={onTimePct} sparkPoints={sparkPoints} />

      {insights.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2.5">
            Conclusiones de hoy
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {insights.map((ins) => (
              <InsightCard key={ins.n} {...ins} />
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <MetricCard label="Total actividades" value={total} accent="primary" />
        <MetricCard label="Pendientes" value={pendientes} accent="info" />
        <MetricCard label="Finalizadas" value={finalizadas} accent="success" />
        <MetricCard label="Vencidas" value={vencidas} accent="danger" />
        <MetricCard label="Backlog" value={backlog} accent="warning" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {canSeeTeamBreakdown && loadRings.length > 0 && (
          <Card className="p-5">
            <div className="mb-4">
              <h3 className="font-semibold">Carga por persona</h3>
              <p className="text-xs text-muted-foreground">
                Relativa al promedio del equipo — más de 100% es sobrecarga
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {loadRings.map((p) => (
                <LoadRing key={p.name} name={p.name} pct={p.pct} />
              ))}
            </div>
          </Card>
        )}

        <Card className="p-5">
          <div className="mb-4">
            <h3 className="font-semibold">Actividades por estado</h3>
            <p className="text-xs text-muted-foreground">Estado global del backlog</p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%" debounce={200}>
              <PieChart>
                <Pie
                  data={porEstado}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                >
                  {porEstado.map((_, i) => (
                    <Cell
                      key={i}
                      fill={CHART_COLORS[i % CHART_COLORS.length]}
                      stroke="var(--card)"
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    color: "var(--popover-foreground)",
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-4">
            <h3 className="font-semibold">Por aplicación</h3>
            <p className="text-xs text-muted-foreground">Sistemas con mayor demanda</p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%" debounce={200}>
              <BarChart data={porApp} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={100}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    color: "var(--popover-foreground)",
                  }}
                />
                <Bar dataKey="value" fill="var(--chart-2)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-4">
            <h3 className="font-semibold">Progreso semanal</h3>
            <p className="text-xs text-muted-foreground">Creadas vs finalizadas (8 semanas)</p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%" debounce={200}>
              <LineChart data={semanas}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="name"
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    color: "var(--popover-foreground)",
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey="creadas"
                  stroke="var(--chart-1)"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="finalizadas"
                  stroke="var(--chart-4)"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold">Actividades recientes</h3>
            <p className="text-xs text-muted-foreground">Últimas 5 creadas</p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/activities" search={{ q: "" }}>
              Ver todas
            </Link>
          </Button>
        </div>
        <div className="space-y-2">
          {recientes.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5 hover:bg-muted/40 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-semibold text-primary">{a.id}</span>
                  <span className="text-sm font-medium truncate">{a.nombre}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {a.responsable} · {a.aplicacion}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <PriorityBadge prioridadId={a.prioridad_id} />
                <StatusBadge estadoId={a.estado_id} />
                <span className="text-xs text-muted-foreground tabular-nums hidden md:inline">
                  {format(new Date(a.fechaLimite), "d MMM", { locale: es })}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
