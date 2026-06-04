// 💕 Contenu du jeu — modifiable facilement ici 💕

export const DEFAULT_NAMES = ["Toi", "Eloise"] as const;

export const QUESTIONS_PHASE1: { self: string; about: (name: string) => string }[] = [
  {
    self: "Ton film préféré ?",
    about: (n) => `Quel est le film préféré de ${n} ?`,
  },
  {
    self: "Ton plat préféré ?",
    about: (n) => `Quel est le plat préféré de ${n} ?`,
  },
  {
    self: "Ta chanson du moment ?",
    about: (n) => `Quelle est la chanson du moment de ${n} ?`,
  },
  {
    self: "Ce que tu aimes le plus faire avec moi ?",
    about: (n) => `Ce que ${n} aime le plus faire avec toi ?`,
  },
  {
    self: "Ton défaut mignon préféré chez moi ?",
    about: (n) => `Quel défaut mignon ${n} préfère chez toi ?`,
  },
  {
    self: "Ton souvenir préféré à deux ?",
    about: (n) => `Le souvenir préféré de ${n} avec toi ?`,
  },
  {
    self: "Ta destination de rêve à deux ?",
    about: (n) => `La destination de rêve de ${n} avec toi ?`,
  },
  {
    self: "Ton petit surnom préféré ?",
    about: (n) => `Le petit surnom préféré de ${n} ?`,
  },
];

// Banque de leurres par question (index aligné avec QUESTIONS_PHASE1)
export const LEURRES: string[][] = [
  // film
  ["Titanic", "Le Roi Lion", "La La Land", "Fast & Furious 7", "un film d'horreur trop flippant"],
  // plat
  ["des sushis", "une raclette", "un kebab à 3h du mat", "des pâtes au beurre", "une pizza 4 fromages"],
  // chanson
  ["un truc de Stromae", "la chanson de Frozen", "du Beyoncé", "un vieux son de PNL", "une chanson de Disney"],
  // ce que tu aimes faire avec moi
  ["faire des câlins sur le canap'", "regarder des séries au lit", "cuisiner ensemble", "se balader la main dans la main", "faire la sieste collés-serrés"],
  // défaut mignon
  ["quand tu râles le matin", "ta tête au réveil", "quand tu chantes faux", "ton rire bizarre", "ta façon de bouder 5 minutes"],
  // souvenir
  ["notre premier baiser", "ce week-end à la mer", "la fois où on a trop ri", "notre premier voyage", "ce dîner aux chandelles improvisé"],
  // destination
  ["le Japon", "la Grèce", "l'Italie", "Bali", "un chalet à la montagne"],
  // surnom
  ["mon cœur", "bébé", "doudou", "chouchou", "mon amour"],
];

export const GAGES: string[] = [
  "Fais un câlin de 20 secondes 🤗",
  "Envoie un vocal trop mignon 🎤",
  "Fais un compliment sincère 💌",
  "Imite ton/ta partenaire 🎭",
  "Danse 15 secondes sans musique 💃",
  "Raconte ton souvenir préféré de nous deux 💕",
  "Fais un bisou sur le front 😘",
  "Dis 3 qualités de l'autre ✨",
  "Chante le refrain d'une chanson d'amour 🎶",
  "Fais un dessin de vous deux (30s chrono) 🎨",
  "Écris un mini poème improvisé 📝",
  "Donne un bisou esquimau 👃",
  "Fais ta plus belle déclaration 💖",
  "Raconte ta première impression de moi 🥹",
  "Promets-moi un petit plaisir pour demain 🎁",
];

export const NB_TOURS_PHASE2 = 10; // 5 questions chacun
