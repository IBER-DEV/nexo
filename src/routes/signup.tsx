import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mail, Lock, User as UserIcon, Building2, ArrowRight, KeyRound } from "lucide-react";
import { NexoMark } from "@/components/brand/NexoMark";
import { useAuth } from "@/providers/AuthProvider";
import { authService } from "@/services/authService";
import { accessCodesService } from "@/services/accessCodesService";
import { ROLE_LABEL } from "@/lib/types";
import { ApiError } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Crear cuenta · Nexo" },
      {
        name: "description",
        content: "Regístrate y crea tu organización en Nexo en menos de 3 minutos.",
      },
    ],
  }),
  component: SignupPage,
});

type SignupMode = "crear" | "codigo";

const baseFields = {
  nombre: z.string().min(2, "Mínimo 2 caracteres").max(200),
  email: z.string().email("Correo inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
};

const crearSchema = z.object({
  ...baseFields,
  nombre_org: z.string().min(2, "Mínimo 2 caracteres").max(200),
  template: z.string().min(1, "Elige una plantilla"),
  access_code: z.string(),
});

const codigoSchema = z.object({
  ...baseFields,
  nombre_org: z.string(),
  template: z.string(),
  access_code: z
    .string()
    .regex(/^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/, "Formato: XXXX-XXXX-XXXX"),
});

type FormValues = z.infer<typeof crearSchema>;

const CODE_COMPLETE = /^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/;

function fieldErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const data = err.data as Record<string, unknown> | null;
    const detail = data?.detail;
    if (typeof detail === "string") return detail;
    const firstField = data && Object.values(data)[0];
    if (Array.isArray(firstField) && typeof firstField[0] === "string") return firstField[0];
  }
  return err instanceof Error ? err.message : "No se pudo crear la cuenta";
}

function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<SignupMode>("crear");

  const { data: templates, isLoading: loadingTemplates } = useQuery({
    queryKey: ["signup-templates"],
    queryFn: authService.templates,
    staleTime: Infinity,
  });

  const schema = useMemo(() => (mode === "crear" ? crearSchema : codigoSchema), [mode]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      nombre: "",
      email: "",
      password: "",
      nombre_org: "",
      template: "",
      access_code: "",
    },
  });

  const accessCode = form.watch("access_code").trim().toUpperCase();
  const codeComplete = CODE_COMPLETE.test(accessCode);

  // Preview público de "Te unirás a..." — no consume usos del código.
  const { data: resolved, isError: resolveFailed } = useQuery({
    queryKey: ["resolve-access-code", accessCode],
    queryFn: () => accessCodesService.resolve(accessCode),
    enabled: mode === "codigo" && codeComplete,
    retry: false,
    staleTime: 30_000,
  });

  const switchMode = (value: string) => {
    setMode(value as SignupMode);
    form.clearErrors();
  };

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (mode === "codigo") {
        await signup({
          nombre: values.nombre,
          email: values.email,
          password: values.password,
          access_code: values.access_code.trim().toUpperCase(),
        });
        toast.success("¡Bienvenido! Ya eres parte del equipo.");
      } else {
        await signup({
          nombre: values.nombre,
          email: values.email,
          password: values.password,
          nombre_org: values.nombre_org,
          template: values.template,
        });
        toast.success("Tu espacio está listo. Vamos a crear tu primera actividad.");
      }
      navigate({ to: "/" });
    } catch (err) {
      toast.error(fieldErrorMessage(err));
    }
  });

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background px-4 py-10">
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
          <div className="mb-5">
            <h1 className="text-2xl font-semibold tracking-tight">Crea tu cuenta</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {mode === "crear"
                ? "Tu organización queda lista al instante, sin ayuda humana."
                : "Únete a la organización de tu equipo con un código."}
            </p>
          </div>

          <Tabs value={mode} onValueChange={switchMode} className="mb-5">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="crear">Crear organización</TabsTrigger>
              <TabsTrigger value="codigo">Tengo un código</TabsTrigger>
            </TabsList>
          </Tabs>

          <form onSubmit={onSubmit} className="space-y-4" key={mode}>
            <div className="space-y-2">
              <Label htmlFor="nombre">Tu nombre</Label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="nombre" className="pl-9 h-10" {...form.register("nombre")} />
              </div>
              {form.formState.errors.nombre && (
                <p className="text-xs text-destructive">{form.formState.errors.nombre.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Correo</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="email" type="email" className="pl-9 h-10" {...form.register("email")} />
              </div>
              {form.formState.errors.email && (
                <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  className="pl-9 h-10"
                  {...form.register("password")}
                />
              </div>
              {form.formState.errors.password && (
                <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
              )}
            </div>

            {mode === "crear" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="nombre_org">Nombre de tu organización</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="nombre_org" className="pl-9 h-10" {...form.register("nombre_org")} />
                  </div>
                  {form.formState.errors.nombre_org && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.nombre_org.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Plantilla de flujo</Label>
                  <Select
                    value={form.watch("template")}
                    onValueChange={(v) => form.setValue("template", v, { shouldValidate: true })}
                    disabled={loadingTemplates}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Elige cómo quieres empezar" />
                    </SelectTrigger>
                    <SelectContent>
                      {(templates ?? []).map((tpl) => (
                        <SelectItem key={tpl.key} value={tpl.key}>
                          {tpl.display_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.template && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.template.message}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="access_code">Código de acceso</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="access_code"
                    placeholder="XXXX-XXXX-XXXX"
                    className="pl-9 h-10 font-mono uppercase tracking-wider"
                    {...form.register("access_code")}
                  />
                </div>
                {form.formState.errors.access_code && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.access_code.message}
                  </p>
                )}
                {codeComplete && resolved && (
                  <p className="text-xs text-primary">
                    Te unirás a <span className="font-medium">{resolved.organization_nombre}</span>{" "}
                    como {ROLE_LABEL[resolved.rol]}.
                  </p>
                )}
                {codeComplete && resolveFailed && (
                  <p className="text-xs text-destructive">
                    Este código no existe o ya no es válido.
                  </p>
                )}
              </div>
            )}

            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="w-full h-10 gap-2"
            >
              {form.formState.isSubmitting ? (
                mode === "crear" ? (
                  "Creando tu espacio..."
                ) : (
                  "Uniéndote al equipo..."
                )
              ) : (
                <>
                  {mode === "crear" ? "Crear cuenta" : "Unirme"}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            ¿Ya tienes cuenta?{" "}
            <Link to="/login" className="text-primary hover:underline">
              Inicia sesión
            </Link>
          </p>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Nexo · Gestión de actividades TI
        </p>
      </div>
    </div>
  );
}
