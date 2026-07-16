import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Mail, Lock, ArrowRight } from "lucide-react";
import { NexoMark } from "@/components/brand/NexoMark";
import { useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Iniciar sesión · Nexo" },
      { name: "description", content: "Acceso al panel de gestión de actividades TI." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@empresa.com");
  const [password, setPassword] = useState("demo1234");
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Bienvenido a Nexo");
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background px-4">
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0 opacity-[0.35] dark:opacity-25"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, color-mix(in oklab, var(--primary) 35%, transparent), transparent 40%), radial-gradient(circle at 80% 30%, color-mix(in oklab, var(--chart-2) 30%, transparent), transparent 45%), radial-gradient(circle at 50% 90%, color-mix(in oklab, var(--chart-5) 25%, transparent), transparent 50%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-30 dark:opacity-20"
          style={{
            backgroundImage:
              "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
            maskImage: "radial-gradient(ellipse at center, black 50%, transparent 80%)",
          }}
        />
      </div>

      <div className="relative w-full max-w-md animate-fade-in">
        <Link to="/login" className="flex items-center justify-center gap-2 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
            <NexoMark className="h-5 w-5" />
          </div>
          <div className="text-lg font-semibold tracking-tight font-display">Nexo</div>
        </Link>

        <Card className="border-border/60 bg-card/80 backdrop-blur-xl p-8 shadow-xl">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight">Iniciar sesión</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Accede al panel de gestión de actividades TI.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Correo corporativo</Label>
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
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Contraseña</Label>
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => setForgotOpen(true)}
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  required
                  className="pl-9 h-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full h-10 gap-2">
              {loading ? (
                "Validando..."
              ) : (
                <>
                  Ingresar <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Demo · <code className="font-mono">admin@empresa.com</code> /{" "}
            <code className="font-mono">demo1234</code>
          </p>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Nexo · Gestión de actividades TI
        </p>
      </div>

      <AlertDialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Recuperar contraseña</AlertDialogTitle>
            <AlertDialogDescription>
              Nexo no tiene recuperación automática por correo en esta versión. Contacta al
              administrador del área de sistemas para que restablezca tu acceso.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>Entendido</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
