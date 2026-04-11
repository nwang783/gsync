/**
 * PMAgentCompanion — cartoon face mascot with round glasses.
 * Ink-on-parchment style. Short dark hair, round wire-frame glasses,
 * expressive mouth/brow per mood.
 *
 * Moods: focused | celebrating | worried | nudging | idle
 */
export default function PMAgentCompanion({ mood = 'focused' }) {
  return (
    <svg
      viewBox="0 0 100 106"
      xmlns="http://www.w3.org/2000/svg"
      className={`pm-mascot pm-mascot--${mood}`}
      aria-label={`pm agent — ${mood}`}
      role="img"
    >
      {/* ─── Ears (behind hair and face) ─────────────────── */}
      <ellipse cx="14" cy="67" rx="7" ry="11" fill="#faf7f0" stroke="#3b2f1e" strokeWidth="2" />
      <ellipse cx="86" cy="67" rx="7" ry="11" fill="#faf7f0" stroke="#3b2f1e" strokeWidth="2" />
      {/* inner ear curve */}
      <path d="M12,61 C10,64 10,70 12,73" stroke="#3b2f1e" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <path d="M88,61 C90,64 90,70 88,73" stroke="#3b2f1e" strokeWidth="1.2" fill="none" strokeLinecap="round" />

      {/* ─── Hair / head silhouette (dark) ───────────────── */}
      <ellipse cx="50" cy="46" rx="38" ry="42" fill="#3b2f1e" />

      {/* ─── Face (cream oval, lower, covers bottom of hair) ─ */}
      <ellipse cx="50" cy="65" rx="33" ry="36" fill="#faf7f0" />
      <ellipse cx="50" cy="65" rx="33" ry="36" fill="none" stroke="#3b2f1e" strokeWidth="2.5" />

      {/* ─── Eyebrows ─────────────────────────────────────── */}
      {mood === 'worried' && (
        <>
          <path d="M27,50 L36,52.5" stroke="#3b2f1e" strokeWidth="2" strokeLinecap="round" />
          <path d="M64,52.5 L73,50" stroke="#3b2f1e" strokeWidth="2" strokeLinecap="round" />
        </>
      )}
      {mood !== 'worried' && (
        <>
          <path d="M27,51 Q34,48 40,51" stroke="#3b2f1e" strokeWidth="1.8" fill="none" strokeLinecap="round" />
          <path d="M60,51 Q67,48 73,51" stroke="#3b2f1e" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        </>
      )}

      {/* ─── Glasses frames ───────────────────────────────── */}
      <circle cx="36" cy="64" r="10.5" fill="#faf7f0" stroke="#3b2f1e" strokeWidth="2.2" />
      <circle cx="64" cy="64" r="10.5" fill="#faf7f0" stroke="#3b2f1e" strokeWidth="2.2" />
      {/* bridge */}
      <line x1="46.5" y1="64" x2="53.5" y2="64" stroke="#3b2f1e" strokeWidth="2" />
      {/* temple arms */}
      <path d="M25.5,61 C21,60 17,62 14.5,65" stroke="#3b2f1e" strokeWidth="2" fill="none" />
      <path d="M74.5,61 C79,60 83,62 85.5,65" stroke="#3b2f1e" strokeWidth="2" fill="none" />

      {/* ─── Eyes (mood-dependent) ────────────────────────── */}
      {mood === 'idle' && (
        /* droopy half-closed arcs */
        <>
          <path d="M29.5,63 Q36,70 42.5,63" stroke="#3b2f1e" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M57.5,63 Q64,70 70.5,63" stroke="#3b2f1e" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </>
      )}
      {mood === 'celebrating' && (
        /* happy squint — arcs opening upward */
        <>
          <path d="M29.5,66 Q36,59 42.5,66" stroke="#3b2f1e" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M57.5,66 Q64,59 70.5,66" stroke="#3b2f1e" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </>
      )}
      {(mood === 'focused' || mood === 'worried' || mood === 'nudging') && (
        /* standard round pupils */
        <>
          <circle cx="36" cy="64" r="5.5" fill="#3b2f1e" />
          <circle cx="37.5" cy="62.5" r="1.5" fill="white" />
          <circle cx="64" cy="64" r="5.5" fill="#3b2f1e" />
          <circle cx="65.5" cy="62.5" r="1.5" fill="white" />
        </>
      )}

      {/* ─── Nose ─────────────────────────────────────────── */}
      <path
        d="M47,75 C46,77.5 48.5,79.5 50,78.5 C51.5,79.5 54,77.5 53,75"
        stroke="#3b2f1e"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />

      {/* ─── Mouth (mood-dependent) ───────────────────────── */}
      {mood === 'celebrating' && (
        <path d="M36,87 Q50,102 64,87" stroke="#3b2f1e" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      )}
      {mood === 'worried' && (
        <path d="M37,92 Q50,84 63,92" stroke="#3b2f1e" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      )}
      {(mood === 'focused' || mood === 'idle') && (
        <path d="M40,88 Q50,96 60,88" stroke="#3b2f1e" strokeWidth="2" fill="none" strokeLinecap="round" />
      )}
      {mood === 'nudging' && (
        <path d="M38,88 Q46,98 63,85" stroke="#3b2f1e" strokeWidth="2" fill="none" strokeLinecap="round" />
      )}

      {/* ─── Mood extras ──────────────────────────────────── */}
      {mood === 'idle' && (
        <g fontFamily="DM Mono, Courier New, monospace" fill="#8a7d6b">
          <text x="70" y="18" fontSize="11" opacity="0.85">z</text>
          <text x="76" y="11" fontSize="9" opacity="0.55">z</text>
          <text x="81" y="5" fontSize="7" opacity="0.3">z</text>
        </g>
      )}
      {mood === 'worried' && (
        /* sweat drop */
        <path d="M73,15 Q76,9 79,15 Q79,21.5 76,23.5 Q73,21.5 73,15 Z" fill="#c0b49e" opacity="0.72" />
      )}
      {mood === 'celebrating' && (
        /* confetti dots */
        <g>
          <circle cx="5" cy="28" r="2.5" fill="#e85d26" />
          <circle cx="91" cy="18" r="2" fill="#e85d26" />
          <circle cx="95" cy="34" r="1.5" fill="#e85d26" />
          <circle cx="2" cy="44" r="2" fill="#3aab5c" />
          <circle cx="93" cy="26" r="2" fill="#3aab5c" />
          <path d="M12,14 L12,20 M9,17 L15,17" stroke="#e85d26" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M82,7 L82,11 M80,9 L84,9" stroke="#3aab5c" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
}
