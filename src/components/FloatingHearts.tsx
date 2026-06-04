import { useMemo } from "react";

const HEARTS = ["💕", "💖", "✨", "🌸", "💗", "⭐"];

export function FloatingHearts({ count = 12 }: { count?: number }) {
  const items = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        emoji: HEARTS[i % HEARTS.length],
        left: Math.random() * 100,
        delay: Math.random() * 12,
        duration: 10 + Math.random() * 12,
        size: 0.8 + Math.random() * 1.2,
        opacity: 0.15 + Math.random() * 0.25,
      })),
    [count],
  );

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      {items.map((h, i) => (
        <span
          key={i}
          className="floating-heart"
          style={{
            left: `${h.left}%`,
            animationDelay: `${h.delay}s`,
            animationDuration: `${h.duration}s`,
            fontSize: `${h.size}rem`,
            opacity: h.opacity,
          }}
        >
          {h.emoji}
        </span>
      ))}
    </div>
  );
}
