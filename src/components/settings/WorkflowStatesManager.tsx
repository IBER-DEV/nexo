import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useSound } from "@/providers/SoundProvider";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import { mastersService } from "@/services/mastersService";
import type { WorkflowState, WorkflowCategoria } from "@/lib/types";
import { ColorSwatchPicker } from "./ColorSwatchPicker";

const CATEGORIA_LABEL: Record<WorkflowCategoria, string> = {
  todo: "Por hacer",
  active: "En curso",
  done: "Finalizado",
  cancelled: "Cancelado",
};

export function WorkflowStatesManager() {
  const qc = useQueryClient();
  const { play } = useSound();
  const { workspace, refetch } = useWorkspace();
  const states = [...(workspace?.workflow_states ?? [])].sort((a, b) => a.orden - b.orden);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<WorkflowState | null>(null);
  const [form, setForm] = useState({
    nombre: "",
    color: "#29AFF5",
    categoria: "todo" as WorkflowCategoria,
    is_initial: false,
    mostrar_en_kanban: true,
    sheet_phase: "",
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["workspace"] });
    refetch();
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      editing
        ? mastersService.workflowStates.update(editing.id, form)
        : mastersService.workflowStates.create(form),
    onSuccess: () => {
      invalidate();
      toast.success(editing ? "Estado actualizado" : "Estado creado");
      play("success");
      setOpen(false);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Error al guardar"),
  });

  const archiveMutation = useMutation({
    mutationFn: (state: WorkflowState) =>
      mastersService.workflowStates.update(state.id, { is_active: !state.is_active }),
    onSuccess: () => {
      invalidate();
      play("success");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "No se pudo actualizar"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => mastersService.workflowStates.remove(id),
    onSuccess: () => {
      invalidate();
      toast.success("Estado eliminado");
      play("droplet");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "No se pudo eliminar"),
  });

  const reorderMutation = useMutation({
    mutationFn: (ids: number[]) => mastersService.workflowStates.reorder(ids),
    onSuccess: () => invalidate(),
  });

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= states.length) return;
    const ids = states.map((s) => s.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorderMutation.mutate(ids);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      nombre: "",
      color: "#29AFF5",
      categoria: "todo",
      is_initial: false,
      mostrar_en_kanban: true,
      sheet_phase: "",
    });
    setOpen(true);
  };

  const openEdit = (state: WorkflowState) => {
    setEditing(state);
    setForm({
      nombre: state.nombre,
      color: state.color,
      categoria: state.categoria,
      is_initial: state.is_initial,
      mostrar_en_kanban: state.mostrar_en_kanban,
      sheet_phase: state.sheet_phase,
    });
    setOpen(true);
  };

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold">Estados del flujo</h3>
          <p className="text-xs text-muted-foreground">
            El orden define las columnas del Kanban. El estado inicial es el que reciben las
            actividades nuevas.
          </p>
        </div>
        <Button size="sm" className="gap-2" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Nuevo estado
        </Button>
      </div>

      <div className="space-y-1.5">
        {states.map((state, index) => (
          <div
            key={state.id}
            className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ background: state.color }}
              />
              <span
                className={`text-sm truncate ${!state.is_active ? "text-muted-foreground line-through" : ""}`}
              >
                {state.nombre}
              </span>
              <Badge variant="secondary" className="text-[10px] shrink-0">
                {CATEGORIA_LABEL[state.categoria]}
              </Badge>
              {state.is_initial && <Badge className="text-[10px] shrink-0">Inicial</Badge>}
              {!state.mostrar_en_kanban && (
                <Badge variant="outline" className="text-[10px] shrink-0">
                  Oculto en Kanban
                </Badge>
              )}
              {!state.is_active && (
                <Badge variant="secondary" className="text-[10px] shrink-0">
                  Archivado
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                disabled={index === states.length - 1}
                onClick={() => move(index, 1)}
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => openEdit(state)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-destructive"
                onClick={() => deleteMutation.mutate(state.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar estado" : "Nuevo estado"}</DialogTitle>
            <DialogDescription>Configura cómo se ve y se comporta este estado.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Nombre</Label>
              <Input
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Color</Label>
              <ColorSwatchPicker
                value={form.color}
                onChange={(color) => setForm((f) => ({ ...f, color }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Categoría</Label>
              <Select
                value={form.categoria}
                onValueChange={(v) => setForm((f) => ({ ...f, categoria: v as WorkflowCategoria }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(CATEGORIA_LABEL) as WorkflowCategoria[]).map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {CATEGORIA_LABEL[cat]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Determina si cuenta como pendiente, en curso, finalizado o cancelado en reportes.
              </p>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs font-medium">Estado inicial</Label>
                <p className="text-[11px] text-muted-foreground">
                  Se asigna solo a la nueva actividad al crearla
                </p>
              </div>
              <Switch
                checked={form.is_initial}
                onCheckedChange={(c) => setForm((f) => ({ ...f, is_initial: c }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs font-medium">Mostrar en Kanban</Label>
                <p className="text-[11px] text-muted-foreground">
                  Ocúltalo si no debe aparecer como columna del tablero
                </p>
              </div>
              <Switch
                checked={form.mostrar_en_kanban}
                onCheckedChange={(c) => setForm((f) => ({ ...f, mostrar_en_kanban: c }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Fase en Google Sheet</Label>
              <Input
                value={form.sheet_phase}
                onChange={(e) => setForm((f) => ({ ...f, sheet_phase: e.target.value }))}
                placeholder="Vacío = usar el mapeo por categoría"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!form.nombre.trim() || saveMutation.isPending}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
