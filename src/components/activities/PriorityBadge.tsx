import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PRIORITY_LABEL, type ActivityPriority } from "@/lib/types";
import { ArrowDown, ArrowUp, Equal, AlertTriangle } from "lucide-react";

const STYLES: Record<ActivityPriority, string> = {
  low: "text-[var(--priority-low)]",
  medium: "text-[var(--priority-med)]",
  high: "text-[var(--priority-high)]",
  critical: "text-[var(--priority-critical)]",
};
const ICONS = {
  low: ArrowDown,
  medium: Equal,
  high: ArrowUp,
  critical: AlertTriangle,
};

export function PriorityBadge({ priority }: { priority: ActivityPriority }) {
  const Icon = ICONS[priority];
  return (
    <Badge variant="outline" className={cn("gap-1 font-medium bg-transparent", STYLES[priority])}>
      <Icon className="h-3 w-3" />
      {PRIORITY_LABEL[priority]}
    </Badge>
  );
}
