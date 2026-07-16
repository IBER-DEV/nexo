import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { STATUS_LABEL, type ActivityStatus } from "@/lib/types";

const STYLES: Record<ActivityStatus, string> = {
  backlog: "bg-muted text-muted-foreground border-border",
  in_progress:
    "bg-[color-mix(in_oklab,var(--status-progress)_15%,transparent)] text-[var(--status-progress)] border-[color-mix(in_oklab,var(--status-progress)_30%,transparent)]",
  testing:
    "bg-[color-mix(in_oklab,var(--status-testing)_15%,transparent)] text-[var(--status-testing)] border-[color-mix(in_oklab,var(--status-testing)_30%,transparent)]",
  pending_client:
    "bg-[color-mix(in_oklab,var(--status-pending)_15%,transparent)] text-[var(--status-pending)] border-[color-mix(in_oklab,var(--status-pending)_30%,transparent)]",
  done:
    "bg-[color-mix(in_oklab,var(--status-done)_15%,transparent)] text-[var(--status-done)] border-[color-mix(in_oklab,var(--status-done)_30%,transparent)]",
  cancelled: "bg-muted text-muted-foreground border-border line-through",
};

export function StatusBadge({ status }: { status: ActivityStatus }) {
  return (
    <Badge variant="outline" className={cn("font-medium border", STYLES[status])}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}
