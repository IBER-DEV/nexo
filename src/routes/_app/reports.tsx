import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { activitiesService } from "@/services/activitiesService";
import {
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  AreaChart,
  Area,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { STATUS_LABEL } from "@/lib/types";
import { useAuth } from "@/providers/AuthProvider";
import { useEffect } from "react";

export const Route = createFileRoute("/_app/reports")({
  head: () => ({
    meta: [
      { title: "Reportes · Nexo" },
      { name: "description", content: "Reportes y análisis del backlog del equipo de sistemas." },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const { canAccessPlanning } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!canAccessPlanning) {
      navigate({ to: "/", replace: true });
    }
  }, [canAccessPlanning, navigate]);

  const { data, isLoading } = useQuery({
    queryKey: ["activities"],
    queryFn: () => activitiesService.list(),
    enabled: canAccessPlanning,
  });

  if (!canAccessPlanning) {
    return null;
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Reportes" description="Análisis del backlog técnico" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  const porEmpresa = Object.entries(
    data.reduce<Record<string, number>>((acc, a) => {
      acc[a.empresa] = (acc[a.empresa] || 0) + 1;
      return acc;
    }, {}),
  ).map(([name, value]) => ({ name, value }));

  const trend: { name: string; abiertas: number; cerradas: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const m = d.getMonth();
    const y = d.getFullYear();
    const abiertas = data.filter((a) => {
      const t = new Date(a.fechaInicio);
      return t.getMonth() === m && t.getFullYear() === y;
    }).length;
    const cerradas = data.filter((a) => {
      const t = new Date(a.fechaLimite);
      return a.estado === "done" && t.getMonth() === m && t.getFullYear() === y;
    }).length;
    trend.push({ name: d.toLocaleDateString("es", { month: "short" }), abiertas, cerradas });
  }

  const porEstado = Object.entries(
    data.reduce<Record<string, number>>((acc, a) => {
      acc[a.estado] = (acc[a.estado] || 0) + 1;
      return acc;
    }, {}),
  ).map(([key, value]) => ({ name: STATUS_LABEL[key as keyof typeof STATUS_LABEL], value }));

  return (
    <div className="space-y-6">
      <PageHeader title="Reportes" description="Análisis del backlog técnico" />

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="font-semibold mb-1">Actividades por empresa</h3>
          <p className="text-xs text-muted-foreground mb-4">Distribución de carga por cliente</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%" debounce={200}>
              <BarChart data={porEmpresa}>
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
                <Bar dataKey="value" fill="var(--chart-3)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold mb-1">Por estado</h3>
          <p className="text-xs text-muted-foreground mb-4">Snapshot actual</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%" debounce={200}>
              <BarChart data={porEstado} layout="vertical" margin={{ left: 30 }}>
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
                  width={110}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    color: "var(--popover-foreground)",
                  }}
                />
                <Bar dataKey="value" fill="var(--chart-1)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="font-semibold mb-1">Tendencia anual</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Actividades creadas vs cerradas por mes
        </p>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%" debounce={200}>
            <AreaChart data={trend}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-4)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--chart-4)" stopOpacity={0} />
                </linearGradient>
              </defs>
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
              <Area
                type="monotone"
                dataKey="abiertas"
                stroke="var(--chart-1)"
                strokeWidth={2}
                fill="url(#g1)"
              />
              <Area
                type="monotone"
                dataKey="cerradas"
                stroke="var(--chart-4)"
                strokeWidth={2}
                fill="url(#g2)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
