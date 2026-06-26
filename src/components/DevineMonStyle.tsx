import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Check, Crown, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// ── Types ─────────────────────────────────────────────────────────────────
interface PoolItem { url: string; label: string; }
type CatId = "robes" | "chaussures" | "voitures" | "deco" | "destinations";
type Phase = "category" | "picking" | "waiting_pick" | "guessing" | "waiting_guess" | "reveal";
type RevealStatus = "correct" | "missed" | "wrong" | "neutral";

// ── Seeded PRNG ────────────────────────────────────────────────────────────
function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pickItems(pool: readonly PoolItem[], seed: number, n = 8): PoolItem[] {
  const rand = mulberry32(seed);
  const arr = [...pool];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, n);
}

// ── Image builder ──────────────────────────────────────────────────────────
const U = (id: string, label: string): PoolItem => ({
  url: `https://images.unsplash.com/photo-${id}?w=600&h=600&fit=crop&q=80&auto=format`,
  label,
});

// ── Categories ─────────────────────────────────────────────────────────────
const CATEGORIES = [
  {
    id: "robes" as CatId, label: "Robes & Mode", emoji: "👗",
    color: "#ec4899", glow: "rgba(236,72,153,0.5)",
    desc: "Mode, tendances, looks du moment",
    pool: [
      U("1515886657613-9f3515b0c78f","Robe bohème fleurie"),
      U("1483985988355-763728e1802b","Look shopping chic"),
      U("1496747611176-843222e1e57c","Robe midi colorée"),
      U("1539109136881-3be0616acf4b","Tenue street fashion"),
      U("1469334031218-e382a71b716b","Ensemble élégant"),
      U("1490481651871-ab68de25d43d","Robe pastel douce"),
      U("1487222477894-8943e31ef7b2","Look casual chic"),
      U("1509631179647-0177331693ae","Robe de cocktail"),
      U("1519751138087-5bf79df62d5b","Tenue romantique"),
      U("1503342217505-b0a15ec3261c","Style minimaliste"),
      U("1434389677669-e08b4cac3105","Look bohème chic"),
      U("1518611012118-696072aa579a","Robe de soirée"),
      U("1566174053879-31528523f8ae","Combinaison luxe"),
      U("1558618666-fcd25c85cd64","Mode colorée"),
      U("1525507069-f58f46f2b6ee","Tenue décontractée"),
      U("1571786366434-4d4f5e0c0af5","Style urbain"),
      U("1572635196237-14b3f281503f","Robe asymétrique"),
      U("1581044777550-4cfa2d8f5e8f","Look festival"),
      U("1580587771525-4e54b4c29ce3","Ensemble printanier"),
      U("1546961342-ea5f62d7c2a7","Robe dos nu"),
      U("1550614036-1a8a3a7e64e3","Style vintage"),
      U("1603302576837-37561b2e2302","Look tendance"),
      U("1600585154340-be6161a56a0c","Robe café au lait"),
      U("1529635266994-2c8b5b5c3c7a","Mode automne"),
    ] as const,
  },
  {
    id: "chaussures" as CatId, label: "Chaussures", emoji: "👠",
    color: "#a855f7", glow: "rgba(168,85,247,0.5)",
    desc: "Sneakers, talons, boots et plus",
    pool: [
      U("1542291026-7eec264c27ff","Baskets Nike rouges"),
      U("1460353581641-37baddab0fa2","Chaussures colorées"),
      U("1491553895911-0055eca6402d","Running shoes"),
      U("1525966222134-fcfa99b8ae77","Sneakers blanches"),
      U("1543163521-1bf539c55dd2","Collection variée"),
      U("1518894781321-630e638d0742","Escarpins noirs"),
      U("1512374382149-233c42b6a83b","Baskets colorblock"),
      U("1584735175315-9d5df23be4a1","Sandales élégantes"),
      U("1600269452121-4f2416e55c28","Sneakers luxe"),
      U("1568702846914-96b305d2aaeb","Bottes en cuir"),
      U("1606107557195-0e29a4b5b4aa","Baskets streetwear"),
      U("1595950653106-bdbce3a45d9b","Mules tendance"),
      U("1514590734846-e7f67677dd7e","Chaussures de ville"),
      U("1547036967-23d11aacaee0","Boots rangers"),
      U("1563861826100-9cb868fdbe1c","Platforms chunky"),
      U("1560769629-975ec94e6a86","Baskets rétro"),
      U("1511556820780-d912e42b4980","Talons aiguilles"),
      U("1585386959984-a4155224a1ad","Loafers chic"),
      U("1539519942-9c11f6f34e53","Mocassins classiques"),
      U("1520219370-b1dc03d9a5d5","Sandales gladiator"),
      U("1578116963-0ad3af3d3f3e","Baskets mode"),
      U("1618260788-0cd7a9aea6f5","Sneakers blanc pur"),
      U("1630874058717-dc5d85e8fecd","Running coloré"),
      U("1651407479093-f6b58f8bf8f8","Chaussures sport"),
    ] as const,
  },
  {
    id: "voitures" as CatId, label: "Voitures", emoji: "🚗",
    color: "#ef4444", glow: "rgba(239,68,68,0.5)",
    desc: "Sportives, luxe, classiques et SUV",
    pool: [
      U("1492144534655-ae79c964c9d7","Supercar blanche"),
      U("1544636331-e26879cd4d9b","Lamborghini jaune"),
      U("1503736334956-4c8f8e4dc391","Voiture classique"),
      U("1552519507-da3b142c6e3d","Muscle car américaine"),
      U("1525609004556-c46c7d6cf023","Ferrari rouge"),
      U("1583121274602-3e2820c69888","Supercar moderne"),
      U("1580273916550-e323be2ae537","Porsche élégante"),
      U("1542362567-b07e54358753","Coupé sport nocturne"),
      U("1511919884226-fd3cad34687c","Sportive en mouvement"),
      U("1502877338535-766e1452684a","Route et paysage"),
      U("1493238792000-8113da705763","BMW sportive"),
      U("1519245659620-e859806a8d3b","Roadster décapotable"),
      U("1449965408869-eaa3f722e40d","Route ouverte"),
      U("1520340974578-0e7ffa4de31d","Berline luxe"),
      U("1547189885-68e8e29d7c02","SUV premium"),
      U("1590362891991-f776e747a588","Hypercar"),
      U("1603386311-f1b37a28d9c5","GT coupé"),
      U("1554744296-6ed18cf8cac9","Sportive de nuit"),
      U("1589408820082-24e8b57b2d76","Voiture de course"),
      U("1604054923956-1cb3ef7414b7","Concept car"),
      U("1621274590947-2e31cc2b53f7","EV moderne"),
      U("1485291571150-772bcfc10da5","Cabriolet plage"),
      U("1616422036-1af5d56e1e2f","Sedan premium"),
      U("1563720223-b9d47f5b8ac5","Sport nocturne"),
    ] as const,
  },
  {
    id: "deco" as CatId, label: "Déco & Maison", emoji: "🏠",
    color: "#10b981", glow: "rgba(16,185,129,0.5)",
    desc: "Intérieurs, mobilier et ambiances",
    pool: [
      U("1555041469-a586c61ea9bc","Canapé gris minimaliste"),
      U("1586023492125-27b2c045efd7","Salon moderne"),
      U("1567016432779-094069958ea5","Chambre nordique"),
      U("1484101403633-562f891dc89a","Chambre cosy"),
      U("1600210492486-724fe5c67fb3","Cuisine design"),
      U("1560185007-cde436f6a4d0","Table de repas"),
      U("1524758631624-e2822e304c36","Chambre lumineuse"),
      U("1556228453-efd6c1ff04f6","Salon chaleureux"),
      U("1600607687939-ce8a6c25118c","Salon épuré"),
      U("1618221195710-dd6b41faaea6","Décor bohème"),
      U("1598928506311-c55ded91a20c","Salle de bain luxe"),
      U("1507089947368-19c1da9775ae","Espace minimaliste"),
      U("1505409628601-edc9af17fda6","Bureau design"),
      U("1493809950229-ab1a6e9ac77e","Hall d'entrée"),
      U("1538127520272-d93702a19867","Coin lecture"),
      U("1565182999561-18d7dc61c393","Terrasse extérieure"),
      U("1502005229762-fd26c6e55e5c","Pièce industrielle"),
      U("1617104678098-de229db51b7c","Appart haussmannien"),
      U("1615873968403-89fff8b8c1a4","Loft design"),
      U("1616046386961-3ca14a2d2c67","Studio moderne"),
      U("1618160702438-9b02ab6515c9","Cuisine ouverte"),
      U("1564078516393-cf04bd966897","Salle à manger"),
      U("1631679706909-1844bbd0223b","Chambre hôtel luxe"),
      U("1449824913935-59a10b8d2000","Table basse design"),
    ] as const,
  },
  {
    id: "destinations" as CatId, label: "Destinations", emoji: "✈️",
    color: "#0ea5e9", glow: "rgba(14,165,233,0.5)",
    desc: "Plages, villes, montagne et aventure",
    pool: [
      U("1506905925346-21bda4d32df4","Alpes majestueuses"),
      U("1499856871958-5b9627545d1a","Paris Tour Eiffel"),
      U("1476514525535-07fb3b4ae5f1","Plage tropicale"),
      U("1507525428034-b723cf961d3e","Plage paradisiaque"),
      U("1523906834658-6e24ef2386f9","Bryce Canyon"),
      U("1469854523086-cc02fe5d8800","Skyline urbain"),
      U("1528360983277-13d401cdc186","Lagon turquoise"),
      U("1581351721010-8cf859cb14a4","Dunes de sable"),
      U("1491555103944-7c647fd857e6","Tokyo de nuit"),
      U("1530521954074-e64f4810b5ad","Coucher de soleil"),
      U("1534430480872-3498386e7856","Lac de montagne"),
      U("1552465011-b4e21bf6e79a","Santorini Grèce"),
      U("1473496169904-658ba7574f0a","Fjord Norvège"),
      U("1512453979798-5ea266f8880c","Dubai moderne"),
      U("1539037116277-4db20889f2d4","Toscane italienne"),
      U("1568454537842-d933259bb258","Forêt enchantée"),
      U("1580541631950-7282082b53a7","Météores Grèce"),
      U("1548574505-7cce1a7e7a72","New York City"),
      U("1519302959554-a75be0afc578","Mongolie steppe"),
      U("1502635385003-6702a3197638","Maldives bungalow"),
      U("1532274402911-5a369e4c4bb5","Bali rizières"),
      U("1614094082869-cd4e4b2905c7","Kyoto automne"),
      U("1501785888041-af3ef285b470","Route panoramique"),
      U("1552832230-c0197dd311b5","Village coloré"),
    ] as const,
  },
] as const;

function scoreMsg(n: number) {
  if (n === 3) return { text: "Parfait ! Tu le connais par cœur 🔥", color: "#f59e0b" };
  if (n === 2) return { text: "Bien joué ! Presque parfait 💕", color: "#10b981" };
  if (n === 1) return { text: "Pas mal… encore un effort 🌱", color: "#0ea5e9" };
  return { text: "Aïe ! Encore à découvrir 😅", color: "#f43f5e" };
}

function extractPayload<T>(msg: unknown): T {
  const raw = (msg ?? {}) as Record<string, unknown>;
  return (raw["payload"] ?? raw) as T;
}

// ── ImageCell ──────────────────────────────────────────────────────────────
// KEY: uses aspectRatio:"1" on the wrapper so height is ALWAYS defined.
// All inner content uses position:absolute inset:0 to fill reliably.
function ImageCell({
  item, catEmoji, catColor, catGlow,
  selected, locked, revealStatus, onClick,
}: {
  item: PoolItem; catEmoji: string; catColor: string; catGlow: string;
  selected: boolean; locked: boolean;
  revealStatus?: RevealStatus;
  onClick?: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const border =
    revealStatus === "correct" ? "2.5px solid #10b981"
    : revealStatus === "missed" ? "2.5px solid #f59e0b"
    : revealStatus === "wrong"  ? "2px solid #ef4444"
    : selected                   ? `2.5px solid ${catColor}`
    : "2px solid rgba(255,255,255,0.09)";

  const shadow =
    revealStatus === "correct" ? "0 0 16px rgba(16,185,129,0.55)"
    : revealStatus === "missed" ? "0 0 10px rgba(245,158,11,0.45)"
    : selected                   ? `0 0 18px ${catGlow}`
    : "none";

  return (
    <motion.div
      whileTap={onClick && !locked ? { scale: 0.90 } : {}}
      onClick={locked ? undefined : onClick}
      style={{
        aspectRatio: "1",           /* ← gives the cell a definite height */
        position: "relative",
        borderRadius: 12,
        overflow: "hidden",
        border, boxShadow: shadow,
        cursor: onClick && !locked ? "pointer" : "default",
        background: `${catColor}10`,
        transition: "border 0.15s, box-shadow 0.15s",
      }}
    >
      {/* Shimmer skeleton */}
      {!loaded && (
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(90deg,rgba(255,255,255,0.04) 0%,rgba(255,255,255,0.11) 50%,rgba(255,255,255,0.04) 100%)",
          backgroundSize: "200% 100%",
          animation: "ds-shimmer 1.4s ease-in-out infinite",
        }}/>
      )}

      {/* Photo — position absolute so it fills the aspect-ratio square */}
      {!failed && (
        <img
          src={item.url}
          alt={item.label}
          onLoad={() => setLoaded(true)}
          onError={() => { setFailed(true); setLoaded(true); }}
          style={{
            position: "absolute", inset: 0,
            width: "100%", height: "100%",
            objectFit: "cover", display: "block",
            opacity: loaded ? 1 : 0,
            transition: "opacity 0.3s ease",
          }}
        />
      )}

      {/* Fallback gradient card — always visible when image 404s */}
      {failed && (
        <div style={{
          position: "absolute", inset: 0,
          background: `linear-gradient(145deg, ${catColor}28, ${catColor}06)`,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: "8px 6px",
        }}>
          <span style={{ fontSize: 26, lineHeight: 1 }}>{catEmoji}</span>
          <p style={{
            margin: "5px 0 0", fontSize: 10, fontWeight: 700,
            color: catColor, textAlign: "center", lineHeight: 1.3,
          }}>{item.label}</p>
        </div>
      )}

      {/* Locked dimming */}
      {locked && !selected && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.48)" }}/>
      )}

      {/* Reveal overlays */}
      {revealStatus === "correct" && (
        <div style={{ position:"absolute", inset:0, background:"rgba(16,185,129,0.22)",
          display:"flex", alignItems:"center", justifyContent:"center" }}>
          <span style={{ fontSize:22 }}>✅</span>
        </div>
      )}
      {revealStatus === "missed" && (
        <div style={{ position:"absolute", inset:0, background:"rgba(245,158,11,0.22)",
          display:"flex", alignItems:"center", justifyContent:"center" }}>
          <span style={{ fontSize:22 }}>💛</span>
        </div>
      )}
      {revealStatus === "wrong" && (
        <div style={{ position:"absolute", inset:0, background:"rgba(239,68,68,0.22)",
          display:"flex", alignItems:"center", justifyContent:"center" }}>
          <span style={{ fontSize:22 }}>❌</span>
        </div>
      )}
      {revealStatus === "neutral" && (
        <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.55)" }}/>
      )}

      {/* Selected checkmark */}
      {selected && (
        <div style={{
          position:"absolute", inset:0, background:"rgba(0,0,0,0.26)",
          display:"flex", alignItems:"center", justifyContent:"center",
        }}>
          <div style={{
            background: catColor, borderRadius: "50%",
            width: 30, height: 30,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 0 12px ${catGlow}`,
          }}>
            <Check size={16} color="white" strokeWidth={3}/>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ── Dot counter ────────────────────────────────────────────────────────────
function Dots({ count, color }: { count: number; color: string }) {
  return (
    <div style={{ display:"flex", gap:5 }}>
      {[0,1,2].map(i => (
        <motion.div key={i}
          animate={i < count ? { scale:[1,1.25,1] } : {}}
          transition={{ duration:0.25 }}
          style={{
            width:18, height:18, borderRadius:5,
            border:`2px solid ${color}`,
            background: i < count ? color : "transparent",
            transition:"background 0.18s",
          }}/>
      ))}
    </div>
  );
}

// ── Props ──────────────────────────────────────────────────────────────────
interface Props {
  player1: string; player2: string;
  mySlot: 1|2; coupleId: string;
  onBack: () => void;
}

// ── Component ──────────────────────────────────────────────────────────────
export function DevineMonStyle({ player1, player2, mySlot, coupleId, onBack }: Props) {
  const [phase, setPhase]           = useState<Phase>("category");
  const [picker, setPicker]         = useState<1|2>(1);
  const [catId, setCatId]           = useState<CatId|"">("");
  const [items, setItems]           = useState<PoolItem[]>([]);
  const [mySelections, setMySel]    = useState<number[]>([]);
  const [pickerPicks, setPP]        = useState<number[]>([]);
  const [guesserGuess, setGG]       = useState<number[]>([]);
  const [scores, setScores]         = useState<[number,number]>([0,0]);
  const [roundScore, setRS]         = useState(0);
  const [connected, setConnected]   = useState(false);
  const [confirming, setConfirming] = useState(false);
  const chRef = useRef<ReturnType<typeof supabase.channel>|null>(null);

  const cat         = CATEGORIES.find(c => c.id === catId) ?? null;
  const isPicker    = picker === mySlot;
  const guesserSlot: 1|2 = picker === 1 ? 2 : 1;
  const pName = (picker===1 ? player1 : player2).split(" ")[0];
  const gName = (picker===1 ? player2 : player1).split(" ")[0];
  const mName = (mySlot===1 ? player1 : player2).split(" ")[0];

  useEffect(() => { setConfirming(false); }, [phase]);

  // ── Channel ────────────────────────────────────────────────────────────
  useEffect(() => {
    const ch = supabase.channel(`ds2:${coupleId}`, { config:{ broadcast:{ self:false } } });
    ch
      .on("broadcast", { event:"round_start" }, msg => {
        const p = extractPayload<{ catId:CatId; seed:number }>(msg);
        const found = CATEGORIES.find(c => c.id === p.catId);
        if (!found) return;
        setItems(pickItems(found.pool, p.seed));
        setCatId(p.catId);
        setMySel([]); setPP([]); setGG([]);
        setPhase("waiting_pick");
      })
      .on("broadcast", { event:"picks_done" }, msg => {
        const p = extractPayload<{ picks:number[] }>(msg);
        setPP(p.picks); setMySel([]);
        setPhase("guessing");
      })
      .on("broadcast", { event:"guess_done" }, msg => {
        const p = extractPayload<{ guesses:number[]; gs:1|2 }>(msg);
        setGG(p.guesses);
        setPP(prev => {
          const n = prev.filter(i => p.guesses.includes(i)).length;
          setRS(n);
          setScores(s => { const a:[number,number]=[...s]; a[p.gs-1]+=n; return a; });
          return prev;
        });
        setPhase("reveal");
      })
      .on("broadcast", { event:"next_round" }, msg => {
        const p = extractPayload<{ np:1|2 }>(msg);
        setPicker(p.np);
        setPhase("category"); setItems([]); setCatId(""); setMySel([]); setPP([]); setGG([]);
      })
      .on("broadcast", { event:"restart" }, () => {
        setPicker(1);
        setPhase("category"); setItems([]); setCatId(""); setMySel([]); setPP([]); setGG([]); setScores([0,0]);
      })
      .subscribe(s => setConnected(s==="SUBSCRIBED"));
    chRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [coupleId]);

  // ── Actions ────────────────────────────────────────────────────────────
  function startRound(cId: CatId) {
    const seed = Math.floor(Math.random() * 999983);
    const found = CATEGORIES.find(c => c.id === cId)!;
    chRef.current?.send({ type:"broadcast", event:"round_start", payload:{ catId:cId, seed } });
    setItems(pickItems(found.pool, seed));
    setCatId(cId); setMySel([]); setPP([]); setGG([]);
    setPhase("picking");
  }
  function confirmPicks() {
    if (confirming || mySelections.length < 3) return;
    setConfirming(true);
    chRef.current?.send({ type:"broadcast", event:"picks_done", payload:{ picks:mySelections } });
    setPP(mySelections); setMySel([]);
    setPhase("waiting_guess");
  }
  function confirmGuess() {
    if (confirming || mySelections.length < 3) return;
    setConfirming(true);
    chRef.current?.send({ type:"broadcast", event:"guess_done",
      payload:{ guesses:mySelections, gs:guesserSlot } });
    const n = pickerPicks.filter(i => mySelections.includes(i)).length;
    setGG(mySelections); setRS(n);
    setScores(s => { const a:[number,number]=[...s]; a[guesserSlot-1]+=n; return a; });
    setPhase("reveal");
  }
  function nextRound() {
    if (confirming) return; setConfirming(true);
    const np:1|2 = picker===1 ? 2 : 1;
    chRef.current?.send({ type:"broadcast", event:"next_round", payload:{ np } });
    setPicker(np);
    setPhase("category"); setItems([]); setCatId(""); setMySel([]); setPP([]); setGG([]);
  }
  function restart() {
    if (confirming) return; setConfirming(true);
    chRef.current?.send({ type:"broadcast", event:"restart", payload:{} });
    setPicker(1);
    setPhase("category"); setItems([]); setCatId(""); setMySel([]); setPP([]); setGG([]); setScores([0,0]);
  }
  function toggle(idx: number) {
    setMySel(prev => prev.includes(idx) ? prev.filter(i=>i!==idx) : prev.length<3 ? [...prev,idx] : prev);
  }

  // ── Shared confirm button ──────────────────────────────────────────────
  function ConfirmBtn({ onPress, isGuess=false }: { onPress:()=>void; isGuess?:boolean }) {
    const ac = isGuess ? "#a855f7" : (cat?.color ?? "#ec4899");
    const ag = isGuess ? "rgba(168,85,247,0.5)" : (cat?.glow ?? "rgba(236,72,153,0.5)");
    const ac2 = isGuess ? "#ec4899" : "#a855f7";
    const ready = mySelections.length === 3 && !confirming;
    return (
      <motion.button
        onClick={onPress}
        disabled={!ready}
        animate={ready ? { scale:[1,1.025,1] } : {}}
        transition={{ duration:0.9, repeat: ready ? Infinity : 0 }}
        style={{
          margin:"10px 0 calc(env(safe-area-inset-bottom) + 8px)",
          padding:"16px 24px", borderRadius:999, border:"none",
          flexShrink:0, width:"100%",
          cursor: ready ? "pointer" : "default",
          background: ready ? `linear-gradient(135deg,${ac},${ac2})` : "rgba(255,255,255,0.07)",
          color: ready ? "white" : "rgba(255,255,255,0.25)",
          fontSize:15, fontWeight:800,
          boxShadow: ready ? `0 6px 24px ${ag}` : "none",
          transition:"all 0.3s ease",
        }}>
        {confirming
          ? "Envoi…"
          : mySelections.length < 3
            ? `${3 - mySelections.length} de plus à choisir`
            : isGuess ? "✓ Soumettre mes devinettes" : "✓ Valider mes choix"}
      </motion.button>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div style={{
      height:"100dvh", background:"#0b0114",
      display:"flex", flexDirection:"column",
      overflow:"hidden", position:"relative",
    }}>

      <style>{`@keyframes ds-shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}`}</style>

      {/* Orbs */}
      {cat && <>
        <div style={{ position:"absolute", top:"-15%", left:"-10%", width:220, height:220, borderRadius:"50%",
          background:`radial-gradient(circle,${cat.glow} 0%,transparent 70%)`, filter:"blur(55px)", pointerEvents:"none" }}/>
        <div style={{ position:"absolute", bottom:"-15%", right:"-10%", width:200, height:200, borderRadius:"50%",
          background:`radial-gradient(circle,${cat.glow} 0%,transparent 70%)`, filter:"blur(55px)", pointerEvents:"none" }}/>
      </>}

      {/* HEADER */}
      <div style={{
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"calc(env(safe-area-inset-top) + 10px) 14px 10px",
        borderBottom:"1px solid rgba(255,255,255,0.06)",
        flexShrink:0, zIndex:10, position:"relative",
      }}>
        <button onClick={onBack} style={{
          background:"rgba(255,255,255,0.08)", border:"none", borderRadius:12,
          width:36, height:36, display:"flex", alignItems:"center",
          justifyContent:"center", cursor:"pointer", flexShrink:0,
        }}>
          <ArrowLeft size={18} color="white"/>
        </button>
        <div style={{ flex:1, textAlign:"center", padding:"0 8px" }}>
          <p style={{ margin:0, fontSize:10, fontWeight:700, letterSpacing:2,
            color:"rgba(255,255,255,0.28)", textTransform:"uppercase" }}>Devine mon Style</p>
          {cat
            ? <p style={{ margin:0, fontSize:14, color:cat.color, fontWeight:800 }}>{cat.emoji} {cat.label}</p>
            : <p style={{ margin:0, fontSize:12, color:"rgba(255,255,255,0.4)" }}>Choisir une catégorie</p>}
        </div>
        <div style={{ display:"flex", gap:12, flexShrink:0 }}>
          {([1,2] as const).map(slot => (
            <div key={slot} style={{ textAlign:"center", opacity: picker===slot?1:0.38, transition:"opacity 0.3s" }}>
              <p style={{ margin:0, fontSize:17, fontWeight:900, color:"white", lineHeight:1 }}>{scores[slot-1]}</p>
              <p style={{ margin:0, fontSize:9, color:"rgba(255,255,255,0.38)", lineHeight:1, marginTop:1 }}>
                {(slot===1?player1:player2).split(" ")[0]}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* SCREENS */}
      <AnimatePresence mode="wait">

        {/* ── CATEGORY ─────────────────────────────────────────────────── */}
        {phase==="category" && (
          <motion.div key="cat"
            initial={{opacity:0,y:18}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-18}}
            style={{ flex:1, overflowY:"auto", padding:"18px 14px", zIndex:1, position:"relative" }}>
            {isPicker ? (
              <>
                <p style={{ textAlign:"center", color:"white", fontSize:17, fontWeight:800, marginBottom:4 }}>
                  C'est ton tour, {mName} 🎯
                </p>
                <p style={{ textAlign:"center", color:"rgba(255,255,255,0.38)", fontSize:12, marginBottom:20 }}>
                  {gName} devra deviner tes 3 préférés
                </p>
                <div style={{ display:"flex", flexDirection:"column", gap:10, maxWidth:440, margin:"0 auto",
                  paddingBottom:"env(safe-area-inset-bottom)" }}>
                  {CATEGORIES.map((c,i) => (
                    <motion.button key={c.id}
                      initial={{opacity:0,x:-14}} animate={{opacity:1,x:0}} transition={{delay:i*0.055}}
                      whileTap={{scale:0.97}} onClick={()=>startRound(c.id)}
                      style={{
                        display:"flex", alignItems:"center", gap:14,
                        background:"rgba(255,255,255,0.05)", border:`1px solid ${c.color}35`,
                        borderRadius:18, padding:"15px 18px", cursor:"pointer", textAlign:"left",
                        boxShadow:`0 4px 22px ${c.color}10`,
                      }}>
                      <span style={{ fontSize:30, lineHeight:1, flexShrink:0 }}>{c.emoji}</span>
                      <div style={{ flex:1 }}>
                        <p style={{ margin:0, fontSize:15, fontWeight:800, color:"white" }}>{c.label}</p>
                        <p style={{ margin:0, fontSize:11, color:"rgba(255,255,255,0.35)", marginTop:2 }}>{c.desc}</p>
                      </div>
                      <span style={{ color:c.color, fontSize:18, flexShrink:0 }}>›</span>
                    </motion.button>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"60vh" }}>
                <motion.div animate={{scale:[1,1.1,1]}} transition={{duration:2,repeat:Infinity}}>
                  <span style={{fontSize:58}}>🎯</span>
                </motion.div>
                <p style={{color:"white",fontSize:18,fontWeight:800,marginTop:20,textAlign:"center"}}>
                  {pName} choisit la catégorie…
                </p>
                <p style={{color:"rgba(255,255,255,0.38)",fontSize:13,marginTop:8,textAlign:"center"}}>
                  Prépare-toi à deviner ses goûts !
                </p>
              </div>
            )}
          </motion.div>
        )}

        {/* ── PICKING ──────────────────────────────────────────────────── */}
        {phase==="picking" && cat && (
          <motion.div key="pick"
            initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            style={{ flex:1, display:"flex", flexDirection:"column", padding:"10px 12px 0",
              overflow:"hidden", zIndex:1, position:"relative" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8, flexShrink:0 }}>
              <p style={{ margin:0, color:"rgba(255,255,255,0.9)", fontSize:14, fontWeight:700 }}>
                Tes 3 préférés ❤️
              </p>
              <Dots count={mySelections.length} color={cat.color}/>
            </div>
            {/* Grid in scrollable area */}
            <div style={{ flex:1, overflowY:"auto", WebkitOverflowScrolling:"touch" as never }}>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:8 }}>
                {items.map((item,i) => (
                  <ImageCell key={i} item={item}
                    catEmoji={cat.emoji} catColor={cat.color} catGlow={cat.glow}
                    selected={mySelections.includes(i)}
                    locked={mySelections.length>=3 && !mySelections.includes(i)}
                    onClick={()=>toggle(i)}/>
                ))}
              </div>
            </div>
            <ConfirmBtn onPress={confirmPicks}/>
          </motion.div>
        )}

        {/* ── WAITING ──────────────────────────────────────────────────── */}
        {(phase==="waiting_pick"||phase==="waiting_guess") && cat && (
          <motion.div key="wait"
            initial={{opacity:0,scale:0.96}} animate={{opacity:1,scale:1}} exit={{opacity:0}}
            style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center",
              justifyContent:"center", padding:"24px 20px", zIndex:1, position:"relative" }}>
            <motion.div
              animate={{rotate:[0,12,-12,0],scale:[1,1.07,1]}}
              transition={{duration:2.8,repeat:Infinity,ease:"easeInOut"}}>
              <span style={{fontSize:62}}>{cat.emoji}</span>
            </motion.div>
            <p style={{color:"white",fontSize:19,fontWeight:800,marginTop:22,textAlign:"center"}}>
              {phase==="waiting_pick"
                ? `${pName} choisit ses préférés…`
                : `${gName} est en train de deviner…`}
            </p>
            <p style={{color:"rgba(255,255,255,0.38)",fontSize:13,marginTop:8,textAlign:"center"}}>
              {phase==="waiting_pick" ? "Patiente, ça arrive vite !" : "Suspense total…"}
            </p>
            <div style={{display:"flex",gap:8,marginTop:18}}>
              {[0,1,2].map(i=>(
                <motion.div key={i}
                  animate={{scale:[1,1.5,1],opacity:[0.35,1,0.35]}}
                  transition={{duration:1.1,delay:i*0.18,repeat:Infinity}}
                  style={{width:8,height:8,borderRadius:"50%",background:cat.color}}/>
              ))}
            </div>
            {/* Mini dimmed preview */}
            {items.length>0 && (
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:5,
                marginTop:28,width:"100%",maxWidth:280,opacity:0.14,pointerEvents:"none"}}>
                {items.map((item,i)=>(
                  <div key={i} style={{aspectRatio:"1",borderRadius:7,overflow:"hidden",background:`${cat.color}20`}}>
                    <img src={item.url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ── GUESSING ─────────────────────────────────────────────────── */}
        {phase==="guessing" && cat && (
          <motion.div key="guess"
            initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} exit={{opacity:0}}
            style={{ flex:1, display:"flex", flexDirection:"column", padding:"10px 12px 0",
              overflow:"hidden", zIndex:1, position:"relative" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8, flexShrink:0 }}>
              <p style={{margin:0,color:"rgba(255,255,255,0.9)",fontSize:14,fontWeight:700}}>
                Devine les 3 préférés de {pName} 🔍
              </p>
              <Dots count={mySelections.length} color="#a855f7"/>
            </div>
            <div style={{ flex:1, overflowY:"auto", WebkitOverflowScrolling:"touch" as never }}>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:8 }}>
                {items.map((item,i) => (
                  <ImageCell key={i} item={item}
                    catEmoji={cat.emoji} catColor="#a855f7" catGlow="rgba(168,85,247,0.5)"
                    selected={mySelections.includes(i)}
                    locked={mySelections.length>=3 && !mySelections.includes(i)}
                    onClick={()=>toggle(i)}/>
                ))}
              </div>
            </div>
            <ConfirmBtn onPress={confirmGuess} isGuess/>
          </motion.div>
        )}

        {/* ── REVEAL ───────────────────────────────────────────────────── */}
        {phase==="reveal" && cat && (
          <motion.div key="reveal"
            initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            style={{ flex:1, display:"flex", flexDirection:"column", padding:"12px 12px 0",
              overflow:"hidden", zIndex:1, position:"relative" }}>

            {/* Score */}
            <motion.div
              initial={{scale:0.65,opacity:0}} animate={{scale:1,opacity:1}}
              transition={{type:"spring",bounce:0.55,delay:0.1}}
              style={{textAlign:"center",marginBottom:8,flexShrink:0}}>
              <p style={{fontSize:46,fontWeight:900,color:"white",margin:0,lineHeight:1}}>
                {roundScore}<span style={{fontSize:18,color:"rgba(255,255,255,0.3)",fontWeight:400}}>/3</span>
              </p>
              <p style={{fontSize:13,color:scoreMsg(roundScore).color,fontWeight:700,marginTop:3}}>
                {scoreMsg(roundScore).text}
              </p>
            </motion.div>

            {/* Legend */}
            <div style={{display:"flex",gap:14,justifyContent:"center",marginBottom:8,flexShrink:0}}>
              {[["✅","Trouvé"],["💛","Manqué"],["❌","Mauvais"]].map(([icon,lbl])=>(
                <div key={icon} style={{display:"flex",alignItems:"center",gap:4}}>
                  <span style={{fontSize:13}}>{icon}</span>
                  <span style={{fontSize:10,color:"rgba(255,255,255,0.38)"}}>{lbl}</span>
                </div>
              ))}
            </div>

            {/* 4-col grid */}
            <div style={{flex:1,overflowY:"auto"}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,padding:"0 2px 4px"}}>
                {items.map((item,i)=>{
                  const wp=pickerPicks.includes(i), wg=guesserGuess.includes(i);
                  const rs:RevealStatus = wp&&wg?"correct":wp&&!wg?"missed":!wp&&wg?"wrong":"neutral";
                  return (
                    <motion.div key={i}
                      initial={{opacity:0,scale:0.75}} animate={{opacity:1,scale:1}}
                      transition={{delay:i*0.04,type:"spring",bounce:0.3}}>
                      <ImageCell item={item}
                        catEmoji={cat.emoji} catColor={cat.color} catGlow={cat.glow}
                        selected={false} locked={false} revealStatus={rs}/>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            <p style={{textAlign:"center",fontSize:11,color:"rgba(255,255,255,0.32)",
              marginTop:6,flexShrink:0}}>
              {gName} marque {roundScore} pt{roundScore!==1?"s":""} ce tour
            </p>

            {/* Buttons */}
            <div style={{display:"flex",gap:8,marginTop:8,flexShrink:0}}>
              <button onClick={restart} disabled={confirming}
                style={{
                  flex:1, padding:"12px 0", borderRadius:999,
                  border:"1px solid rgba(255,255,255,0.12)",
                  background:"rgba(255,255,255,0.05)",
                  color:"rgba(255,255,255,0.45)", fontSize:13, fontWeight:700,
                  cursor:confirming?"default":"pointer",
                }}>
                <RefreshCw size={12} style={{display:"inline",marginRight:5,verticalAlign:"middle"}}/>
                Reset
              </button>
              <motion.button onClick={nextRound} disabled={confirming}
                whileTap={{scale:confirming?1:0.97}}
                style={{
                  flex:2.5, padding:"12px 0", borderRadius:999, border:"none",
                  background:confirming?"rgba(255,255,255,0.08)":"linear-gradient(135deg,#ec4899,#a855f7)",
                  color:confirming?"rgba(255,255,255,0.3)":"white",
                  fontSize:14, fontWeight:800,
                  cursor:confirming?"default":"pointer",
                  boxShadow:confirming?"none":"0 6px 20px rgba(168,85,247,0.38)",
                }}>
                {confirming?"…":"Tour suivant →"}
              </motion.button>
            </div>

            {/* Scores */}
            <div style={{display:"flex",gap:10,justifyContent:"center",
              margin:"10px 0 calc(env(safe-area-inset-bottom) + 10px)",flexShrink:0}}>
              {([1,2] as const).map(slot=>{
                const lead=scores[slot-1]===Math.max(...scores)&&scores[0]!==scores[1];
                return (
                  <div key={slot} style={{
                    textAlign:"center",
                    background:lead?"rgba(245,158,11,0.12)":"rgba(255,255,255,0.05)",
                    border:lead?"1px solid rgba(245,158,11,0.3)":"1px solid rgba(255,255,255,0.06)",
                    borderRadius:14,padding:"8px 20px",transition:"all 0.3s",
                  }}>
                    {lead&&<Crown size={13} color="#f59e0b" style={{display:"block",margin:"0 auto 3px"}}/>}
                    <p style={{margin:0,fontSize:22,fontWeight:900,color:"white"}}>{scores[slot-1]}</p>
                    <p style={{margin:0,fontSize:10,color:"rgba(255,255,255,0.38)"}}>
                      {(slot===1?player1:player2).split(" ")[0]}
                    </p>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

      </AnimatePresence>

      {/* Dot connexion */}
      <div style={{
        position:"fixed",
        bottom:"calc(env(safe-area-inset-bottom) + 6px)", right:10,
        width:6, height:6, borderRadius:"50%",
        background:connected?"#10b981":"#ef4444",
        opacity:0.5, zIndex:100,
      }}/>
    </div>
  );
}
