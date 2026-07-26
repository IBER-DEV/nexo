import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, ExternalLink, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSound } from "@/providers/SoundProvider";
import { SeatUsage } from "@/components/settings/SeatUsage";
import {
  SUBSCRIPTION_STATUS_LABEL,
  billingService,
  type BillingState,
} from "@/services/billingService";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function diasRestantes(value: string | null) {
  if (!value) return null;
  const ms = new Date(value).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

/** El estado se traduce a un color de la paleta de marca, nunca a un hex
 * suelto: los tokens de src/styles.css ya funcionan en claro y oscuro. */
function StatusBadge({ state }: { state: BillingState }) {
  if (!state.subscription) return <Badge variant="secondary">Sin suscripción</Badge>;
  const { status, trial_expired } = state.subscription;
  const label = trial_expired ? "Prueba vencida" : SUBSCRIPTION_STATUS_LABEL[status];
  const variant =
    state.access_level === "full" && !trial_expired
      ? "default"
      : state.access_level === "blocked"
        ? "destructive"
        : "secondary";
  return <Badge variant={variant}>{label}</Badge>;
}

export function BillingSettings() {
  const { play } = useSound();
  const queryClient = useQueryClient();
  const { data: state, isLoading } = useQuery({
    queryKey: ["billing"],
    queryFn: () => billingService.state(),
  });

  const checkoutMutation = useMutation({
    mutationFn: () => billingService.checkout(),
    // Redirección dura, no router: el checkout vive en el dominio de Lemon
    // Squeezy (Merchant of Record — la tarjeta nunca toca a Nexo).
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "No se pudo abrir el pago"),
  });

  const trialMutation = useMutation({
    mutationFn: () => billingService.startTrial(),
    onSuccess: () => {
      toast.success(`Prueba de ${state?.trial_days ?? 14} días activada`);
      play("success");
      queryClient.invalidateQueries({ queryKey: ["billing"] });
      queryClient.invalidateQueries({ queryKey: ["organization"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "No se pudo activar"),
  });

  const portalMutation = useMutation({
    mutationFn: () => billingService.portal(),
    onSuccess: ({ url }) => {
      window.open(url, "_blank", "noopener");
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "No se pudo abrir el portal"),
  });

  if (isLoading || !state) {
    return <Skeleton className="h-72 rounded-xl max-w-2xl" />;
  }

  // Self-hosted: sin proveedor configurado no hay nada que cobrar ni que
  // gestionar. Decirlo explícitamente evita que parezca una feature rota.
  if (!state.billing_enabled) {
    return (
      <Card className="p-6 space-y-3 max-w-2xl">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">Instancia autogestionada</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Esta instancia de Nexo no tiene facturación configurada: usa el plan Community completo,
          sin límites ni cobros. La facturación solo aplica a Nexo Cloud.
        </p>
      </Card>
    );
  }

  const sub = state.subscription;
  const restantes = sub?.status === "trialing" ? diasRestantes(sub.trial_ends_at) : null;

  return (
    <div className="space-y-6 max-w-2xl">
      <Card className="p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold">Plan y suscripción</h3>
            <p className="text-xs text-muted-foreground">
              Estado de facturación de toda la organización.
            </p>
          </div>
          <StatusBadge state={state} />
        </div>

        <dl className="grid sm:grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Plan actual</dt>
            <dd className="font-medium capitalize">{state.plan}</dd>
          </div>
          {sub?.status === "trialing" && !sub.trial_expired && (
            <div>
              <dt className="text-xs text-muted-foreground">La prueba termina</dt>
              <dd className="font-medium">
                {formatDate(sub.trial_ends_at)}
                {restantes !== null && (
                  <span className="text-muted-foreground"> · {restantes} días</span>
                )}
              </dd>
            </div>
          )}
          {sub?.renews_at && sub.status === "active" && (
            <div>
              <dt className="text-xs text-muted-foreground">Se renueva</dt>
              <dd className="font-medium">{formatDate(sub.renews_at)}</dd>
            </div>
          )}
          {sub?.ends_at && (
            <div>
              <dt className="text-xs text-muted-foreground">Acceso hasta</dt>
              <dd className="font-medium">{formatDate(sub.ends_at)}</dd>
            </div>
          )}
          {sub && sub.quantity > 1 && (
            <div>
              <dt className="text-xs text-muted-foreground">Puestos</dt>
              <dd className="font-medium">{sub.quantity}</dd>
            </div>
          )}
        </dl>

        <SeatUsage />

        {state.can_manage ? (
          <div className="flex flex-wrap gap-3">
            {state.trial_available && (
              <Button
                variant="outline"
                onClick={() => trialMutation.mutate()}
                disabled={trialMutation.isPending}
              >
                <Sparkles className="h-4 w-4" />
                Probar Cloud {state.trial_days} días
              </Button>
            )}
            {sub?.provider_status ? (
              <Button
                variant="outline"
                onClick={() => portalMutation.mutate()}
                disabled={portalMutation.isPending}
              >
                <ExternalLink className="h-4 w-4" />
                Gestionar suscripción
              </Button>
            ) : (
              <Button
                onClick={() => checkoutMutation.mutate()}
                disabled={checkoutMutation.isPending}
              >
                <CreditCard className="h-4 w-4" />
                {checkoutMutation.isPending ? "Abriendo…" : "Actualizar a Cloud"}
              </Button>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Solo el owner o un administrador puede cambiar el plan.
          </p>
        )}
      </Card>

      {state.can_manage && (
        <Card className="p-6 space-y-2">
          <h3 className="font-semibold text-sm">Método de pago y facturas</h3>
          <p className="text-xs text-muted-foreground">
            Los pagos los procesa Lemon Squeezy como Merchant of Record: la tarjeta nunca pasa por
            los servidores de Nexo, y las facturas, cambios de método de pago y la cancelación se
            hacen desde su portal de cliente.
          </p>
        </Card>
      )}
    </div>
  );
}
