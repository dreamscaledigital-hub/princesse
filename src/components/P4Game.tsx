import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { supabase as _supabase } from "@/integrations/supabase/client";
import type { Room } from "@/lib/use-room-state";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any;

const ROWS = 6;
const COLS = 7;

// ── Palette ───────────────────────────────────────────────────────────────
const BG    = "linear-gradient(160deg, oklch(0.10 0.07 260) 0%, oklch(0.07 0.04 250) 100%)";
const BOARD = "oklch(0.17 0.09 240)";
const EMPTY = "oklch(0.09 0.05 255)";
const ROSE  = "#f43f5e";
const AMBER = "#fbbf24";

// ── Dares ─────────────────────────────────────────────────────────────────
const DARES = [
  "Un bisou de 10 secondes 💋",
  "Un câlin de 30 secondes 🤗",
  "Un compliment sincère, regard dans les yeux 🥰",
  "Imite l'autre pendant 1 minute 🎭",
  "Chante une chanson d'amour 🎤",
  "Masse les épaules 1 minute 💆",
  "Raconte ton souvenir préféré à deux 💞",
  "Danse 30 secondes sur la prochaine musique 💃",
  "Donne un surnom mignon tout neuf 🍓",
  "Cuisine ou prépare un truc à boire à l'autre 🍹",
];

// ── Types ─────────────────────────────────────────────────────────────────
type Board = number[][];

type P4State = {
  phase?: "playing" | "won" | "draw";
  board?: Board;
  turn?: 1 | 2;
  winner?: 1 | 2;
  winning_cells?: number[][];
  gage?: string;
  last_col?: number;
  last_row?: number;
};

type Props = {
  room: Room;
  mySlot: number;
  myName: string;
  otherName: string;
  onBackToMenu: () => void;
  onDareDone: () => void;
};

// ── Game logic (unchanged) ────────────────────────────────────────────────
function emptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

function dropPiece(board: Board, col: number, player: number): { board: Board; row: number } | null {
  const next = board.map((r) => [...r]);
  for (let r = ROWS - 1; r >= 0; r--) {
    if (next[r][col] === 0) {
      next[r][col] = player;
      return { board: next, row: r };
    }
  }
  return null;
}

function checkWin(board: Board, row: number, col: number, player: number): number[][] | null {
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (const [dr, dc] of dirs) {
    const cells: number[][] = [[row, col]];
    for (let i = 1; i < 4; i++) {
      const r = row + dr * i, c = col + dc * i;
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS || board[r][c] !== player) break;
      cells.push([r, c]);
    }
    for (let i = 1; i < 4; i++) {
      const r = row - dr * i, c = col - dc * i;
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS || board[r][c] !== player) break;
      cells.push([r, c]);
    }
    if (cells.length >= 4) return cells;
  }
  return null;
}

function isDraw(board: Board): boolean {
  return board[0].every((cell) => cell !== 0);
}

function pickDare() {
  return DARES[Math.floor(Math.random() * DARES.length)];
}

function discColor(slot: number) {
  return slot === 1 ? ROSE : AMBER;
}

// ── Shared styles ─────────────────────────────────────────────────────────
const glass: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 20,
};

// ── Component ─────────────────────────────────────────────────────────────
export function P4Game({ room, mySlot, myName, otherName, onBackToMenu, onDareDone }: Props) {
  const raw      = (room.minigame_state ?? {}) as P4State;
  const phase    = raw.phase ?? "playing";
  const board    = raw.board ?? emptyBoard();
  const turn     = raw.turn ?? 1;
  const winner   = raw.winner;
  const winCells = raw.winning_cells ?? [];
  const gage     = raw.gage ?? "";
  const lastCol  = raw.last_col;
  const lastRow  = raw.last_row;

  const isMyTurn = turn === mySlot;
  const isHost   = mySlot === 1;
  const myColor  = discColor(mySlot);

  const [hoverCol, setHoverCol] = useState<number | null>(null);
  const [dropping, setDropping] = useState(false);
  const confettiFired = useRef(false);

  const p1Name = mySlot === 1 ? myName : otherName;
  const p2Name = mySlot === 2 ? myName : otherName;

  // ── Init (host) ──
  useEffect(() => {
    if (!isHost || raw.phase) return;
    void supabase.from("rooms").update({
      minigame_state: { phase: "playing", board: emptyBoard(), turn: 1, gage: pickDare() } as P4State,
    }).eq("id", room.id);
  }, [isHost, room.id, raw.phase]);

  // ── Confetti ──
  useEffect(() => {
    if (phase === "won" && winner === mySlot && !confettiFired.current) {
      confettiFired.current = true;
      void confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.5 },
        colors: [myColor, "#ffffff", myColor + "88"],
      });
    }
  }, [phase, winner, mySlot, myColor]);

  // ── Play ──
  async function playCol(col: number) {
    if (!isMyTurn || phase !== "playing" || dropping) return;
    const result = dropPiece(board, col, mySlot);
    if (!result) return;

    setDropping(true);
    const { board: newBoard, row } = result;
    const winningCells = checkWin(newBoard, row, col, mySlot);
    const draw = !winningCells && isDraw(newBoard);

    const nextState: P4State = winningCells
      ? { phase: "won", board: newBoard, turn, winner: mySlot as 1 | 2, winning_cells: winningCells, gage, last_col: col, last_row: row }
      : draw
        ? { phase: "draw", board: newBoard, turn, gage, last_col: col, last_row: row }
        : { phase: "playing", board: newBoard, turn: (mySlot === 1 ? 2 : 1) as 1 | 2, gage, last_col: col, last_row: row };

    await supabase.from("rooms").update({ minigame_state: nextState }).eq("id", room.id);
    setDropping(false);
  }

  function restart() {
    if (!isHost) return;
    confettiFired.current = false;
    void supabase.from("rooms").update({
      minigame_state: { phase: "playing", board: emptyBoard(), turn: 1, gage: pickDare() } as P4State,
    }).eq("id", room.id);
  }

  function isWinCell(r: number, c: number) {
    return winCells.some(([wr, wc]) => wr === r && wc === c);
  }

  const interactive = isMyTurn && phase === "playing";

  return (
    <div
      style={{ background: BG, minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 14px 36px" }}
      onMouseLeave={() => setHoverCol(null)}
    >
      {/* ── Header ── */}
      <div style={{ width: "100%", maxWidth: 390, display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <button
          onClick={onBackToMenu}
          style={{
            background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 12, padding: "6px 14px", color: "rgba(255,255,255,0.65)",
            fontSize: 13, cursor: "pointer",
          }}
        >
          ← Menu
        </button>
        <h1 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 27, color: "#fff", margin: 0, letterSpacing: "0.03em" }}>
          Puissance 4
        </h1>
        <div style={{ width: 76 }} />
      </div>

      {/* ── Player HUD ── */}
      <div style={{ width: "100%", maxWidth: 390, display: "flex", gap: 8, marginBottom: 18 }}>
        {/* P1 */}
        <motion.div
          animate={{
            boxShadow: turn === 1 && phase === "playing"
              ? "0 0 0 2px " + ROSE + ", 0 0 18px " + ROSE + "44"
              : "0 0 0 1px rgba(255,255,255,0.08)",
          }}
          transition={{ duration: 0.35 }}
          style={{ ...glass, flex: 1, padding: "10px 12px", display: "flex", alignItems: "center", gap: 8 }}
        >
          <div style={{ width: 14, height: 14, borderRadius: "50%", background: "radial-gradient(circle at 35% 35%, " + ROSE + "ff, " + ROSE + "aa)", boxShadow: "0 0 10px " + ROSE, flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 10, margin: 0 }}>Joueur 1</p>
            <p style={{ color: "#fff", fontSize: 13, fontWeight: 600, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p1Name}</p>
          </div>
          <AnimatePresence>
            {turn === 1 && phase === "playing" && (
              <motion.div
                initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0 }}
                style={{ marginLeft: "auto", width: 7, height: 7, borderRadius: "50%", background: ROSE, boxShadow: "0 0 8px " + ROSE, flexShrink: 0 }}
              />
            )}
          </AnimatePresence>
        </motion.div>

        {/* Center */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minWidth: 40 }}>
          <AnimatePresence mode="wait">
            {phase === "playing" ? (
              <motion.span key="vs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, fontWeight: 800, letterSpacing: "0.08em" }}>VS</motion.span>
            ) : phase === "won" ? (
              <motion.span key="won" initial={{ scale: 0.3 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 400, damping: 15 }}
                style={{ fontSize: 24 }}>🏆</motion.span>
            ) : (
              <motion.span key="draw" initial={{ scale: 0.3 }} animate={{ scale: 1 }} style={{ fontSize: 24 }}>🤝</motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* P2 */}
        <motion.div
          animate={{
            boxShadow: turn === 2 && phase === "playing"
              ? "0 0 0 2px " + AMBER + ", 0 0 18px " + AMBER + "44"
              : "0 0 0 1px rgba(255,255,255,0.08)",
          }}
          transition={{ duration: 0.35 }}
          style={{ ...glass, flex: 1, padding: "10px 12px", display: "flex", alignItems: "center", gap: 8 }}
        >
          <div style={{ width: 14, height: 14, borderRadius: "50%", background: "radial-gradient(circle at 35% 35%, " + AMBER + "ff, " + AMBER + "aa)", boxShadow: "0 0 10px " + AMBER, flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 10, margin: 0 }}>Joueur 2</p>
            <p style={{ color: "#fff", fontSize: 13, fontWeight: 600, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p2Name}</p>
          </div>
          <AnimatePresence>
            {turn === 2 && phase === "playing" && (
              <motion.div
                initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0 }}
                style={{ marginLeft: "auto", width: 7, height: 7, borderRadius: "50%", background: AMBER, boxShadow: "0 0 8px " + AMBER, flexShrink: 0 }}
              />
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* ── Turn label ── */}
      <div style={{ minHeight: 28, display: "flex", alignItems: "center", marginBottom: 10 }}>
        <AnimatePresence mode="wait">
          {phase === "playing" && (
            <motion.div
              key={"turn-" + turn}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22 }}
              style={{ display: "flex", alignItems: "center", gap: 7 }}
            >
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: discColor(turn), boxShadow: "0 0 10px " + discColor(turn) }} />
              <span style={{ color: isMyTurn ? "#fff" : "rgba(255,255,255,0.5)", fontSize: 14, fontWeight: isMyTurn ? 600 : 400 }}>
                {isMyTurn ? "C'est ton tour !" : (turn === 1 ? p1Name : p2Name) + " réfléchit…"}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Board ── */}
      <div style={{ width: "100%", maxWidth: 390 }}>

        {/* Column indicators */}
        <div style={{ display: "flex", paddingLeft: 12, paddingRight: 12, marginBottom: 6, height: 26, gap: 7 }}>
          {Array.from({ length: COLS }).map((_, c) => (
            <div
              key={c}
              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", cursor: interactive ? "pointer" : "default" }}
              onClick={() => playCol(c)}
              onMouseEnter={() => interactive && setHoverCol(c)}
              onMouseLeave={() => setHoverCol(null)}
            >
              <AnimatePresence>
                {hoverCol === c && interactive && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.4 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.4 }}
                    transition={{ type: "spring", stiffness: 520, damping: 26 }}
                    style={{
                      width: 15, height: 15, borderRadius: "50%",
                      background: "radial-gradient(circle at 35% 35%, " + myColor + "ff, " + myColor + "cc)",
                      boxShadow: "0 0 12px " + myColor + ", 0 0 22px " + myColor + "55",
                    }}
                  />
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>

        {/* Board frame */}
        <div style={{
          background: BOARD,
          borderRadius: 24,
          padding: 12,
          boxShadow: "0 28px 80px rgba(0,0,30,0.75), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}>
          {board.map((row, r) => (
            <div key={r} style={{ display: "flex", gap: 7, marginBottom: r < ROWS - 1 ? 7 : 0 }}>
              {row.map((cell, c) => {
                const isWin = isWinCell(r, c);
                const isNew = r === lastRow && c === lastCol;
                const isHov = hoverCol === c && interactive && cell === 0;
                const color = cell !== 0 ? discColor(cell) : null;

                return (
                  <div
                    key={c}
                    onClick={() => playCol(c)}
                    onMouseEnter={() => interactive && setHoverCol(c)}
                    onMouseLeave={() => setHoverCol(null)}
                    style={{
                      flex: 1,
                      aspectRatio: "1",
                      borderRadius: "50%",
                      background: isHov ? myColor + "22" : EMPTY,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: isHov
                        ? "inset 0 3px 10px rgba(0,0,0,0.55), 0 0 10px " + myColor + "33"
                        : "inset 0 3px 10px rgba(0,0,0,0.55)",
                      cursor: interactive ? "pointer" : "default",
                      transition: "background 0.12s, box-shadow 0.12s",
                      overflow: "hidden",
                    }}
                  >
                    <AnimatePresence>
                      {cell !== 0 && color && (
                        <motion.div
                          key={r + "-" + c + "-" + cell}
                          initial={isNew ? { y: "-400%", scale: 0.85 } : { scale: 1 }}
                          animate={{
                            y: "0%",
                            scale: isWin ? [1, 1.18, 1] : 1,
                          }}
                          transition={isNew
                            ? {
                                y: { type: "spring", stiffness: 520, damping: 26, mass: 0.9 },
                                scale: isWin
                                  ? { delay: 0.3, duration: 0.65, repeat: Infinity, repeatDelay: 0.55 }
                                  : { duration: 0 },
                              }
                            : {
                                scale: isWin
                                  ? { delay: 0.3, duration: 0.65, repeat: Infinity, repeatDelay: 0.55 }
                                  : { duration: 0 },
                              }
                          }
                          style={{
                            width: "84%",
                            height: "84%",
                            borderRadius: "50%",
                            background: "radial-gradient(circle at 32% 30%, " + color + "ff 0%, " + color + "cc 60%, " + color + "99 100%)",
                            boxShadow: isWin
                              ? "0 0 0 2.5px #fff, 0 0 14px " + color + ", 0 0 30px " + color + "88"
                              : "0 0 8px " + color + "55, inset 0 -3px 6px rgba(0,0,0,0.25)",
                          }}
                        />
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* ── End panel ── */}
      <AnimatePresence>
        {(phase === "won" || phase === "draw") && (
          <motion.div
            initial={{ y: 36, opacity: 0, scale: 0.94 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 24, delay: 0.3 }}
            style={{ ...glass, width: "100%", maxWidth: 390, marginTop: 22, padding: "24px 22px", textAlign: "center" }}
          >
            {phase === "won" && (
              <>
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 0.65, delay: 0.45 }}
                  style={{ fontSize: 40, marginBottom: 10 }}
                >
                  {winner === mySlot ? "🏆" : "😅"}
                </motion.div>
                <p style={{ color: "#fff", fontFamily: "Cormorant Garamond, serif", fontSize: 23, fontWeight: 600, margin: "0 0 6px" }}>
                  {winner === mySlot ? "Tu as gagné !" : (winner === 1 ? p1Name : p2Name) + " gagne !"}
                </p>
                {winner !== mySlot && (
                  <>
                    <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.09em" }}>Ton gage</p>
                    <p style={{ color: "rgba(255,255,255,0.88)", fontSize: 16, fontStyle: "italic", margin: "0 0 22px", lineHeight: 1.5 }}>"{gage}"</p>
                    <button
                      onClick={onDareDone}
                      style={{
                        width: "100%", padding: "14px 0", borderRadius: 16, border: "none", cursor: "pointer",
                        background: "linear-gradient(135deg, " + ROSE + "ee, " + ROSE + "99)",
                        color: "#fff", fontSize: 15, fontWeight: 700,
                        boxShadow: "0 6px 24px " + ROSE + "55",
                      }}
                    >
                      Gage accompli ✅
                    </button>
                  </>
                )}
                {winner === mySlot && (
                  <>
                    <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, margin: "0 0 18px" }}>
                      {isHost ? "Tu veux te battre encore ?" : "En attente de " + otherName + "…"}
                    </p>
                    {isHost && (
                      <button
                        onClick={restart}
                        style={{
                          width: "100%", padding: "14px 0", borderRadius: 16, cursor: "pointer",
                          background: "rgba(255,255,255,0.09)", border: "1px solid rgba(255,255,255,0.16)",
                          color: "rgba(255,255,255,0.85)", fontSize: 15, fontWeight: 600,
                        }}
                      >
                        Revanche 🔄
                      </button>
                    )}
                  </>
                )}
              </>
            )}

            {phase === "draw" && (
              <>
                <div style={{ fontSize: 40, marginBottom: 10 }}>🤝</div>
                <p style={{ color: "#fff", fontFamily: "Cormorant Garamond, serif", fontSize: 23, fontWeight: 600, margin: "0 0 6px" }}>Égalité parfaite !</p>
                <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, margin: "0 0 20px" }}>
                  {isHost ? "On remet ça ?" : "En attente de " + otherName + "…"}
                </p>
                {isHost && (
                  <button
                    onClick={restart}
                    style={{
                      width: "100%", padding: "14px 0", borderRadius: 16, cursor: "pointer",
                      background: "rgba(255,255,255,0.09)", border: "1px solid rgba(255,255,255,0.16)",
                      color: "rgba(255,255,255,0.85)", fontSize: 15, fontWeight: 600,
                    }}
                  >
                    Revanche 🔄
                  </button>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
