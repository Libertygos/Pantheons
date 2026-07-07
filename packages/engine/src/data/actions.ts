/**
 * Action cards catalogue (T-07) — TRANSCRIBED from the card faces on 2026-07-07
 * (docs/card-catalog.md §3, verbatim texts + erratas §7). Identities keyed on the asset
 * filenames (card_actions_<subtype>_<n>.webp).
 *
 * - Non: carries its OWN question (one per attribute value — the 9 values are covered)
 *   plus a malus hitting the ANSWERER on « non ».
 * - Multiple: pure 4-god membership question (« Êtes vous l'un de ces personnages? »),
 *   no additional effect. Sets verbatim from the faces (names authoritative — §7 E2/E3).
 * - Spéciale: non-question; fires at the start of its printed phase then discards.
 *   `apply` ctx: `other` = resolved placement target, `payload` = placement choices.
 */
import type { Axe, AxeValeur, GameState, GodId, Phase, SpecialePayload, UserId } from '../types.js';
import {
  discardPlacedQuestion,
  discardPowers,
  livePlayers,
  swapPowers,
  takeAttributsFromPile,
  takePowerFromPile,
  transferHandCards,
} from '../effects.js';

export interface ActionDef {
  effectKey: string;
  subtype: 'non' | 'multiple' | 'speciale';
  /** FR chrome label (the face image remains the displayed artifact). */
  label: string;
  /** Verbatim effect/question text from the face (documentation + fallback tile). */
  texte: string;
  /** Non: the question payload (axe + valeur). */
  axe?: Axe;
  valeur?: AxeValeur;
  /** Multiple: the 4-god set. */
  gods?: GodId[];
  /** Spéciale: phase at whose start it triggers. */
  triggerPhase?: Phase;
  /** Spéciale: placement must name a target player (spéciales 1, 5, 6). */
  needsTarget?: boolean;
  /** Effect body. Non: actor = asker, other = answerer. Spéciale: actor = owner. */
  apply?: (state: GameState, actor: UserId, ctx?: { other?: UserId; payload?: SpecialePayload }) => void;
}

const donnezDeuxCartes = (state: GameState, asker: UserId, ctx?: { other?: UserId }) => {
  if (ctx?.other) transferHandCards(state, ctx.other, asker, 2);
};
const echangePouvoir = (state: GameState, asker: UserId, ctx?: { other?: UserId }) => {
  if (ctx?.other) swapPowers(state, asker, ctx.other);
};
const defaussePouvoir = (state: GameState, _asker: UserId, ctx?: { other?: UserId }) => {
  if (ctx?.other) discardPowers(state, ctx.other);
};

function non(n: number, axe: Axe, valeur: AxeValeur, question: string, effet: string,
  apply: ActionDef['apply']): [string, ActionDef] {
  const key = `action_non_${n}`;
  return [key, { effectKey: key, subtype: 'non', label: `Non ${n}`, texte: `${question} — ${effet}`, axe, valeur, apply }];
}

function multiple(n: number, gods: GodId[]): [string, ActionDef] {
  const key = `action_multiple_${n}`;
  return [key, {
    effectKey: key, subtype: 'multiple', label: `Multiple ${n}`,
    texte: `« Êtes vous l'un de ces personnages? » — ${gods.join(', ')}`,
    gods,
  }];
}

function speciale(n: number, triggerPhase: Phase, texte: string,
  apply: ActionDef['apply'], needsTarget = false): [string, ActionDef] {
  const key = `action_special_${n}`;
  return [key, { effectKey: key, subtype: 'speciale', label: `Spéciale ${n}`, texte, triggerPhase, needsTarget, apply }];
}

const EFFET_DONNEZ = '« Si vous répondez non, donnez deux de vos cartes au joueur qui vous a posé la question. »';
const EFFET_ECHANGE = '« Si vous répondez non, échangez votre pouvoir avec le joueur qui vous a posé la question. »';
const EFFET_DEFAUSSE = '« Si vous répondez non, défaussez votre pouvoir. »';

/** The 27 real action-card identities — transcribed (docs/card-catalog.md §3). */
export const ACTIONS: Record<string, ActionDef> = Object.fromEntries([
  // ---- Non (9) — the 9 attribute values, one question each --------------------
  non(1, 'genre', 'feminin', '« Êtes vous un personnage féminin? »', EFFET_DONNEZ, donnezDeuxCartes),
  non(2, 'genre', 'masculin', '« Êtes vous un personnage masculin? »', EFFET_DONNEZ, donnezDeuxCartes),
  non(3, 'pantheon', 'egyptien', '« Faites vous partie du Panthéon Egyptien? »', EFFET_ECHANGE, echangePouvoir),
  non(4, 'pantheon', 'grec', '« Faites vous partie du Panthéon Grec? »', EFFET_ECHANGE, echangePouvoir),
  non(5, 'pantheon', 'hindou', '« Faites vous partie du Panthéon Hindou? »', EFFET_ECHANGE, echangePouvoir),
  non(6, 'pantheon', 'nordique', '« Faites vous partie du Panthéon Nordique? »', EFFET_ECHANGE, echangePouvoir),
  non(7, 'couleurYeux', 'rouges', '« Avez vous les yeux rouges? »', EFFET_DEFAUSSE, defaussePouvoir),
  non(8, 'couleurYeux', 'verts', '« Avez vous les yeux verts? »', EFFET_DEFAUSSE, defaussePouvoir),
  non(9, 'couleurYeux', 'bleus', '« Avez vous les yeux bleus? »', EFFET_DEFAUSSE, defaussePouvoir),

  // ---- Multiple (9) — sets verbatim from the faces ---------------------------
  multiple(1, ['brahma', 're', 'zeus', 'loki']),
  multiple(2, ['ganesh', 'bastet', 'athena', 'odin']),
  multiple(3, ['sarasvati', 'isis', 'artemis', 'frigg']),
  multiple(4, ['brahma', 'odin', 'ganesh', 'frigg']),
  multiple(5, ['sarasvati', 'zeus', 'isis', 'loki']),
  multiple(6, ['athena', 're', 'artemis', 'bastet']),
  multiple(7, ['brahma', 'isis', 'athena', 'loki']),
  multiple(8, ['ganesh', 're', 'artemis', 'odin']),
  multiple(9, ['sarasvati', 'zeus', 'bastet', 'frigg']),

  // ---- Spéciale (9) — printed trigger phase + effect -------------------------
  speciale(1, 'reponse',
    '« Choisissez un joueur. S’il vous répond oui ce tour ci, regardez sa carte personnage. »',
    (state, owner, ctx) => {
      if (ctx?.other) state.effets.watchPersonnage[owner] = { target: ctx.other, tour: state.tour };
    }, true),
  speciale(2, 'reponse',
    '« Choisissez deux cartes questions posées et défaussez les. »',
    // v1 (consigné) : priorité aux questions qui CIBLENT le propriétaire, puis les autres.
    (state, owner) => {
      const ownerSeat = state.seatOrder.indexOf(owner);
      let remaining = 2;
      for (const pass of [true, false]) {
        if (remaining === 0) break;
        for (const placer of state.seatOrder) {
          const board = state.boardBySeat[placer];
          if (!board) continue;
          for (let seat = 0; seat < board.questionSlots.length && remaining > 0; seat++) {
            if (pass !== (seat === ownerSeat)) continue;
            while (remaining > 0 && board.questionSlots[seat]!.length > 0) {
              if (discardPlacedQuestion(state, placer, seat, 0)) remaining--;
            }
          }
        }
      }
    }),
  speciale(3, 'question',
    '« Vous pouvez poser autant de questions qu’il y’a de joueurs pendant la prochaine phase de question. »',
    (state, owner) => {
      state.effets.questionsMaxOverride[owner] = { max: livePlayers(state).length, tour: state.tour };
    }),
  speciale(4, 'reponse',
    '« Prenez une question posée et mettez la dans votre case question (vous pouvez la regarder). »',
    // v1 (consigné) : prend la première question posée CONTRE le propriétaire et la met
    // dans sa main (approximation de « votre case question » — à raffiner si besoin).
    (state, owner) => {
      const ownerSeat = state.seatOrder.indexOf(owner);
      const me = state.players[owner];
      if (!me) return;
      for (const placer of state.seatOrder) {
        const stack = state.boardBySeat[placer]?.questionSlots[ownerSeat];
        const placed = stack?.[0];
        if (!stack || !placed) continue;
        stack.splice(0, 1);
        if (placed.card.type === 'attribut') me.hand.attributs.push(placed.card.id);
        else me.hand.actions.push(placed.card.id);
        return;
      }
    }),
  speciale(5, 'pioche',
    '« Le joueur de votre choix se défausse de son pouvoir. »',
    (state, _owner, ctx) => {
      if (ctx?.other) discardPowers(state, ctx.other);
    }, true),
  speciale(6, 'pioche',
    '« Echangez votre pouvoir contre celui d’un autre joueur. »',
    (state, owner, ctx) => {
      if (ctx?.other) swapPowers(state, owner, ctx.other);
    }, true),
  speciale(7, 'pioche',
    '« Prenez le pouvoir de votre choix dans la pile pouvoir. »',
    (state, owner, ctx) => takePowerFromPile(state, owner, ctx?.payload?.pouvoirChoisi)),
  speciale(8, 'pioche',
    '« Prenez deux cartes attributs de votre choix dans la pile attribut. »',
    (state, owner, ctx) => takeAttributsFromPile(state, owner, ctx?.payload?.attributsChoisis)),
  speciale(9, 'pioche',
    '« Jusqu’au prochain tour vous pouvez poser deux questions au même joueur. »',
    (state, owner) => {
      state.effets.sameTargetOkTour[owner] = state.tour;
    }),
]);

export const ACTION_KEYS = Object.keys(ACTIONS);

export function getAction(effectKey: string): ActionDef | undefined {
  return ACTIONS[effectKey];
}
