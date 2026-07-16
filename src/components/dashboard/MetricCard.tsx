import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function MetricCard({
  label,
  value,
  delta,
  icon: Icon,
  accent = "primary",
}: {
  label: string;
  value: string | number;
  delta?: string;
  icon: LucideIcon;
  accent?: "primary" | "success" | "warning" | "danger" | "info";
}) {
  const colors = {
    primary: "text-primary bg-primary/10",
    success:
      "text-[var(--status-done)] bg-[color-mix(in_oklab,var(--status-done)_12%,transparent)]",
    warning:
      "text-[var(--priority-high)] bg-[color-mix(in_oklab,var(--priority-high)_12%,transparent)]",
    danger: "text-destructive bg-destructive/10",
    info: "text-[var(--status-progress)] bg-[color-mix(in_oklab,var(--status-progress)_12%,transparent)]",
  }[accent];

  return (
    <Card className="p-5 flex items-start justify-between gap-3 hover:shadow-md transition-shadow">
      <div className="space-y-1 min-w-0">
        <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{label}</p>
        <p className="text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
        {delta && <p className="text-xs text-muted-foreground">{delta}</p>}
      </div>
      <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", colors)}>
        <Icon className="h-5 w-5" />
      </div>
    </Card>
  );
}
