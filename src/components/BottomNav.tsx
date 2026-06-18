import { Link, useRouterState } from "@tanstack/react-router";
import { Gamepad2, Heart, MessageCircleHeart, User } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/",         icon: Gamepad2,           label: "Jeux",    match: (p: string) => p === "/" },
  { to: "/messages", icon: MessageCircleHeart,  label: "Chat",    match: (p: string) => p.startsWith("/messages") },
  { to: "/pensees",  icon: Heart,              label: "Pensées", match: (p: string) => p.startsWith("/pensees") },
  { to: "/profil",   icon: User,               label: "Profil",  match: (p: string) => p.startsWith("/profil") },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (pathname === "/auth" || pathname.startsWith("/messages")) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex justify-center"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 14px)", padding: "0 20px calc(env(safe-area-inset-bottom) + 14px)" }}
    >
      <motion.nav
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 22, delay: 0.1 }}
        className="relative flex items-center gap-1 px-1.5 py-1.5"
        style={{
          background: "rgba(255, 255, 255, 0.92)",
          backdropFilter: "blur(28px)",
          WebkitBackdropFilter: "blur(28px)",
          borderRadius: 32,
          border: "1px solid rgba(255, 255, 255, 0.85)",
          boxShadow:
            "0 8px 40px rgba(192, 80, 110, 0.16), 0 2px 12px rgba(192, 80, 110, 0.10), inset 0 1px 0 rgba(255, 255, 255, 1)",
        }}
      >
        {TABS.map(({ to, icon: Icon, label, match }) => {
          const active = match(pathname);
          return (
            <Link
              key={to}
              to={to}
              className="relative flex flex-col items-center justify-center gap-0.5 px-5 py-2 transition-all duration-300"
              style={{
                borderRadius: 24,
                minWidth: 64,
                ...(active
                  ? {
                      background: "linear-gradient(145deg, #e8829f 0%, #c04570 100%)",
                      boxShadow: "0 4px 18px rgba(192, 69, 112, 0.48), inset 0 1px 0 rgba(255,255,255,0.18)",
                    }
                  : {}),
              }}
            >
              <Icon
                style={{
                  width: 21,
                  height: 21,
                  ...(active
                    ? { color: "rgba(255,255,255,0.95)", strokeWidth: 2.2 }
                    : { color: "rgba(180, 90, 118, 0.55)", strokeWidth: 1.5 }),
                }}
              />
              <span
                style={{
                  fontSize: 10,
                  fontWeight: active ? 600 : 400,
                  letterSpacing: 0.2,
                  ...(active ? { color: "rgba(255,255,255,0.9)" } : { color: "rgba(180, 90, 118, 0.60)" }),
                }}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </motion.nav>
    </div>
  );
}
