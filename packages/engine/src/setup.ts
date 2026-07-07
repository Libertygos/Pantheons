/**
 * Match setup + deck construction (T-08 support). Pure: given players + seed, produces the
 * initial server-authoritative GameState. The room calls this once; the seed makes the
 * whole match reproducible.
 *
 * Deck composition follows docs/card-catalog.md (12 Personnages, 9×4 Attributs, 27 Actions,
 * 12 Pouvoirs) — fully transcribed 2026-07-07. Card ids are SELF-DESCRIBING
 * (`attr_<valeur>_<n>`, `act_<effectKey>`, `pow_<effectKey>`) so effects can reason about
 * identities without a CardIndex (effects.ts).
 */
import { ACTIONS } from './data/actions.js';
import { ALL_GODS, GODS } from './data/gods.js';
import { POWER_KEYS } from './data/powers.js';
import { makeRng, shuffle } from './rng.js';
import {
  COULEURS_YEUX,
  GENRES,
  MAX_PLAYERS,
  MIN_PLAYERS,
  PANTHEONS,
} from './types.js';
import type {
  ActionCard,
  AttributCard,
  Board,
  GameState,
  PlayerState,
  PouvoirCard,
  UserId,
} from './types.js';

export interface SeatInput {
  userId: UserId;
  displayName: string;
}

/** 4 copies of each of the 9 Attribut faces = 36 cards (docs/card-catalog.md §2). */
const ATTRIBUT_COPIES = 4;

/** Build the full Attribut question deck: one card per (axe, valeur), × copies. */
export function buildAttributDeck(): AttributCard[] {
  const cards: AttributCard[] = [];
  const push = (axe: AttributCard['axe'], valeur: AttributCard['valeur']) => {
    for (let c = 0; c < ATTRIBUT_COPIES; c++) {
      cards.push({ id: `attr_${valeur}_${c + 1}`, type: 'attribut', axe, valeur });
    }
  };
  for (const g of GENRES) push('genre', g);
  for (const y of COULEURS_YEUX) push('couleurYeux', y);
  for (const p of PANTHEONS) push('pantheon', p);
  return cards;
}

/**
 * Build the full 27-card Action deck (9 Non / 9 Multiple / 9 Spéciale, one copy each)
 * straight from the transcribed registry (data/actions.ts).
 */
export function buildActionDeck(): ActionCard[] {
  return Object.values(ACTIONS).map((def) => ({
    id: `act_${def.effectKey}`,
    type: 'action',
    subtype: def.subtype,
    effectKey: def.effectKey,
    ...(def.gods ? { gods: [...def.gods] } : {}),
    ...(def.axe ? { axe: def.axe, valeur: def.valeur } : {}),
    ...(def.triggerPhase ? { triggerPhase: def.triggerPhase } : {}),
  }) satisfies ActionCard);
}

/** The 12 Pouvoir cards, keyed to the registry (docs/card-catalog.md §4). */
export function buildPouvoirDeck(): PouvoirCard[] {
  return POWER_KEYS.map((key) => ({ id: `pow_${key}`, type: 'pouvoir', effectKey: key }) satisfies PouvoirCard);
}

function emptyBoard(): Board {
  // Indexed by the TARGET's GLOBAL seat (0..MAX_PLAYERS-1); the owner's own index stays
  // unused — the physical board's 6 numbered slots cover the up-to-6 opponents.
  return { questionSlots: Array.from({ length: MAX_PLAYERS }, () => []), specialSlot: null };
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
      clonedPowerKey: null,
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
    undealtGods: godPool.slice(seats.length),
    effets: {
      questionsMaxOverride: {},
      sameTargetOkTour: {},
      askBlockedTour: {},
      executionIntent: {},
      watchPersonnage: {},
      powerUsedTour: {},
    },
    lastTurn: { ouiFor: {}, nonAnswerers: {} },
  };

  return { state, index };
}

export { GODS };
