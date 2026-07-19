import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Mail, ArrowRight, CheckCircle2 } from "lucide-react";
import { NexoMark } from "@/components/brand/NexoMark";
import { authService } from "@/services/authService";
import { toast } from "sonner";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [{ title: "Recuperar contraseña · Nexo" }],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authService.forgotPassword(email);
      setSent(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo enviar el correo");
    } finally {
      setLoading(false);
    }
  };

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
          {sent ? (
            <div className="text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-primary mb-4" />
              <h1 className="text-xl font-semibold tracking-tight">Revisa tu correo</h1>
              <p className="text-sm text-muted-foreground mt-2">
                Si {email} tiene una cuenta en Nexo, te enviamos instrucciones para restablecer tu
                contraseña.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h1 className="text-2xl font-semibold tracking-tight">Recuperar contraseña</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Te enviaremos un enlace para restablecerla.
                </p>
              </div>

              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Correo</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      required
                      className="pl-9 h-10"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <Button type="submit" disabled={loading} className="w-full h-10 gap-2">
                  {loading ? (
                    "Enviando..."
                  ) : (
                    <>
                      Enviar enlace <ArrowRight className="h-4 w-4" />
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
