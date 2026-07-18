import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Archive, ArchiveRestore, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useSound } from "@/providers/SoundProvider";
import { ApiError } from "@/lib/api";
import { ColorSwatchPicker } from "./ColorSwatchPicker";

interface MasterItem {
  id: number;
  nombre: string;
  is_active: boolean;
  color?: string;
}

interface MasterCrudSectionProps<T extends MasterItem> {
  title: string;
  description: string;
  queryKey: string[];
  invalidateKeys?: string[][];
  service: {
    list: () => Promise<T[]>;
    create: (input: Record<string, unknown>) => Promise<T>;
    update: (id: number, patch: Record<string, unknown>) => Promise<T>;
    remove: (id: number) => Promise<void>;
  };
  withColor?: boolean;
}

export function MasterCrudSection<T extends MasterItem>({
  title,
  description,
  queryKey,
  invalidateKeys = [],
  service,
  withColor = false,
}: MasterCrudSectionProps<T>) {
  const qc = useQueryClient();
  const { play } = useSound();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [nombre, setNombre] = useState("");
  const [color, setColor] = useState("#29AFF5");

  const { data: items = [], isLoading } = useQuery({ queryKey, queryFn: service.list });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey });
    invalidateKeys.forEach((key) => qc.invalidateQueries({ queryKey: key }));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = { nombre };
      if (withColor) payload.color = color;
      return editing ? service.update(editing.id, payload) : service.create(payload);
    },
    onSuccess: () => {
      invalidate();
      toast.success(editing ? "Actualizado" : "Creado");
      play("success");
      setOpen(false);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (item: T) => service.update(item.id, { is_active: !item.is_active }),
    onSuccess: () => {
      invalidate();
      play("success");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => service.remove(id),
    onSuccess: () => {
      invalidate();
      toast.success("Eliminado");
      play("droplet");
    },
    onError: (err) => {
      const message =
        err instanceof ApiError
          ? String((err.data && (err.data as { detail?: string }).detail) || err.message)
          : "No se pudo eliminar";
      toast.error(message);
    },
  });

  const openCreate = () => {
    setEditing(null);
    setNombre("");
    setColor("#29AFF5");
    setOpen(true);
  };

  const openEdit = (item: T) => {
    setEditing(item);
    setNombre(item.nombre);
    setColor(item.color ?? "#29AFF5");
    setOpen(true);
  };

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Button size="sm" className="gap-2" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Nuevo
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground italic py-4 text-center">
          Sin registros todavía.
        </p>
      ) : (
        <div className="space-y-1.5">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                {withColor && item.color && (
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ background: item.color }}
                  />
                )}
                <span
                  className={`text-sm truncate ${!item.is_active ? "text-muted-foreground line-through" : ""}`}
                >
                  {item.nombre}
                </span>
                {!item.is_active && (
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
                  onClick={() => openEdit(item)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => toggleActiveMutation.mutate(item)}
                  title={item.is_active ? "Archivar" : "Reactivar"}
                >
                  {item.is_active ? (
                    <Archive className="h-3.5 w-3.5" />
                  ) : (
                    <ArchiveRestore className="h-3.5 w-3.5" />
                  )}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive"
                  onClick={() => deleteMutation.mutate(item.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar" : "Nuevo"} · {title}
            </DialogTitle>
            <DialogDescription>
              {editing ? "Actualiza el nombre." : "Créalo para tu organización."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Nombre</Label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
            </div>
            {withColor && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Color</Label>
                <ColorSwatchPicker value={color} onChange={setColor} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!nombre.trim() || saveMutation.isPending}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
