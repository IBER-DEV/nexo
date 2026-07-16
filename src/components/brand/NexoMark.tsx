/**
 * Nexo isotipo: a central node with three connected branches — activity,
 * planning and team converging at one point. From the Nexo brand kit.
 */
export function NexoMark({
  className,
  color = "currentColor",
}: {
  className?: string;
  color?: string;
}) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none" aria-hidden="true">
      <line x1="20" y1="20" x2="20" y2="7" stroke={color} strokeWidth="4" strokeLinecap="round" />
      <line x1="20" y1="20" x2="7.1" y2="27" stroke={color} strokeWidth="4" strokeLinecap="round" />
      <line
        x1="20"
        y1="20"
        x2="32.9"
        y2="27"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="20" cy="7" r="5" fill={color} />
      <circle cx="7.1" cy="27" r="5" fill={color} />
      <circle cx="32.9" cy="27" r="5" fill={color} />
      <circle cx="20" cy="20" r="7" fill={color} />
    </svg>
  );
}
