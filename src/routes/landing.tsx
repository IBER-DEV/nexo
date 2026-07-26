import { createFileRoute } from "@tanstack/react-router";

import { LandingPage, landingHead } from "@/components/landing/LandingPage";

/**
 * URL histórica de la landing. La página canónica es ahora `/` (ver
 * `routes/index.tsx`); esta se mantiene viva —sirviendo el mismo
 * componente, no un redirect— porque ya está enlazada desde el README, la
 * documentación y fuera del repo, y romper enlaces publicados cuesta más
 * que mantener dos rutas apuntando al mismo contenido.
 */
export const Route = createFileRoute("/landing")({
  head: () => landingHead,
  component: LandingPage,
});
