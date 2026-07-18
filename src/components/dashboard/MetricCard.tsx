import { Card } from "@/components/ui/card";

export function MetricCard({
  label,
  value,
  delta,
  accent = "primary",
}: {
  label: string;
  value: string | number;
  delta?: string;
  accent?: "primary" | "success" | "warning" | "danger" | "info";
}) {
  const color = {
    primary: "var(--primary)",
    success: "var(--status-done)",
    warning: "var(--priority-high)",
    danger: "var(--destructive)",
    info: "var(--status-progress)",
  }[accent];

  return (
    <Card className="p-4" style={{ borderTop: `3px solid ${color}` }}>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">
        {label}
      </p>
      <p className="text-3xl font-bold font-display tracking-tight tabular-nums" style={{ color }}>
        {value}
      </p>
      {delta && <p className="text-xs text-muted-foreground mt-1">{delta}</p>}
    </Card>
  );
}
