const CIRCUMFERENCE = 2 * Math.PI * 32;

/** Anillo de carga relativa a la media del equipo. >100% (sobrecarga) se
 * pinta en el color de error en vez de primario. */
export function LoadRing({ name, pct }: { name: string; pct: number }) {
  const overload = pct > 100;
  const ratio = Math.min(pct, 100) / 100;
  const dashOffset = CIRCUMFERENCE * (1 - ratio);
  const color = overload ? "var(--destructive)" : "var(--primary)";

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="76" height="76" viewBox="0 0 76 76">
        <circle cx="38" cy="38" r="32" fill="none" stroke="var(--muted)" strokeWidth="7" />
        <circle
          cx="38"
          cy="38"
          r="32"
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          transform="rotate(-90 38 38)"
        />
        <text
          x="38"
          y="43"
          textAnchor="middle"
          fontFamily="'Space Grotesk', sans-serif"
          fontSize="15"
          fontWeight="700"
          fill="var(--foreground)"
        >
          {pct}%
        </text>
      </svg>
      <span className="text-xs font-medium text-muted-foreground truncate max-w-[76px]">
        {name}
      </span>
    </div>
  );
}
