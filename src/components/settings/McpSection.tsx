import { Bot } from "lucide-react";
import { Card } from "@/components/ui/card";
import { McpConnection } from "@/components/settings/McpConnection";

/**
 * Tarjeta permanente de conexión. Complementa el bloque que aparece al
 * crear un token: ese solo se ve una vez, y quien ya guardó el suyo
 * necesita poder volver por la URL y el formato sin emitir otro.
 */
export function McpSection() {
  return (
    <Card className="p-6 space-y-4 max-w-2xl">
      <div>
        <h3 className="font-semibold flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          Conectar con IA (MCP)
        </h3>
        <p className="text-xs text-muted-foreground">
          Pídele a tu asistente que cargue actividades, te resuma el backlog o mueva estados — sin
          salir de tu conversación.
        </p>
      </div>
      <McpConnection />
    </Card>
  );
}
