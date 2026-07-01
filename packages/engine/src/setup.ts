/**
 * Match setup + deck construction (T-08 support). Pure: given players + seed, produces the
 * initial server-authoritative GameState. The room calls this once; the seed makes the
 * whole match reproducible.
 *
 * Deck sizes/copies for Attributs and the Action deck are ⟨TRANSCRIBE⟩-adjacent (the real
 * counts come from the physical card set). Values here are playable defaults for Phase 1.
 */
import { ALL_GODS, GODS } from './data/gods.js';
import { makeRng, shuffle } from './rng.js';
import {
  COULEURS_YEUX,
  GENRES,
  GOD_IDS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  PANTHEONS,
  QUESTION_SLOTS,
} from './types.js';
import type {
  ActionCard,
  AttributCard,
  Board,
  GameState,
  GodId,
  PlayerState,
  PouvoirCard,
  UserId,
} from './types.js';

export interface SeatInput {
  userId: UserId;
  displayName: string;
}

/** Placeholder deck-copy counts (⟨TRANSCRIBE⟩ from the physical set). */
const ATTRIBUT_COPIES = 3;

let cardSeq = 0;
function cid(prefix: string): string {
  return `${prefix}_${(cardSeq++).toString(36)}`;
}

/** Build the full Attribut question deck: one card per (axe, valeur), × copies. */
export function buildAttributDeck(): AttributCard[] {
  cardSeq = 0;
  const cards: AttributCard[] = [];
  const push = (axe: AttributCard['axe'], valeur: AttributCard['valeur']) => {
    for (let c = 0; c < ATTRIBUT_COPIES; c++) {
      cards.push({ id: cid('attr'), type: 'attribut', axe, valeur });
    }
  };
  for (const g of GENRES) push('genre', g);
  for (const y of COULEURS_YEUX) push('couleurYeux', y);
  for (const p of PANTHEONS) push('pantheon', p);
  return cards;
}

/**
 * Build the Action deck. Real Non/Spéciale effects are ⟨TRANSCRIBE⟩ (empty registry), so we
 * seed structurally-valid Multiple cards (4-god questions) to keep the action economy alive
 * for Phase 1. Phase 2 replaces this with the transcribed catalogue.
 */
export function buildActionDeck(): ActionCard[] {
  const cards: ActionCard[] = [];
  // A handful of Multiple cards over rotating 4-god windows.
  for (let i = 0; i < GOD_IDS.length; i++) {
    const gods: GodId[] = [0, 1, 2, 3].map((k) => GOD_IDS[(i + k) % GOD_IDS.length]!);
    cards.push({ id: cid('act'), type: 'action', subtype: 'multiple', gods, effectKey: `multiple_${i}` });
  }
  return cards;
}

/** 12 Pouvoir cards, keyed to the registry. */
export function buildPouvoirDeck(): PouvoirCard[] {
  return Array.from({ length: 12 }, (_, i) => {
    const key = `pouvoir_${String(i + 1).padStart(2, '0')}`;
    return { id: cid('pow'), type: 'pouvoir', effectKey: key } satisfies PouvoirCard;
  });
}

function emptyBoard(): Board {
  return { questionSlots: Array.from({ length: QUESTION_SLOTS }, () => null), specialSlot: null };
}

export interface CardIndex {
  attributs: Map<string, AttributCard>;
  actions: Map<string, ActionCard>;
  pouvoirs: Map<string, PouvoirCard>;
}

export interface SetupResult {
  state: GameState;
  /** Card lookup so the server/room can resolve CardId -> card object for intents. */
  index: CardIndex;
}

/**
 * Create the initial in-progress GameState. Deals one secret god per seat, builds+shuffles
 * decks, gives each player a starting power, seats clockwise. Throws on bad player count.
 */
export function createGame(roomId: string, seats: SeatInput[], seed: number): SetupResult {
  if (seats.length < MIN_PLAYERS || seats.length > MAX_PLAYERS) {
    throw new Error(`Player count must be ${MIN_PLAYERS}..${MAX_PLAYERS}, got ${seats.length}`);
  }
  const rng = makeRng(seed);

  const attributDeck = shuffle(buildAttributDeck(), rng);
  const actionDeck = shuffle(buildActionDeck(), rng);
  const pouvoirDeck = shuffle(buildPouvoirDeck(), rng);

  // Deal secret gods.
  const godPool = shuffle(ALL_GODS.map((g) => g.id), rng);

  const players: Record<UserId, PlayerState> = {};
  const boardBySeat: Record<UserId, Board> = {};
  const seatOrder: UserId[] = [];

  const index: CardIndex = {
    attributs: new Map(attributDeck.map((c) => [c.id, c])),
    actions: new Map(actionDeck.map((c) => [c.id, c])),
    pouvoirs: new Map(pouvoirDeck.map((c) => [c.id, c])),
  };

  const pouvoirPile = pouvoirDeck.map((c) => c.id);

  seats.forEach((seat, i) => {
    const god = godPool[i]!;
    const startPower = pouvoirPile.pop()!; // each player begins with exactly one power
    players[seat.userId] = {
      userId: seat.userId,
      displayName: seat.displayName,
      connected: true,
      alive: true,
      god,
      hand: { attributs: [], actions: [] },
      powers: [startPower],
    };
    boardBySeat[seat.userId] = emptyBoard();
    seatOrder.push(seat.userId);
  });

  const state: GameState = {
    roomId,
    status: 'enCours',
    players,
    seatOrder,
    meneurIndex: 0,
    tour: 1,
    phase: 'pioche',
    barrier: { phase: 'pioche', submitted: [], deadline: null },
    drawPiles: {
      attributs: attributDeck.map((c) => c.id),
      actions: actionDeck.map((c) => c.id),
      pouvoirs: pouvoirPile,
    },
    discard: { attributs: [], actions: [], pouvoirs: [] },
    boardBySeat,
    declarations: [],
    winner: null,
    eliminated: [],
  };

  return { state, index };
}

export { GODS };
