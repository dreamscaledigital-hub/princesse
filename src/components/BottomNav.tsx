import { Link, useRouterState } from "@tanstack/react-router";
import { Gamepad2, Heart, MessageCircleHeart, User } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  {
    to: "/",
    icon: Gamepad2,
    label: "Jeux",
    match: (p: string) => p === "/",
  },
  {
    to: "/messages",
    icon: MessageCircleHeart,
    label: "Chat",
    match: (p: string) => p.startsWith("/messages"),
  },
  {
    to: "/pensees",
    icon: Heart,
    label: "Pensées",
    match: (p: string) => p.startsWith("/pensees"),
  },
  {
    to: "/profil",
    icon: User,
    label: "Profil",
    match: (p: string) => p.startsWith("/profil"),
  },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Masquer uniquement sur la page auth
  if (pathname === "/auth") return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-primary/10 bg-white/95 backdrop-blur-md"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-md">
        {TABS.map(({ to, icon: Icon, label, match }) => {
          const active = match(pathname);
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-3 text-[11px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground/60 hover:text-muted-foreground",
              )}
            >
              <Icon
                className={cn(
                  "h-[22px] w-[22px] transition-all duration-200",
                  active ? "scale-110 stroke-[2.2px]" : "stroke-[1.6px]",
                )}
              />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
