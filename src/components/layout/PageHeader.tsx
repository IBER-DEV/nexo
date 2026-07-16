import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

const LABELS: Record<string, string> = {
  "": "Dashboard",
  activities: "Actividades",
  planeacion: "Planeación",
  kanban: "Kanban",
  reports: "Reportes",
  users: "Usuarios",
  settings: "Configuración",
};

export function Breadcrumbs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const parts = pathname.split("/").filter(Boolean);
  const items = parts.length === 0 ? [""] : ["", ...parts];

  return (
    <nav className="flex items-center gap-1 text-xs text-muted-foreground">
      {items.map((p, i) => {
        const last = i === items.length - 1;
        const href = i === 0 ? "/" : "/" + items.slice(1, i + 1).join("/");
        return (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3 w-3" />}
            {last ? (
              <span className="text-foreground font-medium">{LABELS[p] ?? p}</span>
            ) : (
              <Link to={href} className="hover:text-foreground transition-colors">
                {LABELS[p] ?? p}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-border pb-5">
      <Breadcrumbs />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight font-display">{title}</h1>
          {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
