// 💕 Contenu du jeu — modifiable facilement ici 💕

export const DEFAULT_NAMES = ["Toi", "Eloise"] as const;

// ── Menu / Modes de jeu ──
export type ModeId = "quiz" | "minigames" | "mastermind" | "hangman" | "wouldyou" | "cupidon" | "paysville" | "mostlikely" | "riddles" | "full" | "edit_secrets";

export const MENU_TITLE = "Notre petit nid 💞";
export const MENU_SUBTITLE = "Choisis ce qu'on fait ensemble ✨";

export const MODES: { id: ModeId; emoji: string; title: string; subtitle: string; gradient: string }[] = [
  {
    id: "quiz",
    emoji: "💬",
    title: "Tu me connais ?",
    subtitle: "Questions à choix, gages à la clé",
    gradient: "from-pink-200/80 to-rose-300/80",
  },
  {
    id: "minigames",
    emoji: "🎮",
    title: "Mini-jeux",
    subtitle: "Duels rapides, perdant tire un gage",
    gradient: "from-emerald-200/80 to-teal-300/80",
  },
  {
    id: "mastermind",
    emoji: "🧩",
    title: "Mastermind",
    subtitle: "Devine le code coloré de l'autre",
    gradient: "from-sky-200/80 to-indigo-300/80",
  },
  {
    id: "hangman",
    emoji: "❤️",
    title: "Le Pendu",
    subtitle: "Devine le mot secret avant 💔",
    gradient: "from-rose-200/80 to-pink-300/80",
  },
  {
    id: "wouldyou",
    emoji: "💞",
    title: "Tu préfères ?",
    subtitle: "A ou B — jusqu'où iriez-vous ?",
    gradient: "from-fuchsia-200/80 to-rose-300/80",
  },
  {
    id: "cupidon",
    emoji: "💘",
    title: "Duel de Cupidon",
    subtitle: "Esquive les flèches… ou décoche-les",
    gradient: "from-red-200/80 to-rose-400/80",
  },
  {
    id: "paysville",
    emoji: "🌍",
    title: "Pays Ville",
    subtitle: "Petit Bac coquin — premier à crier STOP",
    gradient: "from-orange-200/80 to-rose-300/80",
  },
  {
    id: "mostlikely",
    emoji: "🤔",
    title: "Qui est le plus susceptible…",
    subtitle: "Votez en secret, désignez le coupable",
    gradient: "from-violet-200/80 to-fuchsia-300/80",
  },
  {
    id: "full",
    emoji: "🏆",
    title: "Partie complète",
    subtitle: "Le parcours entier avec Grand Défi",
    gradient: "from-amber-200/80 to-orange-300/80",
  },
  {
    id: "edit_secrets",
    emoji: "✏️",
    title: "Nos pièges",
    subtitle: "Crée tes questions & gages secrets",
    gradient: "from-violet-200/80 to-fuchsia-300/80",
  },
];


export const QUESTIONS_PHASE1: { self: string; about: (name: string) => string }[] = [
  { self: "Ton film préféré ?", about: (n) => `Quel est le film préféré de ${n} ?` },
  { self: "Ton plat préféré ?", about: (n) => `Quel est le plat préféré de ${n} ?` },
  { self: "Ta chanson du moment ?", about: (n) => `Quelle est la chanson du moment de ${n} ?` },
  { self: "Ce que tu aimes le plus faire avec moi ?", about: (n) => `Ce que ${n} aime le plus faire avec toi ?` },
  { self: "Ton défaut mignon préféré chez moi ?", about: (n) => `Quel défaut mignon ${n} préfère chez toi ?` },
  { self: "Ton souvenir préféré à deux ?", about: (n) => `Le souvenir préféré de ${n} avec toi ?` },
  { self: "Ta destination de rêve à deux ?", about: (n) => `La destination de rêve de ${n} avec toi ?` },
  { self: "Ton petit surnom préféré ?", about: (n) => `Le petit surnom préféré de ${n} ?` },
];

export const LEURRES: string[][] = [
  ["Titanic", "Le Roi Lion", "La La Land", "Fast & Furious 7", "un film d'horreur trop flippant"],
  ["des sushis", "une raclette", "un kebab à 3h du mat", "des pâtes au beurre", "une pizza 4 fromages"],
  ["un truc de Stromae", "la chanson de Frozen", "du Beyoncé", "un vieux son de PNL", "une chanson de Disney"],
  ["faire des câlins sur le canap'", "regarder des séries au lit", "cuisiner ensemble", "se balader la main dans la main", "faire la sieste collés-serrés"],
  ["quand tu râles le matin", "ta tête au réveil", "quand tu chantes faux", "ton rire bizarre", "ta façon de bouder 5 minutes"],
  ["notre premier baiser", "ce week-end à la mer", "la fois où on a trop ri", "notre premier voyage", "ce dîner aux chandelles improvisé"],
  ["le Japon", "la Grèce", "l'Italie", "Bali", "un chalet à la montagne"],
  ["mon cœur", "bébé", "doudou", "chouchou", "mon amour"],
];

export const NB_TOURS_PHASE2 = 6; // questions de la manche 1
export const NB_MINIGAMES_ROUND2 = 2;
export const NB_MINIGAMES_FINALE = 3;

// ── Gages à 3 niveaux ──
export type DareLevel = "simple" | "medium" | "ultra";

export const LEVEL_LABELS: Record<DareLevel, string> = {
  simple: "Gage simple 🟢",
  medium: "Gage moyen 🟡",
  ultra: "Gage ultra 🔴",
};

export const GAGES_SIMPLE: string[] = [
  "Fais un câlin de 15 secondes 🤗",
  "Dis 3 qualités de l'autre ✨",
  "Bisou sur le front 😘",
  "Fais un compliment sincère 💌",
  "Bisou esquimau 👃",
  "Imite ton/ta partenaire 🎭",
  "Fais une grimace mignonne 😜",
];

export const GAGES_MEDIUM: string[] = [
  "Massage d'1 minute 💆",
  "Chante un bout de chanson 🎶",
  "Envoie un vocal trop mignon 🎤",
  "Improvise une déclaration 💖",
  "Danse 30 secondes sans musique 💃",
  "Raconte ton plus beau souvenir de nous 💕",
  "Écris un mini poème improvisé 📝",
];

export const GAGES_ULTRA: string[] = [
  "Organise notre prochain rendez-vous de A à Z 🌹",
  "Petit-déj au lit demain matin 🥐",
  "Écris-moi une vraie lettre d'amour 💌",
  "Réalise un vœu de l'autre 🌟",
  "Massage complet 15 minutes 💆‍♀️",
  "Prépare son plat préféré dans la semaine 🍝",
];

export const GAGES_BY_LEVEL: Record<DareLevel, string[]> = {
  simple: GAGES_SIMPLE,
  medium: GAGES_MEDIUM,
  ultra: GAGES_ULTRA,
};

// Compat (anciennes refs)
export const GAGES = GAGES_SIMPLE;

// ── Jauge de complicité ──
export const COMPLICITY_MAX = 100;
export const COMPLICITY_GAINS = {
  correct: 8,
  dare_done: 5,
  minigame: 10,
  bonus: 15,
};

// ── Surprise finale (modifiable) ──
export const SURPRISE_TITRE = "💌 Ta surprise est débloquée !";
export const SURPRISE_FINALE = `Bon pour une soirée surprise rien que pour nous deux 💕

Lieu, dîner, activité : je m'occupe de tout.
Tu n'as qu'à dire "oui" et te laisser porter.

Je t'aime fort,
Pour toujours et plus encore. ❤️`;

// ── Phase secrète ──
export const NB_QUESTIONS_PERSO_MIN = 2;
export const NB_QUESTIONS_PERSO_MAX = 3;
export const NB_GAGES_PERSO_MIN = 1;
export const NB_GAGES_PERSO_MAX = 2;

export const SECRETS_TITRE = "Prépare tes pièges 🙈";
export const SECRETS_SOUS_TITRE = "Chut, ne montre pas ton écran à l'autre !";
export const BADGE_QUESTION_PERSO = (auteur: string) =>
  `💌 Question écrite spécialement pour toi par ${auteur}...`;
export const BADGE_GAGE_PERSO = (auteur: string) =>
  `💕 Gage spécial de ${auteur}`;

// ── Mini-jeux ──
export const MINIGAME_IDS = ["green", "culture", "rps", "memory"] as const;
export type MinigameId = (typeof MINIGAME_IDS)[number] | "tap"; // "tap" gardé seulement pour les anciennes parties en cours

export const MINIGAME_LABELS: Record<MinigameId, string> = {
  tap: "Mémoire des cœurs 💞",
  green: "Réflexe Feu Vert 🚦",
  culture: "Quiz Flash 🧠",
  rps: "Pierre-Feuille-Ciseaux ✌️",
  memory: "Mémoire des cœurs 💞",
};

export const MINIGAME_DESCRIPTIONS: Record<MinigameId, string> = {
  tap: "Mémorise la suite d'émojis, puis retrouve-la avant l'autre.",
  green: "Attends que l'écran devienne vert. Premier à taper gagne !",
  culture: "Une question surprise. Premier à répondre juste gagne.",
  rps: "Best-of-3. Choix simultané, qui va gagner ?",
  memory: "Mémorise la suite d'émojis, puis retrouve-la avant l'autre.",
};

export const HEART_MEMORY_SHOW_MS = 2600;
export const GREEN_MIN_DELAY_MS = 2000;
export const GREEN_MAX_DELAY_MS = 6000;
export const RPS_WINS_NEEDED = 2;

export const HEART_MEMORY_CARDS: { sequence: string[]; options: string[][] }[] = [
  {
    sequence: ["💋", "🌹", "🎵"],
    options: [["🌹", "💋", "🎵"], ["💋", "🌹", "🎵"], ["🎵", "🌹", "💋"], ["💋", "🎵", "🌹"]],
  },
  {
    sequence: ["🍓", "💌", "🌙"],
    options: [["🍓", "🌙", "💌"], ["💌", "🍓", "🌙"], ["🍓", "💌", "🌙"], ["🌙", "💌", "🍓"]],
  },
  {
    sequence: ["🧸", "✨", "☕"],
    options: [["✨", "🧸", "☕"], ["🧸", "☕", "✨"], ["☕", "✨", "🧸"], ["🧸", "✨", "☕"]],
  },
  {
    sequence: ["🌼", "🍿", "💕"],
    options: [["🌼", "🍿", "💕"], ["🍿", "🌼", "💕"], ["💕", "🍿", "🌼"], ["🌼", "💕", "🍿"]],
  },
];

export const CULTURE_QUESTIONS: { q: string; choices: string[]; correct: number }[] = [
  { q: "Combien de cœurs a une pieuvre ?", choices: ["1", "2", "3", "5"], correct: 2 },
  { q: "Quelle est la capitale de l'Australie ?", choices: ["Sydney", "Melbourne", "Canberra", "Perth"], correct: 2 },
  { q: "En quelle année l'homme a-t-il marché sur la Lune ?", choices: ["1959", "1965", "1969", "1972"], correct: 2 },
  { q: "Quel est le plus grand océan ?", choices: ["Atlantique", "Indien", "Arctique", "Pacifique"], correct: 3 },
  { q: "Qui a peint la Joconde ?", choices: ["Van Gogh", "Picasso", "Léonard de Vinci", "Monet"], correct: 2 },
  { q: "Combien de joueurs dans une équipe de foot sur le terrain ?", choices: ["9", "10", "11", "12"], correct: 2 },
  { q: "Quel animal est le symbole de la France ?", choices: ["Aigle", "Coq", "Lion", "Ours"], correct: 1 },
  { q: "Quelle planète est la plus proche du Soleil ?", choices: ["Vénus", "Mercure", "Mars", "Terre"], correct: 1 },
  { q: "Quel est le métal liquide à température ambiante ?", choices: ["Plomb", "Mercure", "Étain", "Argent"], correct: 1 },
  { q: "Combien de couleurs dans un arc-en-ciel ?", choices: ["5", "6", "7", "8"], correct: 2 },
];

// niveau de gage par stage
export const STAGE_DARE_LEVEL: Record<"round1" | "round2" | "finale", DareLevel> = {
  round1: "simple",
  round2: "medium",
  finale: "ultra",
};
