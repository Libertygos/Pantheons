/**
 * "Panthéons" declaration resolution (T-10, [OPUS 🔒]).
 *
 * The hidden-information reveal is the top security property. Resolution:
 *  - Multiple declarers resolve CLOCKWISE from the meneur.
 *  - A declarer wins iff EVERY live opponent's guess is exactly correct.
 *  - First mismatch eliminates that declarer; their card STAYS HIDDEN (never reveal an
 *    eliminated declarer's god).
 *  - If no declarer succeeds, play resumes.
 */
import { AMES_SOEURS_KEYS } from './data/powers.js';
import { effectivePowerKeys } from './effects.js';
import { seatOrderFromMeneur } from './rules.js';
import type { Declaration, GameState, UserId } from './types.js';

/**
 * Âmes sœurs (card-catalog.md §4) : « Quand vous réalisez votre Panthéon, si un autre
 * joueur possède le pouvoir de l'âme soeur, vous n'avez pas à deviner sa carte
 * personnage. » — the declarer must hold one of the two copies (Clonage copying it
 * counts, texte littéral « possède le pouvoir »); the exempted opponent is any OTHER
 * live holder. The exemption scores as an automatic match.
 */
function holdsAmesSoeurs(state: GameState, uid: UserId): boolean {
  return effectivePowerKeys(state, uid).some((k) => AMES_SOEURS_KEYS.includes(k));
}

export interface DeclarationOutcome {
  declarer: UserId;
  won: boolean;
  /**
   * Per-opponent correctness — but ONLY exposes the boolean match, never the true god of a
   * still-hidden player. The winning path reveals nothing beyond "all correct".
   */
  matched: Record<UserId, boolean>;
}

export interface ResolveResult {
  winner: UserId | null;
  outcomes: DeclarationOutcome[];
  eliminated: UserId[];
}

/**
 * Resolve the current declaration window. Mutates state: sets winner + status, or eliminates
 * failed declarers and resumes. Returns a summary safe to broadcast (no hidden gods leak).
 */
export function resolveDeclarations(state: GameState): ResolveResult {
  const order = seatOrderFromMeneur(state);
  const declByUser = new Map<UserId, Declaration>();
  for (const d of state.declarations) declByUser.set(d.declarer, d);

  const outcomes: DeclarationOutcome[] = [];
  const eliminatedNow: UserId[] = [];

  for (const uid of order) {
    const decl = declByUser.get(uid);
    if (!decl) continue;
    const declarer = state.players[uid];
    if (!declarer || !declarer.alive) continue;

    const opponents = state.seatOrder.filter(
      (o) => o !== uid && state.players[o]?.alive,
    );
    const declarerSoulmate = holdsAmesSoeurs(state, uid);

    const matched: Record<UserId, boolean> = {};
    let allCorrect = true;
    for (const opp of opponents) {
      if (declarerSoulmate && holdsAmesSoeurs(state, opp)) {
        matched[opp] = true; // Âmes sœurs : pas à deviner ce joueur
        continue;
      }
      const guess = decl.guesses[opp];
      const truth = state.players[opp]!.god;
      const ok = guess === truth;
      matched[opp] = ok;
      if (!ok) allCorrect = false;
    }

    if (allCorrect && opponents.length > 0) {
      state.winner = uid;
      state.status = 'terminee';
      outcomes.push({ declarer: uid, won: true, matched });
      state.declarations = [];
      return { winner: uid, outcomes, eliminated: eliminatedNow };
    }

    // First mismatch: eliminate declarer, card stays hidden.
    declarer.alive = false;
    if (!state.eliminated.includes(uid)) state.eliminated.push(uid);
    eliminatedNow.push(uid);
    outcomes.push({ declarer: uid, won: false, matched });
  }

  // No declarer succeeded: resume play.
  state.declarations = [];
  state.status = 'enCours';
  return { winner: null, outcomes, eliminated: eliminatedNow };
}
