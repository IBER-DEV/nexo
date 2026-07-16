/**
 * Nexo loading mark: the isotipo draws itself in (center scales up, three
 * branches sweep out to their satellite nodes with a bounce), holds with a
 * brief pulse, then fades with the caption — looping every 2.4s. From the
 * Nexo Loading brand kit. Timing lives in styles.css (nexo-loader-* keyframes).
 */
export function NexoLoader({
  label = "Cargando tu espacio de trabajo…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={`flex h-screen flex-col items-center justify-center gap-7 bg-background ${className ?? ""}`}
    >
      <svg width="160" height="160" viewBox="0 0 40 40" className="nexo-loader-group" fill="none">
        <line
          x1="20"
          y1="20"
          x2="20"
          y2="7"
          stroke="var(--primary)"
          strokeWidth="4"
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          className="nexo-loader-line1"
        />
        <line
          x1="20"
          y1="20"
          x2="7.1"
          y2="27"
          stroke="var(--primary)"
          strokeWidth="4"
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          className="nexo-loader-line2"
        />
        <line
          x1="20"
          y1="20"
          x2="32.9"
          y2="27"
          stroke="var(--primary)"
          strokeWidth="4"
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          className="nexo-loader-line3"
        />
        <circle cx="20" cy="7" r="5" fill="var(--primary)" className="nexo-loader-node1" />
        <circle cx="7.1" cy="27" r="5" fill="var(--primary)" className="nexo-loader-node2" />
        <circle cx="32.9" cy="27" r="5" fill="var(--primary)" className="nexo-loader-node3" />
        <circle cx="20" cy="20" r="7" fill="var(--primary)" className="nexo-loader-center" />
      </svg>
      <div className="nexo-loader-word text-[15px] font-medium tracking-wide text-muted-foreground">
        {label}
      </div>
    </div>
  );
}
