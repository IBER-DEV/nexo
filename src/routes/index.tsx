import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { LandingPage, landingHead } from "@/components/landing/LandingPage";
import { NexoLoader } from "@/components/brand/NexoLoader";
import { useAuth } from "@/providers/AuthProvider";

/**
 * La raíz del dominio.
 *
 * Antes `/` era el dashboard, así que cualquiera que escribiera
 * nexoengine.tech sin sesión —un visitante, un buscador, el revisor de una
 * pasarela de pagos— aterrizaba en un muro de login y el `<title>` público
 * del dominio era "Dashboard · Nexo". Ahora la raíz muestra el producto a
 * quien no ha entrado, y manda directo al tablero a quien sí.
 *
 * El servidor siempre renderiza la landing (no hay `localStorage` en SSR,
 * así que `isAuthenticated` es false ahí): eso es justamente lo que
 * queremos indexar. La redirección del usuario con sesión ocurre al
 * hidratar.
 */
export const Route = createFileRoute("/")({
  head: () => landingHead,
  component: RootIndex,
});

function RootIndex() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) navigate({ to: "/dashboard", replace: true });
  }, [isAuthenticated, navigate]);

  // Mismo splash que ya usa el layout de la app al entrar — evita mostrarle
  // la landing por un frame a quien va camino a su tablero.
  if (isAuthenticated) return <NexoLoader />;

  return <LandingPage />;
}
