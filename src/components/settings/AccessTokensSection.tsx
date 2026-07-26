import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Check, Copy, KeyRound, Plus, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSound } from "@/providers/SoundProvider";
import { McpConnection } from "@/components/settings/McpConnection";
import {
  TOKEN_SCOPE_LABEL,
  tokensService,
  type AccessToken,
  type TokenScope,
} from "@/services/tokensService";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function AccessTokensSection() {
  const { play } = useSound();
  const qc = useQueryClient();
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [scope, setScope] = useState<TokenScope>("read_write");
  // El valor en claro solo existe en este estado, y solo hasta que se cierre
  // el diálogo: el backend no lo guarda ni lo vuelve a enviar.
  const [recienCreado, setRecienCreado] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const { data: tokens, isLoading } = useQuery({
    queryKey: ["access-tokens"],
    queryFn: () => tokensService.list(),
  });

  const crear = useMutation({
    mutationFn: () => tokensService.create({ nombre: nombre.trim(), scope }),
    onSuccess: (creado) => {
      setRecienCreado(creado.token);
      setNombre("");
      play("success");
      qc.invalidateQueries({ queryKey: ["access-tokens"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "No se pudo crear el token"),
  });

  const revocar = useMutation({
    mutationFn: (id: number) => tokensService.revoke(id),
    onSuccess: () => {
      toast.success("Token revocado");
      qc.invalidateQueries({ queryKey: ["access-tokens"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "No se pudo revocar"),
  });

  const copiar = async () => {
    if (!recienCreado) return;
    await navigator.clipboard.writeText(recienCreado);
    setCopiado(true);
    toast.success("Token copiado");
    setTimeout(() => setCopiado(false), 2000);
  };

  const cerrar = () => {
    setAbierto(false);
    setRecienCreado(null);
    setCopiado(false);
    setNombre("");
  };

  const activos = (tokens ?? []).filter((t) => t.is_usable);
  const inactivos = (tokens ?? []).filter((t) => !t.is_usable);

  return (
    <Card className="p-6 space-y-5 max-w-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            Tokens de acceso
          </h3>
          <p className="text-xs text-muted-foreground">
            Credenciales de larga vida para conectar Nexo a otras herramientas — un cliente de IA,
            un script, una integración. Heredan tus permisos y nunca pueden más que tu cuenta.
          </p>
        </div>

        <Dialog open={abierto} onOpenChange={(v) => (v ? setAbierto(true) : cerrar())}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4" />
              Nuevo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{recienCreado ? "Token creado" : "Nuevo token de acceso"}</DialogTitle>
            </DialogHeader>

            {recienCreado ? (
              <div className="space-y-4">
                <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Cópialo ahora: no se guarda en ningún lado y no vas a poder verlo otra vez. Si
                    lo pierdes, revócalo y crea uno nuevo.
                  </span>
                </div>
                <div className="flex gap-2">
                  <Input readOnly value={recienCreado} className="font-mono text-xs" />
                  <Button variant="outline" size="icon" onClick={copiar}>
                    {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>

                {/* Este es el único momento en que el token existe en
                    claro, así que es el único en que se le puede entregar
                    la configuración lista para pegar. Después ya no. */}
                <div className="border-t border-border/60 pt-4">
                  <McpConnection token={recienCreado} />
                </div>

                <Button onClick={cerrar} className="w-full">
                  Ya lo guardé
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Nombre</Label>
                  <Input
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Claude Desktop"
                  />
                  <p className="text-xs text-muted-foreground">
                    Para reconocerlo después y saber qué revocar.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Permisos</Label>
                  <Select value={scope} onValueChange={(v) => setScope(v as TokenScope)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="read_write">Lectura y escritura</SelectItem>
                      <SelectItem value="read">Solo lectura</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Solo lectura sirve para dejar que una IA consulte tus actividades sin poder
                    modificarlas.
                  </p>
                </div>
                <Button
                  onClick={() => crear.mutate()}
                  disabled={!nombre.trim() || crear.isPending}
                  className="w-full"
                >
                  {crear.isPending ? "Creando…" : "Crear token"}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <Skeleton className="h-24 rounded-lg" />
      ) : (tokens ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Todavía no tienes tokens. Crea uno cuando quieras conectar Nexo con otra herramienta.
        </p>
      ) : (
        <div className="space-y-2">
          {[...activos, ...inactivos].map((token) => (
            <TokenRow
              key={token.id}
              token={token}
              onRevoke={() => revocar.mutate(token.id)}
              revoking={revocar.isPending}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

function TokenRow({
  token,
  onRevoke,
  revoking,
}: {
  token: AccessToken;
  onRevoke: () => void;
  revoking: boolean;
}) {
  const inactivo = !token.is_usable;
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-md border border-border/60 p-3 ${
        inactivo ? "opacity-60" : ""
      }`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{token.nombre}</span>
          <Badge variant={token.scope === "read" ? "outline" : "secondary"}>
            {TOKEN_SCOPE_LABEL[token.scope]}
          </Badge>
          {token.revoked_at && <Badge variant="destructive">Revocado</Badge>}
          {token.is_expired && !token.revoked_at && <Badge variant="destructive">Expirado</Badge>}
        </div>
        <p className="mt-0.5 font-mono text-xs text-muted-foreground">{token.prefix}…</p>
        <p className="text-xs text-muted-foreground">
          Creado {formatDate(token.created_at)} · Último uso{" "}
          {token.last_used_at ? formatDate(token.last_used_at) : "nunca"}
        </p>
      </div>

      {!inactivo && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" disabled={revoking}>
              <Ban className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Revocar «{token.nombre}»?</AlertDialogTitle>
              <AlertDialogDescription>
                Cualquier herramienta que use este token va a perder el acceso de inmediato. No se
                puede deshacer: habría que crear uno nuevo.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={onRevoke}>Revocar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
