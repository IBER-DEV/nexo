import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { activitiesService } from "@/services/activitiesService";
import { usersService, type TeamMemberUpdate } from "@/services/usersService";
import { accessCodesService, type AccessCodeInput } from "@/services/accessCodesService";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/providers/AuthProvider";
import { useSound } from "@/providers/SoundProvider";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ROLE_LABEL, type AccessCode, type User, type UserRole } from "@/lib/types";
import { ApiError } from "@/lib/api";
import { toast } from "sonner";
import { Users, KeyRound, Copy, Ban, RotateCcw, Plus } from "lucide-react";

export const Route = createFileRoute("/_app/users")({
  head: () => ({
    meta: [
      { title: "Usuarios · Nexo" },
      { name: "description", content: "Gestión de miembros, roles y acceso a la organización." },
    ],
  }),
  component: UsersPage,
});

const ASSIGNABLE_ROLES: UserRole[] = ["admin", "coordinator", "member"];

function apiErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    const data = err.data as Record<string, unknown> | null;
    if (typeof data?.detail === "string") return data.detail;
    const firstField = data && Object.values(data)[0];
    if (Array.isArray(firstField) && typeof firstField[0] === "string") return firstField[0];
  }
  return err instanceof Error ? err.message : fallback;
}

function UsersPage() {
  const { isAdmin, user: me } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { play } = useSound();
  const [savingId, setSavingId] = useState<number | null>(null);

  useEffect(() => {
    if (!isAdmin) {
      navigate({ to: "/", replace: true });
    }
  }, [isAdmin, navigate]);

  const { data: users, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => usersService.list(),
    enabled: isAdmin,
  });
  const { data: activities } = useQuery({
    queryKey: ["activities"],
    queryFn: () => activitiesService.list(),
    enabled: isAdmin,
  });

  const activos = useMemo(() => (users ?? []).filter((u) => u.is_active), [users]);
  const coordinators = useMemo(() => activos.filter((u) => u.rol === "coordinator"), [activos]);
  const members = useMemo(() => activos.filter((u) => u.rol === "member"), [activos]);
  const unassigned = useMemo(() => members.filter((m) => m.coordinador_id == null), [members]);
  const teamByCoordinator = useMemo(() => {
    const map = new Map<number, User[]>();
    coordinators.forEach((c) => map.set(c.id, []));
    members.forEach((m) => {
      if (m.coordinador_id != null && map.has(m.coordinador_id)) {
        map.get(m.coordinador_id)!.push(m);
      }
    });
    return map;
  }, [coordinators, members]);

  const counts = (activities ?? []).reduce<Record<number, number>>((acc, a) => {
    acc[a.responsable_id] = (acc[a.responsable_id] || 0) + 1;
    return acc;
  }, {});

  const updateMember = async (
    userId: number,
    changes: TeamMemberUpdate,
    successMessage: string,
  ) => {
    setSavingId(userId);
    try {
      await usersService.updateTeamMember(userId, changes);
      await qc.invalidateQueries({ queryKey: ["users"] });
      toast.success(successMessage);
      play("success");
    } catch (err) {
      toast.error(apiErrorMessage(err, "No se pudo actualizar el miembro"));
    } finally {
      setSavingId(null);
    }
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuarios y equipos"
        description="Gestiona miembros, roles y el acceso a tu organización"
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {coordinators.map((coord) => {
            const team = teamByCoordinator.get(coord.id) ?? [];
            return (
              <Card key={coord.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    {coord.nombre}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">{coord.email}</p>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-2">
                    {team.length === 0
                      ? "Sin miembros asignados"
                      : `${team.length} miembro${team.length === 1 ? "" : "s"}`}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {team.map((m) => (
                      <Badge key={m.id} variant="secondary" className="font-normal">
                        {m.nombre}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {unassigned.length > 0 && (
            <Card className="border-dashed">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-muted-foreground">Sin coordinador</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-2">
                  {unassigned.length} miembro{unassigned.length === 1 ? "" : "s"} sin asignar
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {unassigned.map((m) => (
                    <Badge key={m.id} variant="outline" className="font-normal">
                      {m.nombre}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <AccessCodesSection />

      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Coordinador</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-right">Actividades</TableHead>
              <TableHead className="text-right">Acceso</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            {(users ?? []).map((u) => {
              const isSelf = u.id === me?.id;
              const isOwner = u.rol === "owner";
              const locked = isSelf || isOwner;
              return (
                <TableRow
                  key={u.id}
                  className={`hover:bg-muted/30 ${u.is_active ? "" : "opacity-50"}`}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary/15 text-primary text-xs">
                          {u.iniciales}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-sm">{u.nombre}</span>
                      {!u.is_active && (
                        <Badge variant="outline" className="text-xs font-normal">
                          Inactivo
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {locked ? (
                      <Badge variant={isOwner || u.rol === "admin" ? "default" : "secondary"}>
                        {ROLE_LABEL[u.rol]}
                      </Badge>
                    ) : (
                      <Select
                        value={u.rol}
                        onValueChange={(v) =>
                          updateMember(u.id, { rol: v as UserRole }, "Rol actualizado")
                        }
                        disabled={savingId === u.id || !u.is_active}
                      >
                        <SelectTrigger className="h-8 w-[150px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ASSIGNABLE_ROLES.map((rol) => (
                            <SelectItem key={rol} value={rol}>
                              {ROLE_LABEL[rol]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell>
                    {u.rol === "member" && u.is_active ? (
                      <Select
                        value={u.coordinador_id != null ? String(u.coordinador_id) : "none"}
                        onValueChange={(v) =>
                          updateMember(
                            u.id,
                            { coordinador_id: v === "none" ? null : Number(v) },
                            "Coordinador actualizado",
                          )
                        }
                        disabled={savingId === u.id}
                      >
                        <SelectTrigger className="h-8 w-[200px]">
                          <SelectValue placeholder="Sin coordinador" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sin coordinador</SelectItem>
                          {coordinators.map((c) => (
                            <SelectItem key={c.id} value={String(c.id)}>
                              {c.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : u.rol === "coordinator" ? (
                      <span className="text-sm text-muted-foreground">
                        {(teamByCoordinator.get(u.id) ?? []).length} en su equipo
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {counts[u.id] ?? 0}
                  </TableCell>
                  <TableCell className="text-right">
                    {locked ? (
                      <span className="text-sm text-muted-foreground">—</span>
                    ) : u.is_active ? (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1.5 text-destructive hover:text-destructive"
                            disabled={savingId === u.id}
                          >
                            <Ban className="h-3.5 w-3.5" />
                            Desactivar
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Desactivar a {u.nombre}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              No podrá iniciar sesión, pero su historial de actividades se conserva.
                              Puedes reactivarle el acceso cuando quieras.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() =>
                                updateMember(u.id, { is_active: false }, "Acceso desactivado")
                              }
                            >
                              Desactivar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1.5"
                        disabled={savingId === u.id}
                        onClick={() => updateMember(u.id, { is_active: true }, "Acceso reactivado")}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Reactivar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

const EXPIRY_OPTIONS = [
  { value: "never", label: "Sin expiración", hours: null },
  { value: "24h", label: "24 horas", hours: 24 },
  { value: "7d", label: "7 días", hours: 24 * 7 },
  { value: "30d", label: "30 días", hours: 24 * 30 },
] as const;

function AccessCodesSection() {
  const qc = useQueryClient();
  const { play } = useSound();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [rol, setRol] = useState<UserRole>("member");
  const [expiry, setExpiry] = useState<string>("7d");
  const [maxUsos, setMaxUsos] = useState<string>("");

  const { data: codes, isLoading } = useQuery({
    queryKey: ["access-codes"],
    queryFn: accessCodesService.list,
  });

  const createCode = useMutation({
    mutationFn: (input: AccessCodeInput) => accessCodesService.create(input),
    onSuccess: (code) => {
      qc.invalidateQueries({ queryKey: ["access-codes"] });
      setDialogOpen(false);
      navigator.clipboard?.writeText(code.codigo).catch(() => {});
      toast.success(`Código ${code.codigo} generado y copiado`);
      play("success");
    },
    onError: (err) => {
      toast.error(apiErrorMessage(err, "No se pudo generar el código"));
    },
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      accessCodesService.setActive(id, is_active),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["access-codes"] });
      toast.success(vars.is_active ? "Código reactivado" : "Código desactivado");
    },
    onError: (err) => toast.error(apiErrorMessage(err, "No se pudo actualizar el código")),
  });

  const handleGenerate = () => {
    const option = EXPIRY_OPTIONS.find((o) => o.value === expiry);
    const expires_at =
      option?.hours != null ? new Date(Date.now() + option.hours * 3600_000).toISOString() : null;
    const parsedMax = maxUsos.trim() === "" ? null : Number(maxUsos);
    if (parsedMax != null && (!Number.isInteger(parsedMax) || parsedMax < 1)) {
      toast.error("El máximo de usos debe ser un entero positivo");
      return;
    }
    createCode.mutate({ rol, expires_at, max_usos: parsedMax });
  };

  const copyCode = (codigo: string) => {
    navigator.clipboard
      ?.writeText(codigo)
      .then(() => toast.success("Código copiado"))
      .catch(() => toast.error("No se pudo copiar"));
  };

  const describeState = (code: AccessCode): { label: string; usable: boolean } => {
    if (!code.is_active) return { label: "Desactivado", usable: false };
    if (code.expires_at && new Date(code.expires_at) <= new Date()) {
      return { label: "Expirado", usable: false };
    }
    if (code.max_usos != null && code.usos >= code.max_usos) {
      return { label: "Agotado", usable: false };
    }
    return { label: "Vigente", usable: true };
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            Códigos de acceso
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Comparte un código para que tu equipo se una desde “Crear cuenta → Tengo un código”.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              Generar código
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Generar código de acceso</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Rol de quien se una</Label>
                <Select value={rol} onValueChange={(v) => setRol(v as UserRole)}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSIGNABLE_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Expira</Label>
                <Select value={expiry} onValueChange={setExpiry}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPIRY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="max-usos">Máximo de usos (vacío = ilimitado)</Label>
                <Input
                  id="max-usos"
                  type="number"
                  min={1}
                  placeholder="Ej. 5"
                  value={maxUsos}
                  onChange={(e) => setMaxUsos(e.target.value)}
                  className="h-10"
                />
              </div>
              <Button className="w-full" onClick={handleGenerate} disabled={createCode.isPending}>
                {createCode.isPending ? "Generando..." : "Generar y copiar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-4">
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (codes ?? []).length === 0 ? (
          <p className="px-6 pb-5 text-sm text-muted-foreground">
            Aún no hay códigos. Genera uno para invitar a tu equipo.
          </p>
        ) : (
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Usos</TableHead>
                <TableHead>Expira</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(codes ?? []).map((code) => {
                const state = describeState(code);
                return (
                  <TableRow key={code.id} className={state.usable ? "" : "opacity-60"}>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => copyCode(code.codigo)}
                        className="inline-flex items-center gap-1.5 font-mono text-sm hover:text-primary"
                        title="Copiar código"
                      >
                        {code.codigo}
                        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{ROLE_LABEL[code.rol]}</Badge>
                    </TableCell>
                    <TableCell className="tabular-nums text-sm">
                      {code.usos}
                      {code.max_usos != null ? ` / ${code.max_usos}` : ""}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {code.expires_at ? new Date(code.expires_at).toLocaleDateString() : "Nunca"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={state.usable ? "default" : "outline"}>{state.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8"
                        disabled={toggleActive.isPending}
                        onClick={() =>
                          toggleActive.mutate({ id: code.id, is_active: !code.is_active })
                        }
                      >
                        {code.is_active ? "Desactivar" : "Reactivar"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
