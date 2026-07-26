import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Sparkles } from "lucide-react";
import { billingService } from "@/services/billingService";
import { useAuth } from "@/providers/AuthProvider";

/**
 * Banner de facturación. Lo ve todo el equipo, no solo quien puede pagar:
 * si la organización quedó en solo lectura, un miembro que intente guardar
 * merece saber por qué antes de intentarlo, no después de un 403.
 *
 * No se muestra en la demo pública — ahí ya hay un banner propio y encimar
 * dos barras de advertencia sobre el contenido es peor que no avisar.
 */
export function BillingStatusBanner() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["billing"],
    queryFn: () => billingService.state(),
    enabled: Boolean(user) && !user?.is_demo_readonly,
    staleTime: 5 * 60 * 1000,
  });

  if (!data || !data.billing_enabled || user?.is_demo_readonly) return null;

  const trialVencido = data.subscription?.trial_expired ?? false;

  if (data.access_level === "blocked") {
    return (
      <Banner tone="destructive" icon={<AlertTriangle className="h-4 w-4 shrink-0" />}>
        La suscripción de tu organización expiró. Reactívala para recuperar el acceso.
      </Banner>
    );
  }

  if (data.access_level === "read_only") {
    return (
      <Banner tone="destructive" icon={<AlertTriangle className="h-4 w-4 shrink-0" />}>
        Tu suscripción no está al día: la organización quedó en solo lectura.
      </Banner>
    );
  }

  if (trialVencido) {
    return (
      <Banner tone="primary" icon={<Sparkles className="h-4 w-4 shrink-0" />}>
        Tu prueba de Cloud terminó — sigues en Community, con tus datos intactos.
      </Banner>
    );
  }

  return null;
}

function Banner({
  tone,
  icon,
  children,
}: {
  tone: "destructive" | "primary";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const clases =
    tone === "destructive"
      ? "border-destructive/40 bg-destructive/10 text-destructive"
      : "border-border/60 bg-primary/10 text-primary";
  return (
    <div className={`flex items-center justify-center gap-3 border-b px-4 py-2 text-sm ${clases}`}>
      {icon}
      <span>{children}</span>
      <Link
        to="/settings"
        search={{ tab: "facturacion" }}
        className="font-medium underline-offset-2 hover:underline"
      >
        Ir a Facturación →
      </Link>
    </div>
  );
}
