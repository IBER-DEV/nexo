import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { billingService } from "@/services/billingService";

/**
 * Medidor de puestos ocupados. Existe para avisar *antes* del muro: un
 * equipo que ve "4 de 5" decide con tiempo; uno que solo se entera con un
 * 400 al invitar al quinto vive el límite como una falla del producto.
 *
 * No se muestra cuando no hay techo (self-hosted o plan de pago): un
 * contador sin límite es ruido.
 */
export function SeatUsage({ compact = false }: { compact?: boolean }) {
  const { data } = useQuery({
    queryKey: ["billing"],
    queryFn: () => billingService.state(),
    staleTime: 5 * 60 * 1000,
  });

  const usage = data?.usage;
  if (!data?.billing_enabled || !usage || usage.max_active_users === null) return null;

  const { active_users: usados, max_active_users: techo } = usage;
  const lleno = usados >= techo;
  const porcentaje = Math.min(100, Math.round((usados / techo) * 100));

  return (
    <div className={compact ? "space-y-1.5" : "space-y-2"}>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="flex items-center gap-2 text-muted-foreground">
          <Users className="h-4 w-4" />
          Puestos del plan
        </span>
        <span className={lleno ? "font-medium text-destructive" : "font-medium"}>
          {usados} de {techo}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${
            lleno ? "bg-destructive" : "bg-primary"
          }`}
          style={{ width: `${porcentaje}%` }}
        />
      </div>
      {lleno && (
        <p className="text-xs text-muted-foreground">
          Sin puestos libres. Desactiva a alguien del equipo o{" "}
          <Link
            to="/settings"
            search={{ tab: "facturacion" }}
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            actualiza a Cloud
          </Link>
          .
        </p>
      )}
    </div>
  );
}
