import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { Button } from "@/components/ui/button";
import { supabase as _supabase } from "@/integrations/supabase/client";
import type { Room } from "@/lib/use-room-state";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any;

const ROWS = 6;
const COLS = 7;

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

type Board = number[][]; // 0=vide, 1=slot1, 2=slot2

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
  return null; // colonne pleine
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

export function P4Game({ room, mySlot, myName, otherName, onBackToMenu, onDareDone }: Props) {
  const raw = (room.minigame_state ?? {}) as P4State;
  const phase = raw.phase ?? "playing";
  const board = raw.board ?? emptyBoard();
  const turn = raw.turn ?? 1;
  const winner = raw.winner;
  const winCells = raw.winning_cells ?? [];
  const gage = raw.gage ?? "";
  const lastCol = raw.last_col;
  const lastRow = raw.last_row;

  const isMyTurn = turn === mySlot;
  const isHost = mySlot === 1;
  const [hoverCol, setHoverCol] = useState<number | null>(null);
  const [dropping, setDropping] = useState(false);
  const confettiFired = useRef(false);

  // Init board si vide (host seulement)
  useEffect(() => {
    if (!isHost) return;
    if (!raw.phase) {
      void supabase.from("rooms").update({
        minigame_state: {
          phase: "playing",
          board: emptyBoard(),
          turn: 1,
          gage: pickDare(),
        } as P4State,
      }).eq("id", room.id);
    }
  }, [isHost, room.id, raw.phase]);

  // Confettis si victoire
  useEffect(() => {
    if (phase === "won" && winner === mySlot && !confettiFired.current) {
      confettiFired.current = true;
      void confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 }, colors: ["#e88aab", "#f8c8d8", "#fff"] });
    }
  }, [phase, winner, mySlot]);

  async function playCol(col: number) {
    if (!isMyTurn || phase !== "playing" || dropping) return;
    const result = dropPiece(board, col, mySlot);
    if (!result) return; // colonne pleine

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

  function handleDare() {
    onDareDone();
  }

  function restart() {
    if (!isHost) return;
    confettiFired.current = false;
    void supabase.from("rooms").update({
      minigame_state: {
        phase: "playing",
        board: emptyBoard(),
        turn: 1,
        gage: pickDare(),
      } as P4State,
    }).eq("id", room.id);
  }

  function isWinCell(r: number, c: number) {
    return winCells.some(([wr, wc]) => wr === r && wc === c);
  }

  const p1Color = "bg-rose-400";
  const p2Color = "bg-blue-400";
  const p1Emoji = "❤️";
  const p2Emoji = "💙";

  return (
    <div className="flex min-h-screen flex-col items-center justify-between bg-gradient-to-b from-rose-50 to-pink-50 px-4 pb-8 pt-6">

      {/* Header */}
      <div className="w-full max-w-sm">
        <div className="mb-4 flex items-center justify-between">
          <button onClick={onBackToMenu} className="text-xs text-muted-foreground hover:text-foreground">
            ← Menu
          </button>
          <h2 className="font-serif text-2xl text-primary">Puissance 4</h2>
          <div className="w-12" />
        </div>

        {/* Scores / tour */}
        <div className="mb-4 flex items-center justify-between rounded-2xl bg-white/70 px-4 py-3 shadow-sm">
          <div className="text-center">
            <p className="text-lg">{p1Emoji}</p>
            <p className="text-xs font-medium">{mySlot === 1 ? myName : otherName}</p>
          </div>
          <div className="text-center">
            <AnimatePresence mode="wait">
              {phase === "playing" ? (
                <motion.p key="turn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm font-semibold text-primary">
                  {isMyTurn ? "À toi 👆" : `${otherName}…`}
                </motion.p>
              ) : phase === "won" ? (
                <motion.p key="won" initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="text-sm font-bold text-primary">
                  {winner === mySlot ? "Tu gagnes 🎉" : `${otherName} gagne`}
                </motion.p>
              ) : (
                <motion.p key="draw" className="text-sm font-semibold text-muted-foreground">Égalité 🤝</motion.p>
              )}
            </AnimatePresence>
          </div>
          <div className="text-center">
            <p className="text-lg">{p2Emoji}</p>
            <p className="text-xs font-medium">{mySlot === 2 ? myName : otherName}</p>
          </div>
        </div>
      </div>

      {/* Grille */}
      <div className="w-full max-w-sm">
        {/* Indicateur colonne hover */}
        <div className="mb-1 flex">
          {Array.from({ length: COLS }).map((_, c) => (
            <div key={c} className="flex flex-1 justify-center">
              <AnimatePresence>
                {hoverCol === c && isMyTurn && phase === "playing" && (
                  <motion.div
                    initial={{ y: -6, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -6, opacity: 0 }}
                    className="text-base"
                  >
                    {mySlot === 1 ? p1Emoji : p2Emoji}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>

        {/* Board */}
        <div
          className="overflow-hidden rounded-3xl bg-primary/90 p-2 shadow-2xl"
          onMouseLeave={() => setHoverCol(null)}
        >
          {board.map((row, r) => (
            <div key={r} className="flex gap-1 mb-1 last:mb-0">
              {row.map((cell, c) => {
                const isWin = isWinCell(r, c);
                const isNew = r === lastRow && c === lastCol;
                return (
                  <motion.button
                    key={c}
                    className="flex flex-1 aspect-square items-center justify-center rounded-full bg-white/20 text-lg sm:text-xl"
                    style={{ minWidth: 0 }}
                    onClick={() => playCol(c)}
                    onMouseEnter={() => setHoverCol(c)}
                    whileTap={isMyTurn && phase === "playing" ? { scale: 0.92 } : {}}
                  >
                    <AnimatePresence>
                      {cell !== 0 && (
                        <motion.div
                          key={`${r}-${c}-${cell}`}
                          initial={isNew ? { y: -120, opacity: 0 } : { opacity: 1 }}
                          animate={{
                            y: 0,
                            opacity: 1,
                            scale: isWin ? [1, 1.25, 1] : 1,
                          }}
                          transition={{
                            y: { type: "spring", stiffness: 300, damping: 20 },
                            scale: isWin ? { delay: 0.2, duration: 0.5, repeat: Infinity, repeatDelay: 0.5 } : {},
                          }}
                          className={`flex h-full w-full items-center justify-center rounded-full text-base sm:text-xl ${
                            isWin ? "ring-2 ring-yellow-300 ring-offset-1" : ""
                          }`}
                        >
                          {cell === 1 ? p1Emoji : p2Emoji}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Footer — fin de partie */}
      <div className="w-full max-w-sm">
        <AnimatePresence>
          {(phase === "won" || phase === "draw") && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="mt-4 overflow-hidden rounded-3xl bg-white/80 p-5 shadow-lg text-center"
            >
              {phase === "won" && winner !== mySlot && (
                <>
                  <p className="mb-1 text-2xl">😅</p>
                  <p className="mb-1 font-serif text-lg text-primary">Ton gage :</p>
                  <p className="mb-4 text-sm font-medium text-foreground">"{gage}"</p>
                  <Button onClick={handleDare} className="w-full rounded-2xl">
                    Gage accompli ✅
                  </Button>
                </>
              )}
              {phase === "won" && winner === mySlot && (
                <>
                  <p className="mb-1 text-2xl">🎉</p>
                  <p className="mb-3 font-serif text-lg text-primary">Tu as gagné !</p>
                  {isHost && (
                    <Button onClick={restart} variant="outline" className="w-full rounded-2xl">
                      Revanche 🔄
                    </Button>
                  )}
                </>
              )}
              {phase === "draw" && (
                <>
                  <p className="mb-1 text-2xl">🤝</p>
                  <p className="mb-3 font-serif text-lg text-primary">Égalité parfaite !</p>
                  {isHost && (
                    <Button onClick={restart} variant="outline" className="w-full rounded-2xl">
                      Revanche 🔄
                    </Button>
                  )}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
