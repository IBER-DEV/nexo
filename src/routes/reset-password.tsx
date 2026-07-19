import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Lock, ArrowRight, XCircle } from "lucide-react";
import { NexoMark } from "@/components/brand/NexoMark";
import { authService } from "@/services/authService";
import { ApiError } from "@/lib/api";
import { toast } from "sonner";

interface ResetPasswordSearch {
  uid: string;
  token: string;
}

export const Route = createFileRoute("/reset-password")({
  validateSearch: (search: Record<string, unknown>): ResetPasswordSearch => ({
    uid: typeof search.uid === "string" ? search.uid : "",
    token: typeof search.token === "string" ? search.token : "",
  }),
  head: () => ({
    meta: [{ title: "Restablecer contraseña · Nexo" }],
  }),
  component: ResetPasswordPage,
});

const schema = z.object({
  new_password: z.string().min(8, "Mínimo 8 caracteres"),
});

type FormValues = z.infer<typeof schema>;

function fieldErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const data = err.data as Record<string, unknown> | null;
    const detail = data?.detail;
    if (typeof detail === "string") return detail;
    const firstField = data && Object.values(data)[0];
    if (Array.isArray(firstField) && typeof firstField[0] === "string") return firstField[0];
  }
  return err instanceof Error ? err.message : "No se pudo restablecer la contraseña";
}

function ResetPasswordPage() {
  const { uid, token } = Route.useSearch();
  const navigate = useNavigate();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { new_password: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await authService.resetPassword({ uid, token, ...values });
      toast.success("Contraseña actualizada. Ya puedes iniciar sesión.");
      navigate({ to: "/login" });
    } catch (err) {
      toast.error(fieldErrorMessage(err));
    }
  });

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background px-4">
      <div className="relative w-full max-w-md animate-fade-in">
        <Link to="/login" className="flex items-center justify-center gap-2 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
            <NexoMark className="h-5 w-5" />
          </div>
          <div className="text-lg font-semibold tracking-tight font-display">Nexo</div>
        </Link>

        <Card className="border-border/60 bg-card/80 backdrop-blur-xl p-8 shadow-xl">
          {!uid || !token ? (
            <div className="text-center">
              <XCircle className="mx-auto h-10 w-10 text-destructive mb-4" />
              <h1 className="text-xl font-semibold tracking-tight">Enlace inválido</h1>
              <p className="text-sm text-muted-foreground mt-2">
                Pide un nuevo enlace de recuperación desde el inicio de sesión.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h1 className="text-2xl font-semibold tracking-tight">
                  Elige una nueva contraseña
                </h1>
              </div>

              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new_password">Nueva contraseña</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="new_password"
                      type="password"
                      className="pl-9 h-10"
                      {...form.register("new_password")}
                    />
                  </div>
                  {form.formState.errors.new_password && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.new_password.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={form.formState.isSubmitting}
                  className="w-full h-10 gap-2"
                >
                  {form.formState.isSubmitting ? (
                    "Guardando..."
                  ) : (
                    <>
                      Restablecer <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            </>
          )}

          <p className="mt-6 text-center text-xs text-muted-foreground">
            <Link to="/login" className="text-primary hover:underline">
              Volver a iniciar sesión
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
