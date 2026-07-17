import { NexoMark } from "@/components/brand/NexoMark";

export const NEXO_REPO_URL = "https://github.com/IBER-DEV/nexo";
export const NEXO_DISCUSSIONS_URL = "https://github.com/IBER-DEV/nexo/discussions";

/** Defs de gradiente compartidas por todas las instancias del isotipo en la landing. */
export function NexoGradientDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden="true">
      <defs>
        <linearGradient id="nexo-landing-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/** Isotipo real de Nexo (nodo central + actividad/planeación/equipo) con degradado indigo→emerald. */
export function NexoBrandMark({ className }: { className?: string }) {
  return <NexoMark className={className} color="url(#nexo-landing-gradient)" />;
}
