import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, Save } from "lucide-react";

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
import { ComboboxCreatable } from "@/components/ui/combobox-creatable";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { PROJECT_ESTADO_LABEL, type Project, type ProjectInput } from "@/lib/types";
import { usersService } from "@/services/usersService";
import { activitiesService } from "@/services/activitiesService";

const NINGUNO = "__none__";

const schema = z
  .object({
    nombre: z.string().min(3, "Mínimo 3 caracteres").max(200),
    descripcion: z.string().max(1000),
    estado: z.enum(["planned", "active", "on_hold", "done", "cancelled"]),
    lider_id: z.number().int().positive().nullable(),
    cliente: z.string(),
    fecha_inicio: z.date().nullable(),
    fecha_fin_estimada: z.date().nullable(),
  })
  .refine(
    (v) => !v.fecha_inicio || !v.fecha_fin_estimada || v.fecha_fin_estimada >= v.fecha_inicio,
    {
      message: "No puede ser anterior al inicio",
      path: ["fecha_fin_estimada"],
    },
  );

type FormValues = z.infer<typeof schema>;

const toISO = (d: Date | null) => (d ? format(d, "yyyy-MM-dd") : null);

export function ProjectForm({
  defaultValues,
  onSubmit,
  onCancel,
}: {
  defaultValues?: Project;
  onSubmit: (values: ProjectInput) => void | Promise<void>;
  onCancel: () => void;
}) {
  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => usersService.list(),
    staleTime: Infinity,
  });

  // Reutiliza el catálogo de clientes que ya alimenta el formulario de
  // actividades — un proyecto no estrena un catálogo propio.
  const { data: meta } = useQuery({
    queryKey: ["activities-meta"],
    queryFn: () => activitiesService.meta(),
    staleTime: 60000,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      nombre: defaultValues?.nombre ?? "",
      descripcion: defaultValues?.descripcion ?? "",
      estado: defaultValues?.estado ?? "planned",
      lider_id: defaultValues?.lider_id ?? null,
      cliente: defaultValues?.cliente ?? "",
      fecha_inicio: defaultValues?.fecha_inicio ? new Date(defaultValues.fecha_inicio) : null,
      fecha_fin_estimada: defaultValues?.fecha_fin_estimada
        ? new Date(defaultValues.fecha_fin_estimada)
        : null,
    },
  });

  const submit = form.handleSubmit(async (v) => {
    await onSubmit({
      nombre: v.nombre,
      descripcion: v.descripcion,
      estado: v.estado,
      lider_id: v.lider_id,
      cliente: v.cliente,
      fecha_inicio: toISO(v.fecha_inicio),
      fecha_fin_estimada: toISO(v.fecha_fin_estimada),
    });
  });

  const errors = form.formState.errors;

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="nombre">Nombre del proyecto</Label>
        <Input id="nombre" placeholder="Migración a SAP S/4HANA" {...form.register("nombre")} />
        {errors.nombre && <p className="text-xs text-destructive">{errors.nombre.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="descripcion">Descripción</Label>
        <Textarea
          id="descripcion"
          rows={3}
          placeholder="Objetivo y alcance del proyecto"
          {...form.register("descripcion")}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Estado</Label>
          <Select
            value={form.watch("estado")}
            onValueChange={(v) => form.setValue("estado", v as FormValues["estado"])}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PROJECT_ESTADO_LABEL).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Líder</Label>
          <Select
            value={form.watch("lider_id") ? String(form.watch("lider_id")) : NINGUNO}
            onValueChange={(v) => form.setValue("lider_id", v === NINGUNO ? null : Number(v))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sin asignar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NINGUNO}>Sin asignar</SelectItem>
              {users
                .filter((u) => u.is_active)
                .map((u) => (
                  <SelectItem key={u.id} value={String(u.id)}>
                    {u.nombre}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Cliente</Label>
        <ComboboxCreatable
          value={form.watch("cliente")}
          onChange={(v) => form.setValue("cliente", v)}
          options={meta?.empresas ?? []}
          placeholder="Seleccionar o crear cliente"
          emptyValueLabel="Sin cliente"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <DateField
          label="Fecha de inicio"
          value={form.watch("fecha_inicio")}
          onChange={(d) => form.setValue("fecha_inicio", d)}
        />
        <DateField
          label="Fecha de entrega"
          // Es el dato contra el que se mide la salud: sin él el proyecto
          // nunca puede marcarse atrasado (ver projects/progress.py).
          hint="Necesaria para medir si va a tiempo"
          value={form.watch("fecha_fin_estimada")}
          onChange={(d) => form.setValue("fecha_fin_estimada", d)}
          error={errors.fecha_fin_estimada?.message}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" className="gap-2" disabled={form.formState.isSubmitting}>
          <Save className="h-4 w-4" />
          {defaultValues ? "Guardar cambios" : "Crear proyecto"}
        </Button>
      </div>
    </form>
  );
}

function DateField({
  label,
  hint,
  value,
  onChange,
  error,
}: {
  label: string;
  hint?: string;
  value: Date | null;
  onChange: (d: Date | null) => void;
  error?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "w-full justify-start gap-2 font-normal",
              !value && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="h-4 w-4" />
            {value ? format(value, "d 'de' MMMM yyyy", { locale: es }) : "Sin definir"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value ?? undefined}
            onSelect={(d) => onChange(d ?? null)}
            locale={es}
          />
          {value && (
            <div className="border-t p-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => onChange(null)}
              >
                Quitar fecha
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
