// Original Whispr brand mark — speech bubble dissolving into whisper dots.
export default function Logo({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-label="Whispr logo" role="img">
      <defs>
        <linearGradient id="whispr-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#A78BFA" />
          <stop offset="0.55" stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#F0ABFC" />
        </linearGradient>
      </defs>
      <path
        d="M32 6C17 6 6 17 6 30c0 7 3.4 13.3 8.8 17.4L12 58l11.4-4.2c2.7.9 5.6 1.4 8.6 1.4 15 0 26-11 26-24.2S47 6 32 6z"
        fill="url(#whispr-g)"
      />
      <circle cx="24" cy="29" r="3.4" fill="#fff" />
      <circle cx="34" cy="29" r="3.4" fill="#fff" opacity=".75" />
      <circle cx="44" cy="29" r="3.4" fill="#fff" opacity=".45" />
    </svg>
  );
}

export function Avatar({ name, color, size = 40, online, ring = false }) {
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className="w-full h-full rounded-full flex items-center justify-center font-bold text-white select-none"
        style={{
          background: `linear-gradient(135deg, ${color || "#8B5CF6"}, ${color || "#8B5CF6"}CC)`,
          fontSize: size * 0.42,
          boxShadow: ring ? "0 0 0 2px var(--bg-sidebar), 0 0 0 4px var(--violet)" : undefined,
        }}
        aria-hidden
      >
        {initial}
      </div>
      {online !== undefined && (
        <span
          className={`absolute bottom-0 right-0 rounded-full ${online ? "bg-success" : "bg-ink-3"}`}
          style={{
            width: Math.max(10, size * 0.28),
            height: Math.max(10, size * 0.28),
            border: "2.5px solid var(--bg-sidebar)",
            boxShadow: online ? "0 0 6px var(--success)" : undefined,
          }}
          aria-label={online ? "online" : "offline"}
        />
      )}
    </div>
  );
}
