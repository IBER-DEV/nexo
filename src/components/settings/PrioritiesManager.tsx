import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Archive, ArchiveRestore, ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useSound } from "@/providers/SoundProvider";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import { mastersService } from "@/services/mastersService";
import type { Priority } from "@/lib/types";
import { ColorSwatchPicker } from "./ColorSwatchPicker";

export function PrioritiesManager() {
  const qc = useQueryClient();
  const { play } = useSound();
  const { workspace, refetch } = useWorkspace();
  const priorities = [...(workspace?.priorities ?? [])].sort((a, b) => a.orden - b.orden);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Priority | null>(null);
  const [form, setForm] = useState({ nombre: "", color: "#29AFF5", is_default: false });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["workspace"] });
    refetch();
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      editing
        ? mastersService.priorities.update(editing.id, form)
        : mastersService.priorities.create(form),
    onSuccess: () => {
      invalidate();
      toast.success(editing ? "Prioridad actualizada" : "Prioridad creada");
      play("success");
      setOpen(false);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Error al guardar"),
  });

  const archiveMutation = useMutation({
    mutationFn: (p: Priority) =>
      mastersService.priorities.update(p.id, { is_active: !p.is_active }),
    onSuccess: () => {
      invalidate();
      play("success");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "No se pudo actualizar"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => mastersService.priorities.remove(id),
    onSuccess: () => {
      invalidate();
      toast.success("Prioridad eliminada");
      play("droplet");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "No se pudo eliminar"),
  });

  const reorderMutation = useMutation({
    mutationFn: (ids: number[]) => mastersService.priorities.reorder(ids),
    onSuccess: () => invalidate(),
  });

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= priorities.length) return;
    const ids = priorities.map((p) => p.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorderMutation.mutate(ids);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ nombre: "", color: "#29AFF5", is_default: false });
    setOpen(true);
  };

  const openEdit = (p: Priority) => {
    setEditing(p);
    setForm({ nombre: p.nombre, color: p.color, is_default: p.is_default });
    setOpen(true);
  };

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold">Prioridades</h3>
          <p className="text-xs text-muted-foreground">
            La prioridad marcada como predeterminada se asigna a las actividades nuevas.
          </p>
        </div>
        <Button size="sm" className="gap-2" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Nueva prioridad
        </Button>
      </div>

      <div className="space-y-1.5">
        {priorities.map((p, index) => (
          <div
            key={p.id}
            className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: p.color }} />
              <span
                className={`text-sm truncate ${!p.is_active ? "text-muted-foreground line-through" : ""}`}
              >
                {p.nombre}
              </span>
              {p.is_default && <Badge className="text-[10px] shrink-0">Predeterminada</Badge>}
              {!p.is_active && (
                <Badge variant="secondary" className="text-[10px] shrink-0">
                  Archivada
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
                disabled={index === priorities.length - 1}
                onClick={() => move(index, 1)}
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(p)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => archiveMutation.mutate(p)}
                title={p.is_active ? "Archivar" : "Reactivar"}
              >
                {p.is_active ? (
                  <Archive className="h-3.5 w-3.5" />
                ) : (
                  <ArchiveRestore className="h-3.5 w-3.5" />
                )}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-destructive"
                onClick={() => deleteMutation.mutate(p.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar prioridad" : "Nueva prioridad"}</DialogTitle>
            <DialogDescription>
              Configura el nombre, color y si es la predeterminada.
            </DialogDescription>
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
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs font-medium">Predeterminada</Label>
                <p className="text-[11px] text-muted-foreground">
                  Se asigna a las actividades nuevas sin prioridad explícita
                </p>
              </div>
              <Switch
                checked={form.is_default}
                onCheckedChange={(c) => setForm((f) => ({ ...f, is_default: c }))}
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
