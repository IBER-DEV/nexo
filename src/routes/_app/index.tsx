import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { activitiesService } from "@/services/activitiesService";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAuth } from "@/providers/AuthProvider";
import { ListTodo, Clock, CheckCircle2, AlertTriangle, Inbox } from "lucide-react";
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
import { useWorkspace } from "@/providers/WorkspaceProvider";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";

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
        <PageHeader title="Dashboard" description="Resumen ejecutivo del equipo TI" />
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Resumen ejecutivo del equipo de sistemas"
        actions={
          <Button asChild>
            <Link to="/activities" search={{ q: "" }}>
              Ver actividades
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <MetricCard label="Total actividades" value={total} icon={ListTodo} accent="primary" />
        <MetricCard label="Pendientes" value={pendientes} icon={Clock} accent="info" />
        <MetricCard label="Finalizadas" value={finalizadas} icon={CheckCircle2} accent="success" />
        <MetricCard label="Vencidas" value={vencidas} icon={AlertTriangle} accent="danger" />
        <MetricCard label="Backlog" value={backlog} icon={Inbox} accent="warning" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {canSeeTeamBreakdown && (
          <Card className="p-5">
            <div className="mb-4">
              <h3 className="font-semibold">Actividades por responsable</h3>
              <p className="text-xs text-muted-foreground">Distribución de carga del equipo</p>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%" debounce={200}>
                <BarChart data={porResponsable}>
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
                  <Bar dataKey="value" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
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
                  <span className="text-xs font-mono text-muted-foreground">{a.id}</span>
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
