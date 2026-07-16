import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { activitiesService } from "@/services/activitiesService";
import { usersService } from "@/services/usersService";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/providers/AuthProvider";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ROLE_LABEL, type User } from "@/lib/types";
import { ApiError } from "@/lib/api";
import { toast } from "sonner";
import { Users } from "lucide-react";

export const Route = createFileRoute("/_app/users")({
  head: () => ({
    meta: [
      { title: "Usuarios · Nexo" },
      { name: "description", content: "Gestión de equipos y asignación de coordinadores." },
    ],
  }),
  component: UsersPage,
});

function UsersPage() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
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

  const coordinators = useMemo(
    () => (users ?? []).filter((u) => u.rol === "coordinator"),
    [users],
  );
  const members = useMemo(
    () => (users ?? []).filter((u) => u.rol === "member"),
    [users],
  );
  const unassigned = useMemo(
    () => members.filter((m) => m.coordinador_id == null),
    [members],
  );
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

  const handleAssign = async (userId: number, coordinadorId: number | null) => {
    setSavingId(userId);
    try {
      await usersService.assignCoordinator(userId, coordinadorId);
      await qc.invalidateQueries({ queryKey: ["users"] });
      toast.success("Coordinador actualizado");
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? (err.data as { coordinador_id?: string[] })?.coordinador_id?.[0] ?? err.message
          : "No se pudo actualizar el equipo";
      toast.error(msg);
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
        description="Asigna coordinadores a cada miembro del área de sistemas"
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

      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Coordinador</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-right">Actividades</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 5 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            {(users ?? []).map((u) => (
              <TableRow key={u.id} className="hover:bg-muted/30">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary/15 text-primary text-xs">
                        {u.iniciales}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-sm">{u.nombre}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={u.rol === "admin" ? "default" : "secondary"}>
                    {ROLE_LABEL[u.rol]}
                  </Badge>
                </TableCell>
                <TableCell>
                  {u.rol === "member" ? (
                    <Select
                      value={u.coordinador_id != null ? String(u.coordinador_id) : "none"}
                      onValueChange={(v) =>
                        handleAssign(u.id, v === "none" ? null : Number(v))
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
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
