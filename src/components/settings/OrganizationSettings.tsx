import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { useSound } from "@/providers/SoundProvider";
import { mastersService } from "@/services/mastersService";

export function OrganizationSettings() {
  const { play } = useSound();
  const { data: org, isLoading } = useQuery({
    queryKey: ["organization"],
    queryFn: () => mastersService.organization.get(),
  });

  const [form, setForm] = useState({
    nombre: "",
    codigo_prefix: "",
    timezone: "",
    locale: "",
    currency: "",
    appsheet_spreadsheet_id: "",
    appsheet_worksheet_name: "",
  });

  useEffect(() => {
    if (!org) return;
    setForm({
      nombre: org.nombre,
      codigo_prefix: org.codigo_prefix,
      timezone: org.timezone,
      locale: org.locale,
      currency: org.currency,
      appsheet_spreadsheet_id: org.appsheet_spreadsheet_id,
      appsheet_worksheet_name: org.appsheet_worksheet_name,
    });
  }, [org]);

  const saveMutation = useMutation({
    mutationFn: () => mastersService.organization.update(form),
    onSuccess: () => {
      toast.success("Organización actualizada");
      play("success");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Error al guardar"),
  });

  if (isLoading) {
    return <Skeleton className="h-96 rounded-xl max-w-2xl" />;
  }

  return (
    <Card className="p-6 space-y-5 max-w-2xl">
      <div>
        <h3 className="font-semibold">Organización</h3>
        <p className="text-xs text-muted-foreground">
          Datos generales y prefijo de código de actividades ({form.codigo_prefix || "ACT"}-0001).
        </p>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Nombre</Label>
          <Input
            value={form.nombre}
            onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Prefijo de código</Label>
          <Input
            value={form.codigo_prefix}
            maxLength={10}
            onChange={(e) =>
              setForm((f) => ({ ...f, codigo_prefix: e.target.value.toUpperCase() }))
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Zona horaria</Label>
          <Input
            value={form.timezone}
            onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Idioma</Label>
          <Input
            value={form.locale}
            onChange={(e) => setForm((f) => ({ ...f, locale: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Moneda</Label>
          <Input
            value={form.currency}
            maxLength={3}
            onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value.toUpperCase() }))}
          />
        </div>
      </div>

      <div className="pt-2 border-t border-border">
        <h4 className="text-sm font-semibold mb-1">Sync con Google Sheets</h4>
        <p className="text-xs text-muted-foreground mb-3">
          Configura el spreadsheet que alimenta el sync bidireccional de AppSheet.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Spreadsheet ID</Label>
            <Input
              value={form.appsheet_spreadsheet_id}
              onChange={(e) => setForm((f) => ({ ...f, appsheet_spreadsheet_id: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Nombre de la hoja</Label>
            <Input
              value={form.appsheet_worksheet_name}
              onChange={(e) => setForm((f) => ({ ...f, appsheet_worksheet_name: e.target.value }))}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          className="gap-2"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
          <Save className="h-4 w-4" /> Guardar
        </Button>
      </div>
    </Card>
  );
}
