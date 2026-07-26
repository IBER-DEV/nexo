import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { API_BASE_URL } from "@/lib/api";

export const MCP_URL = `${API_BASE_URL.replace(/\/$/, "")}/mcp/`;

/** El token real solo existe en memoria y solo cuando se acaba de crear.
 *  Sin él mostramos el mismo bloque con un marcador, para que alguien que
 *  ya tiene su token guardado igual pueda ver dónde va. */
const PLACEHOLDER = "TU_TOKEN_AQUI";

function configJson(token: string) {
  return JSON.stringify(
    {
      mcpServers: {
        nexo: {
          type: "http",
          url: MCP_URL,
          headers: { Authorization: `Bearer ${token}` },
        },
      },
    },
    null,
    2,
  );
}

function configCli(token: string) {
  return `claude mcp add --transport http nexo ${MCP_URL} \\\n  --header "Authorization: Bearer ${token}"`;
}

function BloqueCopiable({ texto, lenguaje }: { texto: string; lenguaje?: string }) {
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    await navigator.clipboard.writeText(texto);
    setCopiado(true);
    toast.success("Copiado");
    setTimeout(() => setCopiado(false), 2000);
  };
  return (
    <div className="relative">
      <pre className="max-h-64 overflow-auto rounded-md border border-border/60 bg-muted/50 p-3 pr-12 font-mono text-xs leading-relaxed">
        <code>{texto}</code>
      </pre>
      <Button
        variant="ghost"
        size="icon"
        onClick={copiar}
        className="absolute right-1.5 top-1.5 h-7 w-7"
        aria-label={`Copiar ${lenguaje ?? "configuración"}`}
      >
        {copiado ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}

/**
 * Le arma al usuario la configuración de su cliente de IA, lista para
 * pegar. Existe porque sin esto el diferenciador es invisible: el servidor
 * MCP funciona, pero nadie va a deducir la URL ni el formato del header
 * leyendo la documentación de otro producto.
 */
export function McpConnection({ token }: { token?: string }) {
  const valor = token ?? PLACEHOLDER;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Conecta Nexo a tu cliente de IA y pídele que consulte o cargue tus actividades. Nexo no
        cobra por esto: usas tu propia cuenta de IA.
      </p>

      <Tabs defaultValue="json">
        <TabsList>
          <TabsTrigger value="json">Claude Desktop</TabsTrigger>
          <TabsTrigger value="cli">Claude Code</TabsTrigger>
        </TabsList>
        <TabsContent value="json" className="mt-3 space-y-2">
          <p className="text-xs text-muted-foreground">
            Pégalo en tu archivo de configuración de MCP.
          </p>
          <BloqueCopiable texto={configJson(valor)} lenguaje="JSON" />
        </TabsContent>
        <TabsContent value="cli" className="mt-3 space-y-2">
          <p className="text-xs text-muted-foreground">Ejecútalo en tu terminal.</p>
          <BloqueCopiable texto={configCli(valor)} lenguaje="comando" />
        </TabsContent>
      </Tabs>

      {!token && (
        <p className="text-xs text-muted-foreground">
          Reemplaza <code className="font-mono">{PLACEHOLDER}</code> por un token que hayas
          guardado, o crea uno nuevo arriba.
        </p>
      )}
    </div>
  );
}
