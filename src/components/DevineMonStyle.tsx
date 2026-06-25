import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Check, Crown, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// ── Seeded PRNG (mulberry32) ───────────────────────────────────────────────
function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickItems(pool: string[], seed: number, n = 8): string[] {
  const rand = mulberry32(seed);
  const arr = [...pool];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, n);
}

// ── Image URL ─────────────────────────────────────────────────────────────
const U = (id: string) =>
  `https://images.unsplash.com/photo-${id}?w=480&h=480&fit=crop&q=80&auto=format`;

// ── Image pools ───────────────────────────────────────────────────────────
const CATEGORIES = [
  {
    id: "robes", label: "Robes & Mode", emoji: "👗",
    color: "#ec4899", glow: "rgba(236,72,153,0.45)",
    dark: "linear-gradient(135deg,#4a0020 0%,#1a0010 100%)",
    pool: [
      "1515886657613-9f3515b0c78f","1539109136881-3be0616acf4b",
      "1483985988355-763728e1802b","1496747611176-843222e1e57c",
      "1469334031218-e382a71b716b","1487222477894-8943e31ef7b2",
      "1509631179647-0177331693ae","1519751138087-5bf79df62d5b",
      "1503342217505-b0a15ec3261c","1434389677669-e08b4cac3105",
      "1518611012118-696072aa579a","1566174053879-31528523f8ae",
      "1490481651871-ab68de25d43d","1558618666-fcd25c85cd64",
      "1525507069-f58f46f2b6ee","1571786366434-4d4f5e0c0af5",
      "1572635196237-14b3f281503f","1529635266994-2c8b5b5c3c7a",
      "1581044777550-4cfa2d8f5e8f","1580587771525-4e54b4c29ce3",
      "1546961342-ea5f62d7c2a7","1550614036-1a8a3a7e64e3",
      "1603302576837-37561b2e2302","1600585154340-be6161a56a0c",
    ].map(U),
  },
  {
    id: "chaussures", label: "Chaussures", emoji: "👠",
    color: "#a855f7", glow: "rgba(168,85,247,0.45)",
    dark: "linear-gradient(135deg,#2d0060 0%,#0f0025 100%)",
    pool: [
      "1542291026-7eec264c27ff","1460353581641-37baddab0fa2",
      "1491553895911-0055eca6402d","1525966222134-fcfa99b8ae77",
      "1543163521-1bf539c55dd2","1518894781321-630e638d0742",
      "1512374382149-233c42b6a83b","1584735175315-9d5df23be4a1",
      "1600269452121-4f2416e55c28","1568702846914-96b305d2aaeb",
      "1606107557195-0e29a4b5b4aa","1595950653106-bdbce3a45d9b",
      "1514590734846-e7f67677dd7e","1547036967-23d11aacaee0",
      "1563861826100-9cb868fdbe1c","1560769629-975ec94e6a86",
      "1511556820780-d912e42b4980","1585386959984-a4155224a1ad",
      "1539519942-9c11f6f34e53","1520219370-b1dc03d9a5d5",
      "1578116963-0ad3af3d3f3e","1618260788-0cd7a9aea6f5",
      "1630874058717-dc5d85e8fecd","1651407479093-f6b58f8bf8f8",
    ].map(U),
  },
  {
    id: "voitures", label: "Voitures", emoji: "🚗",
    color: "#ef4444", glow: "rgba(239,68,68,0.45)",
    dark: "linear-gradient(135deg,#500000 0%,#1a0000 100%)",
    pool: [
      "1492144534655-ae79c964c9d7","1544636331-e26879cd4d9b",
      "1503736334956-4c8f8e4dc391","1552519507-da3b142c6e3d",
      "1525609004556-c46c7d6cf023","1583121274602-3e2820c69888",
      "1580273916550-e323be2ae537","1542362567-b07e54358753",
      "1511919884226-fd3cad34687c","1502877338535-766e1452684a",
      "1493238792000-8113da705763","1519245659620-e859806a8d3b",
      "1449965408869-eaa3f722e40d","1520340974578-0e7ffa4de31d",
      "1547189885-68e8e29d7c02","1590362891991-f776e747a588",
      "1603386311-f1b37a28d9c5","1563720223-b9d47f5b8ac5",
      "1554744296-6ed18cf8cac9","1589408820082-24e8b57b2d76",
      "1604054923956-1cb3ef7414b7","1621274590947-2e31cc2b53f7",
      "1485291571150-772bcfc10da5","1616422036-1af5d56e1e2f",
    ].map(U),
  },
  {
    id: "deco", label: "Déco & Maison", emoji: "🏠",
    color: "#10b981", glow: "rgba(16,185,129,0.45)",
    dark: "linear-gradient(135deg,#003028 0%,#000e0a 100%)",
    pool: [
      "1555041469-a586c61ea9bc","1586023492125-27b2c045efd7",
      "1567016432779-094069958ea5","1484101403633-562f891dc89a",
      "1600210492486-724fe5c67fb3","1560185007-cde436f6a4d0",
      "1524758631624-e2822e304c36","1556228453-efd6c1ff04f6",
      "1600607687939-ce8a6c25118c","1618221195710-dd6b41faaea6",
      "1598928506311-c55ded91a20c","1507089947368-19c1da9775ae",
      "1505409628601-edc9af17fda6","1449824913935-59a10b8d2000",
      "1493809950229-ab1a6e9ac77e","1538127520272-d93702a19867",
      "1565182999561-18d7dc61c393","1502005229762-fd26c6e55e5c",
      "1617104678098-de229db51b7c","1615873968403-89fff8b8c1a4",
      "1616046386961-3ca14a2d2c67","1618160702438-9b02ab6515c9",
      "1564078516393-cf04bd966897","1631679706909-1844bbd0223b",
    ].map(U),
  },
  {
    id: "destinations", label: "Destinations", emoji: "✈️",
    color: "#0ea5e9", glow: "rgba(14,165,233,0.45)",
    dark: "linear-gradient(135deg,#002040 0%,#00070f 100%)",
    pool: [
      "1506905925346-21bda4d32df4","1499856871958-5b9627545d1a",
      "1512453979798-5ea266f8880c","1539037116277-4db20889f2d4",
      "1523906834658-6e24ef2386f9","1476514525535-07fb3b4ae5f1",
      "1507525428034-b723cf961d3e","1534430480872-3498386e7856",
      "1469854523086-cc02fe5d8800","1528360983277-13d401cdc186",
      "1581351721010-8cf859cb14a4","1491555103944-7c647fd857e6",
      "1530521954074-e64f4810b5ad","1552465011-b4e21bf6e79a",
      "1473496169904-658ba7574f0a","1502635385003-6702a3197638",
      "1552832230-c0197dd311b5","1501785888041-af3ef285b470",
      "1519302959554-a75be0afc578","1548574505-7cce1a7e7a72",
      "1568454537842-d933259bb258","1580541631950-7282082b53a7",
      "1532274402911-5a369e4c4bb5","1614094082869-cd4e4b2905c7",
    ].map(U),
  },
] as const;

type CatId = typeof CATEGORIES[number]["id"];
type Phase = "category" | "picking" | "waiting_pick" | "guessing" | "waiting_guess" | "reveal";

// ── Broadcast payload helpers ─────────────────────────────────────────────
function extractPayload<T>(msg: unknown): T {
  const raw = (msg ?? {}) as Record<string, unknown>;
  return ((raw["payload"] ?? raw) as T);
}

// ── Score messages ────────────────────────────────────────────────────────
function scoreMsg(n: number) {
  if (n === 3) return { text: "Parfait ! Tu le connais par cœur 🔥", color: "#f59e0b" };
  if (n === 2) return { text: "Bien joué ! Presque parfait 💕", color: "#10b981" };
  if (n === 1) return { text: "Pas mal… encore un effort 🌱", color: "#0ea5e9" };
  return { text: "Aïe ! Vous avez à apprendre l'un de l'autre 😅", color: "#f43f5e" };
}

// ── Props ─────────────────────────────────────────────────────────────────
interface Props {
  player1: string; player2: string;
  mySlot: 1 | 2; coupleId: string;
  onBack: () => void;
}

// ── Main component ────────────────────────────────────────────────────────
export function DevineMonStyle({ player1, player2, mySlot, coupleId, onBack }: Props) {
  const [phase, setPhase]           = useState<Phase>("category");
  const [picker, setPicker]         = useState<1 | 2>(1);
  const [catId, setCatId]           = useState<CatId | "">("");
  const [items, setItems]           = useState<string[]>([]);
  const [mySelections, setMySel]    = useState<number[]>([]);
  const [pickerPicks, setPickerPicks] = useState<number[]>([]);
  const [guesserGuess, setGuesserGuess] = useState<number[]>([]);
  const [scores, setScores]         = useState<[number, number]>([0, 0]);
  const [roundScore, setRoundScore] = useState(0);
  const [connected, setConnected]   = useState(false);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pickerRef  = useRef<1 | 2>(1);

  const isPicker   = picker === mySlot;
  const cat        = CATEGORIES.find(c => c.id === catId) ?? null;
  const pickerName = picker === 1 ? player1 : player2;
  const guesserName = picker === 1 ? player2 : player1;
  const guesserSlot: 1 | 2 = picker === 1 ? 2 : 1;

  // ── Channel setup ───────────────────────────────────────────────────────
  useEffect(() => {
    const ch = supabase.channel(`devineStyle:${coupleId}`, {
      config: { broadcast: { self: false } },
    });
    ch
      .on("broadcast", { event: "round_start" }, (msg) => {
        const p = extractPayload<{ catId: CatId; seed: number }>(msg);
        const found = CATEGORIES.find(c => c.id === p.catId);
        if (!found) return;
        const picked = pickItems([...found.pool], p.seed);
        setItems(picked); setCatId(p.catId);
        setMySel([]); setPickerPicks([]); setGuesserGuess([]);
        // Receiver is always the guesser when this arrives
        setPhase("waiting_pick");
      })
      .on("broadcast", { event: "picks_done" }, (msg) => {
        const p = extractPayload<{ picks: number[] }>(msg);
        setPickerPicks(p.picks);
        setMySel([]);
        setPhase("guessing");
      })
      .on("broadcast", { event: "guess_done" }, (msg) => {
        const p = extractPayload<{ guesses: number[]; guesserSlot: 1 | 2 }>(msg);
        setGuesserGuess(p.guesses);
        // Compute score for guesser
        setPickerPicks(prev => {
          const correct = prev.filter(i => p.guesses.includes(i)).length;
          setRoundScore(correct);
          setScores(s => {
            const n: [number, number] = [s[0], s[1]];
            n[p.guesserSlot - 1] += correct;
            return n;
          });
          return prev;
        });
        setPhase("reveal");
      })
      .on("broadcast", { event: "next_round" }, (msg) => {
        const p = extractPayload<{ nextPicker: 1 | 2 }>(msg);
        setPicker(p.nextPicker); pickerRef.current = p.nextPicker;
        setPhase("category"); setItems([]); setCatId(""); setMySel([]);
        setPickerPicks([]); setGuesserGuess([]);
      })
      .on("broadcast", { event: "restart" }, () => {
        setPicker(1); pickerRef.current = 1;
        setPhase("category"); setItems([]); setCatId(""); setMySel([]);
        setPickerPicks([]); setGuesserGuess([]); setScores([0, 0]);
      })
      .subscribe((s) => setConnected(s === "SUBSCRIBED"));
    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [coupleId]);

  // ── Actions ─────────────────────────────────────────────────────────────
  function startRound(cId: CatId) {
    const seed = Math.floor(Math.random() * 999983);
    const found = CATEGORIES.find(c => c.id === cId)!;
    const picked = pickItems([...found.pool], seed);
    channelRef.current?.send({ type: "broadcast", event: "round_start", payload: { catId: cId, seed } });
    setItems(picked); setCatId(cId); setMySel([]); setPickerPicks([]); setGuesserGuess([]);
    setPhase("picking");
  }

  function confirmPicks() {
    channelRef.current?.send({ type: "broadcast", event: "picks_done", payload: { picks: mySelections } });
    setPickerPicks(mySelections); setMySel([]);
    setPhase("waiting_guess");
  }

  function confirmGuess() {
    channelRef.current?.send({ type: "broadcast", event: "guess_done", payload: { guesses: mySelections, guesserSlot } });
    const correct = pickerPicks.filter(i => mySelections.includes(i)).length;
    setGuesserGuess(mySelections); setRoundScore(correct);
    setScores(s => { const n: [number, number] = [s[0], s[1]]; n[guesserSlot - 1] += correct; return n; });
    setPhase("reveal");
  }

  function nextRound() {
    const nextPicker: 1 | 2 = picker === 1 ? 2 : 1;
    channelRef.current?.send({ type: "broadcast", event: "next_round", payload: { nextPicker } });
    setPicker(nextPicker); pickerRef.current = nextPicker;
    setPhase("category"); setItems([]); setCatId(""); setMySel([]); setPickerPicks([]); setGuesserGuess([]);
  }

  function restart() {
    channelRef.current?.send({ type: "broadcast", event: "restart", payload: {} });
    setPicker(1); pickerRef.current = 1;
    setPhase("category"); setItems([]); setCatId(""); setMySel([]); setPickerPicks([]); setGuesserGuess([]); setScores([0, 0]);
  }

  function toggleItem(idx: number, max: number) {
    setMySel(prev =>
      prev.includes(idx) ? prev.filter(i => i !== idx)
      : prev.length < max ? [...prev, idx] : prev
    );
  }

  // ── Reveal data ─────────────────────────────────────────────────────────
  const correct = useMemo(() =>
    pickerPicks.filter(i => guesserGuess.includes(i)),
    [pickerPicks, guesserGuess]
  );

  // ── Placeholder for broken images ────────────────────────────────────────
  function imgFallback(e: React.SyntheticEvent<HTMLImageElement>) {
    const emoji = cat?.emoji ?? "🖼️";
    (e.currentTarget).src =
      `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='480' height='480'><rect width='480' height='480' fill='%23160820'/><text x='240' y='270' font-size='96' text-anchor='middle' dominant-baseline='middle'>${emoji}</text></svg>`;
  }

  // ── Shared styles ─────────────────────────────────────────────────────────
  const BG: React.CSSProperties = {
    minHeight: "100dvh", background: "#0b0114",
    display: "flex", flexDirection: "column",
    position: "relative", overflow: "hidden",
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div style={BG}>
      {/* Ambient orbs */}
      {cat && <>
        <div style={{ position:"absolute", top:"-20%", left:"-15%", width:300, height:300, borderRadius:"50%",
          background:`radial-gradient(circle, ${cat.glow} 0%, transparent 70%)`, filter:"blur(60px)", pointerEvents:"none" }}/>
        <div style={{ position:"absolute", bottom:"-20%", right:"-15%", width:280, height:280, borderRadius:"50%",
          background:`radial-gradient(circle, ${cat.glow} 0%, transparent 70%)`, filter:"blur(60px)", pointerEvents:"none" }}/>
      </>}

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"env(safe-area-inset-top) 16px 0", paddingTop:"calc(env(safe-area-inset-top) + 12px)",
        position:"relative", zIndex:10 }}>
        <button onClick={onBack} style={{ background:"rgba(255,255,255,0.08)", border:"none", borderRadius:12,
          width:36, height:36, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
          <ArrowLeft size={18} color="white"/>
        </button>
        <div style={{ textAlign:"center" }}>
          <p style={{ margin:0, fontSize:11, fontWeight:700, letterSpacing:2, color:"rgba(255,255,255,0.35)",
            textTransform:"uppercase" }}>Devine mon Style</p>
          {cat && <p style={{ margin:0, fontSize:13, color:cat.color, fontWeight:700 }}>{cat.emoji} {cat.label}</p>}
        </div>
        {/* Scores */}
        <div style={{ display:"flex", gap:8 }}>
          {([1,2] as const).map(slot => (
            <div key={slot} style={{ textAlign:"center",
              opacity: picker === slot ? 1 : 0.45 }}>
              <p style={{ margin:0, fontSize:15, fontWeight:800, color:"white", lineHeight:1 }}>{scores[slot-1]}</p>
              <p style={{ margin:0, fontSize:9, color:"rgba(255,255,255,0.4)", lineHeight:1 }}>
                {slot===1 ? player1.split(" ")[0] : player2.split(" ")[0]}
              </p>
            </div>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">

        {/* ── CATEGORY SELECTION ─────────────────────────────────────────── */}
        {phase === "category" && (
          <motion.div key="cat" initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-20 }}
            style={{ flex:1, padding:"24px 16px", overflowY:"auto" }}>
            {isPicker ? (
              <>
                <p style={{ textAlign:"center", color:"rgba(255,255,255,0.85)", fontSize:17, fontWeight:700, marginBottom:6 }}>
                  Tu choisis d'abord, {pickerName.split(" ")[0]} 🎯
                </p>
                <p style={{ textAlign:"center", color:"rgba(255,255,255,0.38)", fontSize:13, marginBottom:24 }}>
                  Sélectionne une catégorie
                </p>
                <div style={{ display:"flex", flexDirection:"column", gap:12, maxWidth:400, margin:"0 auto" }}>
                  {CATEGORIES.map((c, i) => (
                    <motion.button key={c.id}
                      initial={{ opacity:0, x:-20 }} animate={{ opacity:1, x:0 }} transition={{ delay: i * 0.07 }}
                      onClick={() => startRound(c.id)}
                      whileTap={{ scale: 0.97 }}
                      style={{ display:"flex", alignItems:"center", gap:16,
                        background:"rgba(255,255,255,0.06)", border:`1px solid ${c.color}44`,
                        borderRadius:20, padding:"18px 20px", cursor:"pointer", textAlign:"left",
                        boxShadow:`0 4px 20px ${c.glow.replace("0.45","0.12")}` }}>
                      <span style={{ fontSize:36, lineHeight:1 }}>{c.emoji}</span>
                      <div>
                        <p style={{ margin:0, fontSize:16, fontWeight:800, color:"white" }}>{c.label}</p>
                        <p style={{ margin:0, fontSize:12, color:"rgba(255,255,255,0.4)", marginTop:2 }}>
                          24 images · sélection aléatoire
                        </p>
                      </div>
                      <div style={{ marginLeft:"auto", color:c.color, fontSize:18 }}>→</div>
                    </motion.button>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", paddingTop:60 }}>
                <motion.div animate={{ scale:[1,1.08,1] }} transition={{ duration:2, repeat:Infinity }}>
                  <span style={{ fontSize:64 }}>🎯</span>
                </motion.div>
                <p style={{ color:"white", fontSize:18, fontWeight:700, marginTop:20, textAlign:"center" }}>
                  {pickerName.split(" ")[0]} choisit la catégorie…
                </p>
                <p style={{ color:"rgba(255,255,255,0.38)", fontSize:13, marginTop:8, textAlign:"center" }}>
                  Patience, ça arrive vite !
                </p>
              </div>
            )}
          </motion.div>
        )}

        {/* ── PICKING (picker selects 3) ─────────────────────────────────── */}
        {phase === "picking" && (
          <motion.div key="pick" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            style={{ flex:1, display:"flex", flexDirection:"column", padding:"20px 12px" }}>
            <p style={{ textAlign:"center", color:"rgba(255,255,255,0.8)", fontSize:15, fontWeight:700, marginBottom:4 }}>
              Choisis 3 que tu aimes ❤️
            </p>
            <p style={{ textAlign:"center", fontSize:12, color:"rgba(255,255,255,0.38)", marginBottom:16 }}>
              {mySelections.length}/3 sélectionnés — {guesserName.split(" ")[0]} devra deviner
            </p>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:6, flex:1 }}>
              {items.map((url, i) => {
                const sel = mySelections.includes(i);
                return (
                  <motion.button key={i} whileTap={{ scale:0.92 }} onClick={() => toggleItem(i, 3)}
                    style={{ aspectRatio:"1", borderRadius:14, overflow:"hidden", position:"relative",
                      border: sel ? `2.5px solid ${cat?.color ?? "#ec4899"}` : "2px solid rgba(255,255,255,0.08)",
                      boxShadow: sel ? `0 0 16px ${cat?.glow ?? "rgba(236,72,153,0.4)"}` : "none",
                      cursor: mySelections.length >= 3 && !sel ? "default" : "pointer" }}>
                    <img src={url} alt="" onError={imgFallback}
                      style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }}/>
                    {sel && (
                      <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.3)",
                        display:"flex", alignItems:"center", justifyContent:"center" }}>
                        <div style={{ background: cat?.color ?? "#ec4899", borderRadius:"50%",
                          width:28, height:28, display:"flex", alignItems:"center", justifyContent:"center" }}>
                          <Check size={15} color="white" strokeWidth={3}/>
                        </div>
                      </div>
                    )}
                    {!sel && mySelections.length >= 3 && (
                      <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.35)" }}/>
                    )}
                  </motion.button>
                );
              })}
            </div>
            <motion.button onClick={confirmPicks} disabled={mySelections.length < 3}
              animate={mySelections.length === 3 ? { scale:[1,1.03,1] } : {}}
              transition={{ duration:0.8, repeat: mySelections.length === 3 ? Infinity : 0 }}
              style={{ marginTop:16, padding:"16px 32px", borderRadius:999, border:"none", cursor: mySelections.length < 3 ? "default" : "pointer",
                background: mySelections.length === 3
                  ? `linear-gradient(135deg, ${cat?.color ?? "#ec4899"}, #a855f7)`
                  : "rgba(255,255,255,0.1)",
                color: mySelections.length === 3 ? "white" : "rgba(255,255,255,0.3)",
                fontSize:16, fontWeight:800,
                boxShadow: mySelections.length === 3 ? `0 6px 24px ${cat?.glow ?? "rgba(236,72,153,0.4)"}` : "none",
                transition:"all 0.3s ease" }}>
              {mySelections.length < 3 ? `Encore ${3 - mySelections.length} à choisir` : "✓ Valider mes choix"}
            </motion.button>
          </motion.div>
        )}

        {/* ── WAITING (picker waits for guesser) ────────────────────────── */}
        {(phase === "waiting_pick" || phase === "waiting_guess") && (
          <motion.div key="wait" initial={{ opacity:0, scale:0.95 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0 }}
            style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24 }}>
            <motion.div animate={{ rotate:360 }} transition={{ duration:3, repeat:Infinity, ease:"linear" }}>
              <span style={{ fontSize:56 }}>{cat?.emoji ?? "🎯"}</span>
            </motion.div>
            <p style={{ color:"white", fontSize:18, fontWeight:700, marginTop:24, textAlign:"center" }}>
              {phase === "waiting_pick"
                ? `${pickerName.split(" ")[0]} est en train de choisir…`
                : `${guesserName.split(" ")[0]} est en train de deviner…`}
            </p>
            <p style={{ color:"rgba(255,255,255,0.35)", fontSize:13, marginTop:8, textAlign:"center" }}>
              Patience… la surprise arrive !
            </p>
            {/* Show dimmed grid as preview */}
            {items.length > 0 && (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:4, marginTop:28, width:"100%", maxWidth:320, opacity:0.2 }}>
                {items.map((url, i) => (
                  <div key={i} style={{ aspectRatio:"1", borderRadius:10, overflow:"hidden" }}>
                    <img src={url} alt="" onError={imgFallback} style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ── GUESSING (guesser picks 3) ────────────────────────────────── */}
        {phase === "guessing" && (
          <motion.div key="guess" initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
            style={{ flex:1, display:"flex", flexDirection:"column", padding:"20px 12px" }}>
            <p style={{ textAlign:"center", color:"rgba(255,255,255,0.85)", fontSize:15, fontWeight:700, marginBottom:4 }}>
              Devine les 3 choix de {pickerName.split(" ")[0]} 🔍
            </p>
            <p style={{ textAlign:"center", fontSize:12, color:"rgba(255,255,255,0.38)", marginBottom:16 }}>
              {mySelections.length}/3 sélectionnés
            </p>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:6, flex:1 }}>
              {items.map((url, i) => {
                const sel = mySelections.includes(i);
                return (
                  <motion.button key={i} whileTap={{ scale:0.92 }} onClick={() => toggleItem(i, 3)}
                    style={{ aspectRatio:"1", borderRadius:14, overflow:"hidden", position:"relative",
                      border: sel ? "2.5px solid #a855f7" : "2px solid rgba(255,255,255,0.08)",
                      boxShadow: sel ? "0 0 16px rgba(168,85,247,0.5)" : "none",
                      cursor: mySelections.length >= 3 && !sel ? "default" : "pointer" }}>
                    <img src={url} alt="" onError={imgFallback}
                      style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }}/>
                    {sel && (
                      <div style={{ position:"absolute", inset:0, background:"rgba(168,85,247,0.25)",
                        display:"flex", alignItems:"center", justifyContent:"center" }}>
                        <div style={{ background:"#a855f7", borderRadius:"50%", width:28, height:28,
                          display:"flex", alignItems:"center", justifyContent:"center" }}>
                          <Check size={15} color="white" strokeWidth={3}/>
                        </div>
                      </div>
                    )}
                    {!sel && mySelections.length >= 3 && (
                      <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.35)" }}/>
                    )}
                  </motion.button>
                );
              })}
            </div>
            <motion.button onClick={confirmGuess} disabled={mySelections.length < 3}
              animate={mySelections.length === 3 ? { scale:[1,1.03,1] } : {}}
              transition={{ duration:0.8, repeat: mySelections.length === 3 ? Infinity : 0 }}
              style={{ marginTop:16, padding:"16px 32px", borderRadius:999, border:"none",
                cursor: mySelections.length < 3 ? "default" : "pointer",
                background: mySelections.length === 3
                  ? "linear-gradient(135deg, #a855f7, #ec4899)"
                  : "rgba(255,255,255,0.1)",
                color: mySelections.length === 3 ? "white" : "rgba(255,255,255,0.3)",
                fontSize:16, fontWeight:800,
                boxShadow: mySelections.length === 3 ? "0 6px 24px rgba(168,85,247,0.45)" : "none",
                transition:"all 0.3s ease" }}>
              {mySelections.length < 3 ? `Encore ${3 - mySelections.length} à deviner` : "✓ Soumettre mes devinettes"}
            </motion.button>
          </motion.div>
        )}

        {/* ── REVEAL ─────────────────────────────────────────────────────── */}
        {phase === "reveal" && (
          <motion.div key="reveal" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            style={{ flex:1, display:"flex", flexDirection:"column", padding:"20px 12px" }}>

            {/* Score banner */}
            <motion.div initial={{ scale:0.8, opacity:0 }} animate={{ scale:1, opacity:1 }} transition={{ type:"spring", delay:0.2 }}
              style={{ textAlign:"center", marginBottom:16 }}>
              <p style={{ fontSize:40, fontWeight:900, color:"white", margin:0, lineHeight:1 }}>
                {roundScore}<span style={{ fontSize:20, color:"rgba(255,255,255,0.4)", fontWeight:400 }}>/3</span>
              </p>
              <p style={{ fontSize:13, color: scoreMsg(roundScore).color, fontWeight:700, marginTop:4 }}>
                {scoreMsg(roundScore).text}
              </p>
            </motion.div>

            {/* Image grid with reveals */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:6, flex:1 }}>
              {items.map((url, i) => {
                const wasPicked    = pickerPicks.includes(i);
                const wasGuessed   = guesserGuess.includes(i);
                const isCorrect    = wasPicked && wasGuessed;
                const isMissed     = wasPicked && !wasGuessed;
                const isWrongGuess = !wasPicked && wasGuessed;

                return (
                  <motion.div key={i}
                    initial={{ opacity:0, scale:0.85 }} animate={{ opacity:1, scale:1 }}
                    transition={{ delay: i * 0.04, type:"spring" }}
                    style={{ aspectRatio:"1", borderRadius:14, overflow:"hidden", position:"relative",
                      border: isCorrect ? "2.5px solid #10b981"
                        : isMissed ? "2.5px solid #f59e0b"
                        : isWrongGuess ? "2px solid #ef4444"
                        : "2px solid rgba(255,255,255,0.06)",
                      boxShadow: isCorrect ? "0 0 16px rgba(16,185,129,0.5)"
                        : isMissed ? "0 0 12px rgba(245,158,11,0.4)" : "none" }}>
                    <img src={url} alt="" onError={imgFallback}
                      style={{ width:"100%", height:"100%", objectFit:"cover", display:"block",
                        filter: (!wasPicked && !wasGuessed) ? "brightness(0.4)" : "none" }}/>
                    {isCorrect && (
                      <div style={{ position:"absolute", inset:0, background:"rgba(16,185,129,0.2)",
                        display:"flex", alignItems:"center", justifyContent:"center" }}>
                        <span style={{ fontSize:22 }}>✅</span>
                      </div>
                    )}
                    {isMissed && (
                      <div style={{ position:"absolute", inset:0, background:"rgba(245,158,11,0.2)",
                        display:"flex", alignItems:"center", justifyContent:"center" }}>
                        <span style={{ fontSize:22 }}>💛</span>
                      </div>
                    )}
                    {isWrongGuess && (
                      <div style={{ position:"absolute", inset:0, background:"rgba(239,68,68,0.2)",
                        display:"flex", alignItems:"center", justifyContent:"center" }}>
                        <span style={{ fontSize:22 }}>❌</span>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* Legend */}
            <div style={{ display:"flex", gap:12, justifyContent:"center", marginTop:12 }}>
              {[["✅","Bonne réponse"],["💛","Raté"],["❌","Mauvaise guess"]].map(([icon,label]) => (
                <div key={icon} style={{ display:"flex", alignItems:"center", gap:4 }}>
                  <span style={{ fontSize:12 }}>{icon}</span>
                  <span style={{ fontSize:10, color:"rgba(255,255,255,0.4)" }}>{label}</span>
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div style={{ display:"flex", gap:10, marginTop:16 }}>
              <button onClick={restart} style={{ flex:1, padding:"13px 0", borderRadius:999, border:"1px solid rgba(255,255,255,0.15)",
                background:"rgba(255,255,255,0.06)", color:"rgba(255,255,255,0.55)", fontSize:14, fontWeight:700, cursor:"pointer" }}>
                <RefreshCw size={13} style={{ display:"inline", marginRight:6 }}/>
                Tout reset
              </button>
              <motion.button onClick={nextRound} whileTap={{ scale:0.97 }}
                style={{ flex:2, padding:"13px 0", borderRadius:999, border:"none",
                  background:"linear-gradient(135deg,#ec4899,#a855f7)",
                  color:"white", fontSize:14, fontWeight:800, cursor:"pointer",
                  boxShadow:"0 6px 20px rgba(168,85,247,0.35)" }}>
                Tour suivant →
              </motion.button>
            </div>

            {/* Total scores */}
            <div style={{ display:"flex", gap:12, justifyContent:"center", marginTop:14 }}>
              {([1,2] as const).map(slot => (
                <div key={slot} style={{ textAlign:"center",
                  background:"rgba(255,255,255,0.06)", borderRadius:14, padding:"10px 20px" }}>
                  {scores[slot-1] === Math.max(...scores) && scores[0] !== scores[1] &&
                    <Crown size={14} color="#f59e0b" style={{ display:"block", margin:"0 auto 4px" }}/>}
                  <p style={{ margin:0, fontSize:22, fontWeight:900, color:"white" }}>{scores[slot-1]}</p>
                  <p style={{ margin:0, fontSize:11, color:"rgba(255,255,255,0.4)" }}>
                    {slot===1 ? player1.split(" ")[0] : player2.split(" ")[0]}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

      </AnimatePresence>

      {/* Connection dot */}
      <div style={{ position:"fixed", bottom:8, right:8, width:6, height:6, borderRadius:"50%",
        background: connected ? "#10b981" : "#ef4444", opacity:0.6 }}/>
    </div>
  );
}
