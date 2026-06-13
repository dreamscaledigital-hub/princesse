import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { LogOut, Pencil, Check, X, User } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/profil")({
  head: () => ({ meta: [{ title: "Profil — Princesse" }] }),
  component: ProfilPage,
});

type Profile = { id: string; display_name: string; avatar_emoji: string };

const EMOJIS = ["💕", "🌸", "🦋", "🌙", "⭐", "🌹", "🍀", "🐝", "🦊", "🐻"];

function ProfilPage() {
  const navigate = useNavigate();
  const [me, setMe]         = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving]   = useState(false);

  useEffect(() => { void load(); }, []);

  async function load() {
    const { data: ures } = await supabase.auth.getUser();
    if (!ures.user) { navigate({ to: "/auth", replace: true }); return; }
    const { data } = await supabase.from("profiles").select("*").eq("id", ures.user.id).maybeSingle();
    if (data) { setMe(data as Profile); setNewName((data as Profile).display_name); }
    setLoading(false);
  }

  async function saveName() {
    if (!me || !newName.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ display_name: newName.trim() }).eq("id", me.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setMe({ ...me, display_name: newName.trim() });
    setEditing(false);
    toast.success("Nom mis à jour 💕");
  }

  async function saveEmoji(emoji: string) {
    if (!me) return;
    await supabase.from("profiles").update({ avatar_emoji: emoji }).eq("id", me.id);
    setMe({ ...me, avatar_emoji: emoji });
  }

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">…</div>;

  return (
    <div className="mx-auto max-w-md px-5 pb-28 pt-6">
      <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mb-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/15">
          <User className="h-7 w-7 text-primary" />
        </div>
        <h1 className="mt-3 font-serif text-3xl text-primary">Mon profil</h1>
      </motion.div>

      {/* Carte profil */}
      <div className="rounded-3xl border border-primary/20 bg-white/70 p-5 shadow-sm backdrop-blur">
        {/* Avatar emoji */}
        <div className="mb-4 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-4xl">
            {me?.avatar_emoji || "💕"}
          </div>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {EMOJIS.map((e) => (
              <button key={e} onClick={() => saveEmoji(e)}
                className={`h-9 w-9 rounded-full text-xl transition active:scale-90 ${me?.avatar_emoji === e ? "bg-primary/20 ring-2 ring-primary" : "hover:bg-primary/10"}`}>
                {e}
              </button>
            ))}
          </div>
        </div>

        {/* Nom */}
        <div className="border-t border-primary/10 pt-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Ton prénom</p>
          {editing ? (
            <div className="mt-2 flex items-center gap-2">
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={30}
                className="h-10 rounded-xl" autoFocus onKeyDown={(e) => { if (e.key === "Enter") saveName(); }} />
              <button onClick={saveName} disabled={saving}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white transition active:scale-95">
                <Check className="h-4 w-4" />
              </button>
              <button onClick={() => { setEditing(false); setNewName(me?.display_name || ""); }}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-muted-foreground transition active:scale-95">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="mt-1 flex items-center justify-between">
              <p className="text-lg font-medium text-foreground">{me?.display_name}</p>
              <button onClick={() => setEditing(true)}
                className="flex items-center gap-1 text-xs text-primary/60 hover:text-primary">
                <Pencil className="h-3 w-3" /> Modifier
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Déconnexion */}
      <div className="mt-5">
        <Button onClick={logout} variant="outline"
          className="h-12 w-full rounded-2xl text-muted-foreground hover:text-red-500 hover:border-red-300">
          <LogOut className="mr-2 h-4 w-4" /> Se déconnecter
        </Button>
      </div>

      <p className="mt-8 text-center font-serif text-xl text-primary/40">Fait avec 💖</p>
    </div>
  );
}
