import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { NexoMark } from "@/components/brand/NexoMark";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { authService } from "@/services/authService";
import { ApiError } from "@/lib/api";

interface VerifyEmailSearch {
  token: string;
}

export const Route = createFileRoute("/verify-email")({
  validateSearch: (search: Record<string, unknown>): VerifyEmailSearch => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  head: () => ({
    meta: [{ title: "Verificar correo · Nexo" }],
  }),
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const { token } = Route.useSearch();

  const { isLoading, isError, error } = useQuery({
    queryKey: ["verify-email", token],
    queryFn: () => authService.verifyEmail(token),
    enabled: !!token,
    retry: false,
  });

  const errorMessage =
    error instanceof ApiError
      ? ((error.data as Record<string, unknown> | null)?.detail as string | undefined)
      : undefined;

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background px-4">
      <div className="relative w-full max-w-md animate-fade-in">
        <Link to="/login" className="flex items-center justify-center gap-2 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
            <NexoMark className="h-5 w-5" />
          </div>
          <div className="text-lg font-semibold tracking-tight font-display">Nexo</div>
        </Link>

        <Card className="border-border/60 bg-card/80 backdrop-blur-xl p-8 shadow-xl text-center">
          {!token || isError ? (
            <>
              <XCircle className="mx-auto h-10 w-10 text-destructive mb-4" />
              <h1 className="text-xl font-semibold tracking-tight">
                No pudimos verificar tu correo
              </h1>
              <p className="text-sm text-muted-foreground mt-2">
                {errorMessage ??
                  "El enlace es inválido o ya expiró. Pide uno nuevo desde el banner en tu panel."}
              </p>
            </>
          ) : isLoading ? (
            <>
              <Loader2 className="mx-auto h-10 w-10 text-primary animate-spin mb-4" />
              <h1 className="text-xl font-semibold tracking-tight">Verificando tu correo…</h1>
            </>
          ) : (
            <>
              <CheckCircle2 className="mx-auto h-10 w-10 text-primary mb-4" />
              <h1 className="text-xl font-semibold tracking-tight">¡Correo verificado!</h1>
              <p className="text-sm text-muted-foreground mt-2">
                Ya puedes cerrar esta pestaña y volver a Nexo.
              </p>
            </>
          )}

          <Link to="/" className="mt-6 inline-block text-sm text-primary hover:underline">
            Ir al panel
          </Link>
        </Card>
      </div>
    </div>
  );
}
