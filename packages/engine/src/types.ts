/**
 * Panthéons engine — core types (T-05).
 *
 * Vocabulary is FIXED BY THE IMAGE ASSETS (French, immutable). Enum *keys* are ASCII-fold
 * of the verbatim names (see docs/glossary.md). Value sets are transcribed from the
 * pense-bête + attribute faces — docs/card-catalog.md is the source of truth.
 */

export type UserId = string;
export type CardId = string;

/** Known, closed set — derived from the roster grouping (safe without the image). */
export const PANTHEONS = ['hindou', 'grec', 'egyptien', 'nordique'] as const;
export type Pantheon = (typeof PANTHEONS)[number];

/**
 * Transcribed — the two genre Attribut faces are `masculin` / `feminin`
 * (card_attributs_masculin.webp / card_attributs_feminin.webp). See docs/card-catalog.md.
 */
export const GENRES = ['feminin', 'masculin'] as const;
export type Genre = (typeof GENRES)[number];

/**
 * Transcribed — closed eye-colour set from the pense-bête band legend and the three
 * colour Attribut faces (bleus / verts / rouges). Keys are verbatim asset plurals.
 * See docs/card-catalog.md §1–2.
 */
export const COULEURS_YEUX = ['bleus', 'verts', 'rouges'] as const;
export type CouleurYeux = (typeof COULEURS_YEUX)[number];

/** The 12 gods (enum keys; display labels are verbatim in data/gods.ts). */
export const GOD_IDS = [
  'brahma', 'ganesh', 'sarasvati',
  'zeus', 'athena', 'artemis',
  're', 'bastet', 'isis',
  'loki', 'odin', 'frigg',
] as const;
export type GodId = (typeof GOD_IDS)[number];

/** A god's full attribute triple — the entire deduction space. */
export interface God {
  id: GodId;
  /** Verbatim display name from the asset (accents included, e.g. "Rê"). */
  label: string;
  pantheon: Pantheon;
  genre: Genre;
  couleurYeux: CouleurYeux;
}

/** The three deduction axes an Attribut question can target. */
export type Axe = 'genre' | 'couleurYeux' | 'pantheon';
export type AxeValeur = Genre | CouleurYeux | Pantheon;

export type Phase = 'pioche' | 'question' | 'reponse';
export type ActionSubtype = 'non' | 'multiple' | 'speciale';

// ---- Cards -----------------------------------------------------------------

export interface AttributCard {
  id: CardId;
  type: 'attribut';
  axe: Axe;
  valeur: AxeValeur;
}

export interface ActionCard {
  id: CardId;
  type: 'action';
  subtype: ActionSubtype;
  /** For 'multiple': the 4-god set the question asks about. */
  gods?: GodId[];
  /** For 'speciale': the phase at whose START the card triggers. */
  triggerPhase?: Phase;
  /** Effect key resolved against data/actions.ts (effect text ⟨À_TRANSCRIRE⟩ — card-catalog.md §3). */
  effectKey: string;
}

export interface PouvoirCard {
  id: CardId;
  type: 'pouvoir';
  /** Effect key resolved against data/powers.ts (effect text ⟨À_TRANSCRIRE⟩ — card-catalog.md §4). */
  effectKey: string;
}

export type QuestionCard = AttributCard | ActionCard; // Spéciale is NOT a question (guarded in rules)
export type AnyCard = AttributCard | ActionCard | PouvoirCard;

// ---- Board & state ---------------------------------------------------------

export interface PlacedCard {
  card: QuestionCard;
  /** Seat index (0..5) of the targeted opponent on the placer's board. */
  targetSeat: number;
  answeredOui?: boolean; // set during réponse resolution (public result)
}

export interface Board {
  /** 6 numbered question slots (opponents 1..7 mapped by seat). */
  questionSlots: (PlacedCard | null)[];
  specialSlot: PlacedCard | null;
}

export interface PlayerState {
  userId: UserId;
  displayName: string;
  connected: boolean;
  alive: boolean;
  // ---- SECRET (never-send; only in owner's projection) ----
  god: GodId;
  hand: { attributs: CardId[]; actions: CardId[] };
  powers: CardId[];
}

export type RoomStatus = 'lobby' | 'enCours' | 'resolutionDeclaration' | 'terminee';

export interface BarrierState {
  phase: Phase;
  submitted: UserId[];
  /** ⟨INPUT WoG⟩ phase timeout; null = wait indefinitely for all live+connected. */
  deadline: number | null;
}

export interface Declaration {
  declarer: UserId;
  /** opponent userId -> guessed GodId */
  guesses: Record<UserId, GodId>;
}

export interface GameState {
  roomId: string;
  status: RoomStatus;
  players: Record<UserId, PlayerState>;
  seatOrder: UserId[];
  meneurIndex: number;
  tour: number;
  phase: Phase;
  barrier: BarrierState;
  drawPiles: { attributs: CardId[]; actions: CardId[]; pouvoirs: CardId[] };
  discard: { attributs: CardId[]; actions: CardId[]; pouvoirs: CardId[] };
  boardBySeat: Record<UserId, Board>;
  declarations: Declaration[];
  winner: UserId | null;
  eliminated: UserId[];
}

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 7;
export const QUESTION_SLOTS = 6;
export const MAX_QUESTIONS_PER_TURN = 2;
export const POWERS_PER_PLAYER = 1;
export const ATTRIBUTS_DRAWN_PER_TURN = 2;
