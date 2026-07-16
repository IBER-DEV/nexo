/**
 * 404 mascot: a small lost robot with a dim Nexo mark on its chest, eyes
 * looking in different directions, and a blinking antenna. From the Nexo
 * 404 brand kit — kept as a fixed-palette illustration (not theme-reactive)
 * since its own internal contrast (dark eyes on a white head) has to hold
 * regardless of the app's light/dark mode.
 */
export function NexoRobot({ className }: { className?: string }) {
  return (
    <svg
      width="220"
      height="220"
      viewBox="0 0 220 220"
      className={`nexo-404-float-robot ${className ?? ""}`}
    >
      <ellipse cx="110" cy="196" rx="46" ry="8" fill="#E1E6E9" />

      {/* legs */}
      <rect x="88" y="150" width="12" height="30" rx="6" fill="#C9D1D6" />
      <rect x="120" y="150" width="12" height="30" rx="6" fill="#C9D1D6" />

      {/* body */}
      <rect
        x="66"
        y="86"
        width="88"
        height="72"
        rx="18"
        fill="#FFFFFF"
        stroke="#E1E6E9"
        strokeWidth="3"
      />

      {/* chest node (nexo mark, dim) */}
      <g transform="translate(110,124)" opacity="0.9">
        <line x1="0" y1="0" x2="0" y2="-9" stroke="#29AFF5" strokeWidth="3" strokeLinecap="round" />
        <line x1="0" y1="0" x2="-8" y2="6" stroke="#29AFF5" strokeWidth="3" strokeLinecap="round" />
        <line x1="0" y1="0" x2="8" y2="6" stroke="#29AFF5" strokeWidth="3" strokeLinecap="round" />
        <circle cx="0" cy="-9" r="3.4" fill="#29AFF5" />
        <circle cx="-8" cy="6" r="3.4" fill="#29AFF5" />
        <circle cx="8" cy="6" r="3.4" fill="#29AFF5" />
        <circle cx="0" cy="0" r="4.6" fill="#29AFF5" />
      </g>

      {/* arms */}
      <rect
        x="50"
        y="96"
        width="16"
        height="10"
        rx="5"
        fill="#C9D1D6"
        transform="rotate(-18 58 101)"
      />
      <rect
        x="154"
        y="96"
        width="16"
        height="10"
        rx="5"
        fill="#C9D1D6"
        transform="rotate(18 162 101)"
      />

      {/* antenna */}
      <line
        x1="110"
        y1="56"
        x2="110"
        y2="70"
        stroke="#A3AEB6"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="110" cy="52" r="5" fill="#29AFF5" className="nexo-404-scan-dot" />

      {/* head */}
      <rect
        x="78"
        y="56"
        width="64"
        height="46"
        rx="16"
        fill="#FFFFFF"
        stroke="#E1E6E9"
        strokeWidth="3"
      />
      {/* eyes: one looking left, one looking right -> lost/confused */}
      <circle cx="98" cy="79" r="7" fill="#445159" />
      <circle cx="95.5" cy="77" r="2.2" fill="#FFFFFF" />
      <circle cx="122" cy="79" r="7" fill="#445159" />
      <circle cx="125.5" cy="76.5" r="2.2" fill="#FFFFFF" />
      {/* confused mouth */}
      <path
        d="M100 92 Q110 86 120 92"
        stroke="#445159"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />

      {/* floating question marks */}
      <text
        x="30"
        y="70"
        fontFamily="'Space Grotesk',sans-serif"
        fontSize="22"
        fontWeight="700"
        fill="#8C5CF2"
        opacity="0.5"
        className="nexo-404-float-q1"
      >
        ?
      </text>
      <text
        x="176"
        y="52"
        fontFamily="'Space Grotesk',sans-serif"
        fontSize="16"
        fontWeight="700"
        fill="#29AFF5"
        opacity="0.5"
        className="nexo-404-float-q2"
      >
        ?
      </text>
    </svg>
  );
}
