import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  PRIORITIES,
  PRIORITY_LABEL,
  STATUSES,
  STATUS_LABEL,
  type Activity,
  type ActivityInput,
} from "@/lib/types";
import { activitiesService } from "@/services/activitiesService";
import { usersService } from "@/services/usersService";
import { useAuth } from "@/providers/AuthProvider";

const schema = z.object({
  empresa: z.string().min(1, "Requerido"),
  proceso: z.string().min(1, "Requerido"),
  aplicacion: z.string().min(1, "Requerido"),
  nombre: z.string().min(3, "Mínimo 3 caracteres").max(120),
  descripcion: z.string().max(500),
  responsable_id: z.number({ error: "Requerido" }).int().positive("Requerido"),
  stakeholder: z.string().min(1, "Requerido"),
  mes_planeacion: z.string().regex(/^\d{4}-\d{2}$/, "Formato YYYY-MM"),
  semana_planeacion: z.number().int().min(1).max(5),
  prioridad: z.enum(["low", "medium", "high", "critical"]),
  estado: z.enum(["backlog", "in_progress", "testing", "pending_client", "done", "cancelled"]),
  fechaInicio: z.date(),
  fechaLimite: z.date(),
});

type FormValues = z.infer<typeof schema>;

export function ActivityForm({
  defaultValues,
  onSubmit,
  onCancel,
}: {
  defaultValues?: Partial<Activity>;
  onSubmit: (values: ActivityInput) => void | Promise<void>;
  onCancel: () => void;
}) {
  const { user, isAdmin, isCoordinator } = useAuth();
  const canPickUsers = isAdmin || isCoordinator;

  const { data: fetchedUsers = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => usersService.list(),
    staleTime: Infinity,
    enabled: canPickUsers,
  });

  const users = canPickUsers ? fetchedUsers : user ? [user] : [];

  const { data: meta } = useQuery({
    queryKey: ["activities-meta"],
    queryFn: () => activitiesService.meta(),
    staleTime: 60000,
  });

  const options = {
    empresas: meta?.empresas ?? [],
    procesos: meta?.procesos ?? [],
    aplicaciones: meta?.aplicaciones ?? [],
    stakeholders: meta?.stakeholders ?? [],
  };

  const defaultInicio = defaultValues?.fechaInicio
    ? new Date(defaultValues.fechaInicio)
    : new Date();
  const defaultLimite = defaultValues?.fechaLimite
    ? new Date(defaultValues.fechaLimite)
    : new Date(Date.now() + 7 * 86400000);
  const defaultMes = defaultValues?.mes_planeacion ?? format(defaultInicio, "yyyy-MM");
  const defaultSemana = defaultValues?.semana_planeacion ?? weekOfMonth(defaultInicio);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      empresa: defaultValues?.empresa ?? "",
      proceso: defaultValues?.proceso ?? "",
      aplicacion: defaultValues?.aplicacion ?? "",
      nombre: defaultValues?.nombre ?? "",
      descripcion: defaultValues?.descripcion ?? "",
      responsable_id: defaultValues?.responsable_id ?? user?.id ?? (undefined as unknown as number),
      stakeholder: defaultValues?.stakeholder ?? "",
      mes_planeacion: defaultMes,
      semana_planeacion: defaultSemana,
      prioridad: (defaultValues?.prioridad as FormValues["prioridad"]) ?? "medium",
      estado: (defaultValues?.estado as FormValues["estado"]) ?? "backlog",
      fechaInicio: defaultInicio,
      fechaLimite: defaultLimite,
    },
  });

  const submit = form.handleSubmit(async (v) => {
    await onSubmit({
      empresa: v.empresa,
      proceso: v.proceso,
      aplicacion: v.aplicacion,
      nombre: v.nombre,
      descripcion: v.descripcion,
      responsable_id: v.responsable_id,
      stakeholder: v.stakeholder,
      mes_planeacion: v.mes_planeacion,
      semana_planeacion: v.semana_planeacion,
      prioridad: v.prioridad,
      estado: v.estado,
      fechaInicio: v.fechaInicio.toISOString(),
      fechaLimite: v.fechaLimite.toISOString(),
    });
  });

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Empresa" error={form.formState.errors.empresa?.message}>
          <SelectControlled
            value={form.watch("empresa")}
            onChange={(v) => form.setValue("empresa", v)}
            options={options.empresas}
            placeholder="Seleccionar empresa"
          />
        </Field>
        <Field label="Proceso" error={form.formState.errors.proceso?.message}>
          <SelectControlled
            value={form.watch("proceso")}
            onChange={(v) => form.setValue("proceso", v)}
            options={options.procesos}
            placeholder="Seleccionar proceso"
          />
        </Field>
        <Field label="Aplicación" error={form.formState.errors.aplicacion?.message}>
          <SelectControlled
            value={form.watch("aplicacion")}
            onChange={(v) => form.setValue("aplicacion", v)}
            options={options.aplicaciones}
            placeholder="Seleccionar aplicación"
          />
        </Field>
        <Field label="Stakeholder" error={form.formState.errors.stakeholder?.message}>
          <Input
            list="stakeholder-options"
            value={form.watch("stakeholder")}
            onChange={(e) => form.setValue("stakeholder", e.target.value)}
            placeholder="Seleccionar stakeholder"
          />
          <datalist id="stakeholder-options">
            {options.stakeholders.map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
        </Field>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Mes de planeación" error={form.formState.errors.mes_planeacion?.message}>
          <Input
            type="month"
            value={form.watch("mes_planeacion")}
            onChange={(e) => form.setValue("mes_planeacion", e.target.value)}
          />
        </Field>
        <Field label="Semana" error={form.formState.errors.semana_planeacion?.message}>
          <Select
            value={String(form.watch("semana_planeacion") ?? "")}
            onValueChange={(v) => form.setValue("semana_planeacion", parseInt(v, 10))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar semana" />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5].map((week) => (
                <SelectItem key={week} value={String(week)}>
                  Semana {week}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field label="Nombre de la actividad" error={form.formState.errors.nombre?.message}>
        <Input {...form.register("nombre")} placeholder="Ej. Migrar base de datos a Postgres 16" />
      </Field>

      <Field label="Descripción">
        <Textarea
          {...form.register("descripcion")}
          placeholder="Detalle técnico, criterios de aceptación..."
          rows={3}
        />
      </Field>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Responsable" error={form.formState.errors.responsable_id?.message}>
          <Select
            value={form.watch("responsable_id")?.toString() ?? ""}
            onValueChange={(v) => form.setValue("responsable_id", parseInt(v))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Asignar responsable" />
            </SelectTrigger>
            <SelectContent>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id.toString()}>
                  {u.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Prioridad">
            <Select
              value={form.watch("prioridad")}
              onValueChange={(v: FormValues["prioridad"]) => form.setValue("prioridad", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {PRIORITY_LABEL[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Estado">
            <Select
              value={form.watch("estado")}
              onValueChange={(v: FormValues["estado"]) => form.setValue("estado", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Fecha inicio">
          <DatePick
            value={form.watch("fechaInicio")}
            onChange={(d) => form.setValue("fechaInicio", d)}
          />
        </Field>
        <Field label="Fecha límite">
          <DatePick
            value={form.watch("fechaLimite")}
            onChange={(d) => form.setValue("fechaLimite", d)}
          />
        </Field>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={form.formState.isSubmitting}
          className="gap-2"
          data-cuelume-press
          data-cuelume-release
        >
          <Save className="h-4 w-4" /> Guardar actividad
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function SelectControlled({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
}) {
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function weekOfMonth(value: Date) {
  const day = value.getDate();
  if (day <= 7) return 1;
  if (day <= 14) return 2;
  if (day <= 21) return 3;
  if (day <= 28) return 4;
  return 5;
}

function DatePick({ value, onChange }: { value: Date; onChange: (d: Date) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(value, "PPP", { locale: es }) : "Selecciona fecha"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(d) => d && onChange(d)}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
}
