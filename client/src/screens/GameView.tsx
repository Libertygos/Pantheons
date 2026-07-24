/**
 * In-match view over the per-seat projection — Visual V2 « la table » (§6) : trois bandes
 * horizontales. En haut, les sièges adverses sur un arc, chacun portant SES questions
 * reçues (la table montre « qui s'est fait demander quoi »). Au centre, la table partagée :
 * traqueur de phase (consigne + actions + coches prêt par siège), pioches empilées,
 * indicateur de tour, événements transients. En bas, mon dock : VOTRE DIEU (face cachée,
 * appui maintenu = révélation en grand via la loupe), MA MAIN en éventail, CONTRE VOUS /
 * SPÉCIALE, POUVOIR. QoL : loupe d'inspection sur toute face visible (CardInspectLayer),
 * tiroir pense-bête en surimpression (poignée au bord droit ; à la phase réponse elle bat
 * une fois et porte le compte des réponses non lues — le tiroir ne s'ouvre jamais seul),
 * cycle envoyé → confirmé sur les actions de phase (autorité : barrier serveur).
 *
 * Cards are final images displayed as-is; all interaction is chrome around them.
 * Un éliminé reste face cachée (la projection n'envoie jamais son dieu — never-send).
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { GodId, PlacedCardView, PlayerProjection, QuestionCard, QuestionPlay } from '@pantheons/engine';
import { GODS, ALL_GODS, data } from '@pantheons/engine';
import { GameTopBar } from '../components/GameTopBar.js';
import { PhaseTracker } from '../components/PhaseTracker.js';
import { SeatPlaque, PlacedMiniCard, type SeatQuestion } from '../components/SeatPlaque.js';
import { GameCard } from '../components/GameCard.js';
import { PenseBeteGrid } from '../components/PenseBeteGrid.js';
import { CardInspectLayer } from '../components/CardInspectLayer.js';
import { AideZone } from '../components/AideZone.js';
import { hideInspect, showInspect, useCardInspect } from '../components/card-inspect.js';
import {
  describeQuestionCard,
  godCardFace,
  questionCardBand,
  questionCardTexte,
} from '../components/card-text.js';
import { usePenseBete, type Mark } from '../state/pense-bete.js';
import { godCardSrc, godPortraitSrc, penseBeteSrc, pouvoirCardSrc, questionCardSrc } from '../assets.js';
import { fr } from '../i18n/fr.js';

/**
 * Accents d'identité par siège (1..7) : la rangée du pense-bête et le badge « N possibles »
 * de la plaque partagent la même teinte — la conclusion du tiroir reste lisible à la table.
 */
const SEAT_TINTS = [
  '--turquoise',
  '--vert',
  '--chartreuse',
  '--pouvoir-clair',
  '--vermillon',
  '--saumon',
  '--givre',
] as const;

const seatTint = (seat: number): string => SEAT_TINTS[seat % SEAT_TINTS.length]!;

/** Spéciales dont la face exige une cible (« Choisissez un joueur » / « d'un autre joueur »). */
const SPECIALES_A_CIBLE = new Set(['action_special_1', 'action_special_5', 'action_special_6']);
/** Pouvoirs actifs dont le choix est un adversaire. */
const POUVOIRS_CIBLE_JOUEUR = new Set(['clonage', 'refus_royal', 'execution']);
/** Pouvoirs actifs dont le choix est une carte posée sur un plateau. */
const POUVOIRS_CIBLE_CARTE = new Set(['sabotage', 'espionnage']);

interface StagedSpeciale {
  cardId: string;
  targetSeat?: number;
}

/**
 * Vol de carte (Phase E, recette §9.3) : un clone en position fixe part du rect source
 * et se pose sur le rect destination — transform-only, l'élément réel est masqué le temps
 * du vol. `hide` dit quel élément réel couvrir : la carte en main (arrivée de la pioche)
 * ou le fantôme sous le siège (pose d'une question).
 */
interface Flight {
  key: string;
  cardId: string;
  hide: 'main' | 'fantome';
  back?: 'attributs' | 'actions';
  face?: QuestionCard;
  top: number;
  left: number;
  w: number;
  h: number;
  dx: number;
  dy: number;
  dech: number;
  delay: number;
}

const reduceMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function makeFlight(
  key: string,
  cardId: string,
  hide: Flight['hide'],
  fromEl: Element,
  toEl: Element,
  art: { back?: Flight['back']; face?: QuestionCard },
  delay: number,
): Flight {
  const fr = fromEl.getBoundingClientRect();
  const to = toEl.getBoundingClientRect();
  return {
    key,
    cardId,
    hide,
    ...art,
    top: to.top,
    left: to.left,
    w: to.width,
    h: to.height,
    dx: fr.left - to.left,
    dy: fr.top - to.top,
    dech: to.width > 0 ? fr.width / to.width : 1,
    delay,
  };
}

/** Action de phase envoyée, en attente de l'ack serveur (QoL §4 — seul état client-local). */
interface SentAction {
  kind: 'valide' | 'passe' | 'declaration';
  /** Nombre de questions validées (phase question), pour la consigne au passé. */
  n?: number;
}

export function GameView({
  proj,
  send,
  banner,
  rejectNonce = 0,
  info,
  onInfoDismiss,
  over,
  onExit,
}: {
  proj: PlayerProjection;
  send: (type: string, payload: unknown) => void;
  banner: string | null;
  /** Compteur de rejets serveur — chaque incrément rend l'action de phase à nouveau actionnable. */
  rejectNonce?: number;
  /** Révélations privées / activations publiques relayées par RoomScreen. */
  info?: string | null;
  onInfoDismiss?: () => void;
  over: boolean;
  onExit: () => void;
}) {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [stagedPlays, setStagedPlays] = useState<QuestionPlay[]>([]);
  const [stagedSpeciales, setStagedSpeciales] = useState<StagedSpeciale[]>([]);
  /** Pouvoir actif en attente de sa cible (adversaire ou carte posée). */
  const [powerMode, setPowerMode] = useState<string | null>(null);
  const [declaring, setDeclaring] = useState(false);
  const [guesses, setGuesses] = useState<Record<string, GodId>>({});
  const [showHelp, setShowHelp] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [handlePulse, setHandlePulse] = useState(false);
  /** Réponses publiques déjà consultées dans le tiroir — la poignée affiche le solde. */
  const [answersSeen, setAnswersSeen] = useState(0);
  /** Tactile : carte de la main levée au premier appui — le second appui agit (B5). */
  const [raisedId, setRaisedId] = useState<string | null>(null);
  const [discardId, setDiscardId] = useState<string | null>(null);
  /** S4 : élimination(s) fraîche(s) à dramatiser — plein écran jusqu'au « Continuer ». */
  const [elimBeat, setElimBeat] = useState<string[] | null>(null);
  const [flights, setFlights] = useState<Flight[]>([]);
  /** QoL §4 : action de phase partie au serveur — Pending tant que youSubmitted est faux. */
  const [sent, setSent] = useState<SentAction | null>(null);
  const [sentSlow, setSentSlow] = useState(false);
  const notesCloseRef = useRef<HTMLButtonElement | null>(null);
  const penseBete = usePenseBete(proj.roomId);

  /** Éléments réels couverts par un vol en cours. */
  const volMain = new Set(flights.filter((f) => f.hide === 'main').map((f) => f.cardId));
  const volFantome = new Set(flights.filter((f) => f.hide === 'fantome').map((f) => f.cardId));

  // L'ouverture du tiroir donne le focus au bouton de fermeture.
  useEffect(() => {
    if (showNotes) notesCloseRef.current?.focus();
  }, [showNotes]);

  // ESC congédie la couche la plus haute : loupe (CardInspectLayer capte l'événement en
  // amont) → temps fort d'élimination → modale (déclaration, aide) → tiroir. La défausse
  // de pouvoir ne se ferme pas : c'est une action requise de la phase, pas une surcouche.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (elimBeat) setElimBeat(null);
      else if (declaring) setDeclaring(false);
      else if (showHelp) setShowHelp(false);
      else if (showNotes) setShowNotes(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [elimBeat, declaring, showHelp, showNotes]);

  // Au DÉBUT de la phase réponse, un signal — jamais une prise de contrôle : la poignée
  // bat une fois et son badge compte les réponses non lues (l'ancienne auto-ouverture
  // recouvrait la table et les commandes — B1/B3). Une seule fois par tour.
  const pulsedTour = useRef(0);
  useEffect(() => {
    if (over || !proj.self.alive) return;
    if (proj.phase !== 'reponse' || proj.status !== 'enCours') return;
    if (pulsedTour.current === proj.tour) return;
    pulsedTour.current = proj.tour;
    setHandlePulse(true);
  }, [proj.phase, proj.status, proj.tour, proj.self.alive, over]);

  // Le battement d'attention de la poignée s'éteint de lui-même (déterministe, y compris
  // sous reduced-motion où l'animation CSS est coupée).
  useEffect(() => {
    if (!handlePulse) return;
    const t = window.setTimeout(() => setHandlePulse(false), 900);
    return () => window.clearTimeout(t);
  }, [handlePulse]);

  // Reset staging when the phase or turn moves on.
  const phaseKey = `${proj.tour}:${proj.phase}`;
  const prevPhaseKey = useRef(phaseKey);
  useEffect(() => {
    if (prevPhaseKey.current !== phaseKey) {
      prevPhaseKey.current = phaseKey;
      setSelectedCardId(null);
      setStagedPlays([]);
      setStagedSpeciales([]);
      setPowerMode(null);
      setDeclaring(false);
      setGuesses({});
      setDiscardId(null);
      setSent(null);
      setRaisedId(null);
      setAnswersSeen(0);
    }
  }, [phaseKey]);

  // QoL §4 : un rejet serveur rend l'action actionnable — la notice d'erreur existante
  // (banner) porte l'explication.
  useEffect(() => {
    setSent(null);
  }, [rejectNonce]);

  // S4 : une élimination fraîche est un temps fort plein écran (B12 — l'ancienne bannière
  // d'info banalisait le moment). La fin de partie a son propre écran étagé : pas de beat.
  const prevEliminated = useRef<string[]>(proj.eliminated);
  useEffect(() => {
    const fresh = proj.eliminated.filter((uid) => !prevEliminated.current.includes(uid));
    prevEliminated.current = proj.eliminated;
    if (fresh.length > 0 && !over) setElimBeat(fresh);
  }, [proj.eliminated, over]);

  const me = proj.self;
  const alive = me.alive;
  const youSubmitted = proj.barrier.youSubmitted;
  const handCards = me.handCards ?? { attributs: [], actions: [] };
  const powerCards = me.powerCards ?? [];

  // QoL §4 : Pending = envoyé mais pas encore confirmé par la projection ; passé ~200ms,
  // un spinner s'ajoute au bouton enfoncé (jamais un simple gris).
  const pendingSent = sent !== null && !youSubmitted;
  useEffect(() => {
    if (!pendingSent) {
      setSentSlow(false);
      return;
    }
    const t = window.setTimeout(() => setSentSlow(true), 200);
    return () => window.clearTimeout(t);
  }, [pendingSent]);

  // B4 : sitôt la validation confirmée, la pose PUBLIQUE (projection) remplace mes
  // fantômes locaux — on les retire pour ne jamais rendre la même carte deux fois.
  useEffect(() => {
    if (!youSubmitted) return;
    setStagedPlays([]);
    setStagedSpeciales([]);
    setSelectedCardId(null);
    setRaisedId(null);
  }, [youSubmitted]);

  const rules = proj.questionRules;
  const selectedCard =
    [...handCards.attributs, ...handCards.actions].find((c) => c.id === selectedCardId) ?? null;
  const selectedIsSpeciale = selectedCard?.type === 'action' && selectedCard.subtype === 'speciale';
  const selectedSpecialeACible = selectedIsSpeciale && SPECIALES_A_CIBLE.has(selectedCard!.effectKey);
  const targeting =
    proj.phase === 'question' &&
    !youSubmitted &&
    alive &&
    !!selectedCard &&
    (!selectedIsSpeciale || selectedSpecialeACible) &&
    !(rules.askBlocked && !selectedIsSpeciale);
  const powerPicksOpponent = powerMode !== null && POUVOIRS_CIBLE_JOUEUR.has(powerMode);
  const powerPicksPlaced = powerMode !== null && POUVOIRS_CIBLE_CARTE.has(powerMode);

  const seatOf = (uid: string) => proj.seatOrder.indexOf(uid);
  const nameOf = (uid: string) =>
    uid === me.userId
      ? `${me.displayName} (${fr.jeu.vous})`
      : (proj.opponents.find((o) => o.userId === uid)?.displayName ?? uid);
  const stagedCountBySeat = new Map<number, number>();
  for (const p of stagedPlays) stagedCountBySeat.set(p.targetSeat, (stagedCountBySeat.get(p.targetSeat) ?? 0) + 1);
  const maxPerTarget = rules.sameTargetOk ? 2 : 1;
  const stagedCardIds = new Set([...stagedPlays.map((p) => p.cardId), ...stagedSpeciales.map((s) => s.cardId)]);

  const stageOn = (oppId: string) => {
    const targetSeat = seatOf(oppId);
    if (targetSeat < 0) return;
    if (powerPicksOpponent) {
      send('power', { effectKey: powerMode, target: oppId });
      setPowerMode(null);
      return;
    }
    if (!selectedCard) return;
    if (selectedSpecialeACible) {
      if (stagedSpeciales.length > 0) return;
      setStagedSpeciales([{ cardId: selectedCard.id, targetSeat }]);
      setSelectedCardId(null);
      return;
    }
    if (selectedIsSpeciale) return;
    if ((stagedCountBySeat.get(targetSeat) ?? 0) >= maxPerTarget || stagedPlays.length >= rules.max) return;
    setStagedPlays((s) => [...s, { cardId: selectedCard.id, card: selectedCard, targetSeat }]);
    setSelectedCardId(null);
  };

  const unstage = (cardId: string) => {
    setStagedPlays((s) => s.filter((p) => p.cardId !== cardId));
    setStagedSpeciales((s) => s.filter((sp) => sp.cardId !== cardId));
  };

  const stageSpeciale = () => {
    // Spéciales sans cible : pose directe sur l'emplacement dédié.
    if (!selectedCard || !selectedIsSpeciale || selectedSpecialeACible || stagedSpeciales.length > 0) return;
    setStagedSpeciales([{ cardId: selectedCard.id }]);
    setSelectedCardId(null);
  };

  const submitPioche = () => {
    if (pendingSent || (powerCards.length > 1 && !discardId)) return;
    setSent({ kind: 'valide' });
    send('pioche', powerCards.length > 1 ? { discardPowerId: discardId } : {});
  };

  const submitQuestions = () => {
    if (pendingSent) return;
    const n = stagedPlays.length;
    setSent({ kind: n === 0 && stagedSpeciales.length === 0 ? 'passe' : 'valide', n });
    send('question', { intent: { plays: stagedPlays }, specialePlays: stagedSpeciales });
  };

  const passReponse = () => {
    if (pendingSent) return;
    setSent({ kind: 'passe' });
    send('declaration', {});
  };

  /** Sabotage / Espionnage : choisir une carte posée n'importe où sur la table. */
  const pickPlaced = (placer: string, targetSeat: number, stackIndex: number, placed: PlacedCardView) => {
    if (!powerPicksPlaced) return;
    if (!canPickPlaced(placed)) return;
    send('power', { effectKey: powerMode, placer, targetSeat, stackIndex });
    setPowerMode(null);
  };

  const canPickPlaced = (placed: PlacedCardView): boolean => {
    if (!powerPicksPlaced) return false;
    if (powerMode === 'sabotage' && (placed.cardKind !== 'attribut' || placed.answeredOui !== undefined)) return false;
    return true;
  };

  /** Toutes les questions posées CONTRE ce joueur, tous poseurs confondus. */
  const questionsAgainst = (uid: string): SeatQuestion[] => {
    const t = seatOf(uid);
    if (t < 0) return [];
    const out: SeatQuestion[] = [];
    for (const placerId of proj.seatOrder) {
      if (placerId === uid) continue;
      const stack = proj.boardBySeat[placerId]?.questionSlots[t] ?? [];
      stack.forEach((placed, stackIndex) =>
        out.push({ placerId, placerName: nameOf(placerId), stackIndex, placed }),
      );
    }
    return out;
  };

  /** Prévisualisations locales sous un siège : mes cartes en attente de validation. */
  const ghostsFor = (seat: number): ReactNode => {
    const items: ReactNode[] = [];
    for (const p of stagedPlays) {
      if (p.targetSeat !== seat) continue;
      items.push(
        <button
          key={p.cardId}
          data-fantome={p.cardId}
          style={volFantome.has(p.cardId) ? { visibility: 'hidden' } : undefined}
          className="pose-ev__item pose-ev__item--fantome"
          onClick={() => unstage(p.cardId)}
          title={`${describeQuestionCard(p.card)} — ${fr.consignes.retirer}`}
        >
          <PlacedMiniCard
            placed={{ card: p.card, cardKind: p.card.type === 'attribut' ? 'attribut' : 'action', targetSeat: seat }}
          />
          <span className="pose-ev__fantome-note">{fr.jeu.aValider}</span>
        </button>,
      );
    }
    for (const sp of stagedSpeciales) {
      if (sp.targetSeat !== seat) continue;
      const card = handCards.actions.find((c) => c.id === sp.cardId);
      if (!card) continue;
      items.push(
        <button
          key={sp.cardId}
          data-fantome={sp.cardId}
          style={volFantome.has(sp.cardId) ? { visibility: 'hidden' } : undefined}
          className="pose-ev__item pose-ev__item--fantome"
          onClick={() => unstage(sp.cardId)}
          title={`${describeQuestionCard(card)} — ${fr.consignes.retirer}`}
        >
          <PlacedMiniCard
            placed={{ card, cardKind: 'action', targetSeat: seat }}
          />
          <span className="pose-ev__fantome-note">{fr.jeu.aValider}</span>
        </button>,
      );
    }
    return items.length > 0 ? <>{items}</> : null;
  };

  // S4 : l'ordre de la déclaration = l'ordre des sièges (la table physique), pas l'ordre
  // d'arrivée dans la projection.
  const liveOpponents = proj.seatOrder
    .map((uid) => proj.opponents.find((o) => o.userId === uid))
    .filter((o): o is NonNullable<typeof o> => Boolean(o?.alive));
  const declarationComplete = liveOpponents.every((o) => guesses[o.userId]);

  const submitDeclaration = () => {
    if (!declarationComplete || pendingSent) return;
    setSent({ kind: 'declaration' });
    send('declaration', { guesses });
    setDeclaring(false);
  };

  const targetNameOf = (cardId: string): string | null => {
    const play = stagedPlays.find((p) => p.cardId === cardId);
    if (!play) {
      const sp = stagedSpeciales.find((s) => s.cardId === cardId);
      if (!sp) return null;
      if (sp.targetSeat === undefined) return fr.jeu.emplacementSpecial;
      const uid = proj.seatOrder[sp.targetSeat];
      return fr.jeu.specialeCible(proj.opponents.find((o) => o.userId === uid)?.displayName ?? '');
    }
    const uid = proj.seatOrder[play.targetSeat];
    return proj.opponents.find((o) => o.userId === uid)?.displayName ?? null;
  };

  // ---- consigne du traqueur (absorbe l'ancienne bannière jaune) --------------------
  // QoL §4 : une fois confirmé, la consigne passe au passé et NOMME les joueurs encore
  // attendus — la même source (barrier.submitted) que les coches du traqueur.
  const pendingNames = proj.seatOrder
    .map((uid) => (uid === me.userId ? me : proj.opponents.find((o) => o.userId === uid)))
    .filter((x): x is NonNullable<typeof x> =>
      Boolean(x && x.alive && x.connected && !proj.barrier.submitted.includes(x.userId)),
    )
    .map((x) => x.displayName);

  const faitLine =
    sent?.kind === 'declaration'
      ? fr.fait.declaration
      : proj.phase === 'pioche'
        ? fr.fait.pioche
        : proj.phase === 'question'
          ? fr.fait.questions(sent?.n)
          : fr.fait.reponsePassee;

  const instruction =
    over
      ? null
      : !alive
        ? fr.consignes.elimine
        : powerMode
        ? powerPicksOpponent
          ? fr.jeu.choisirCiblePouvoir(data.POWERS[powerMode]?.label ?? powerMode)
          : fr.jeu.choisirCartePosee(data.POWERS[powerMode]?.label ?? powerMode)
        : youSubmitted
          ? pendingNames.length > 0
            ? `${faitLine} — ${fr.fait.tableAttend(pendingNames.join(', '))}`
            : faitLine
          : proj.phase === 'pioche'
            ? powerCards.length > 1
              ? fr.consignes.piocheDefausse
              : fr.consignes.piochePret
            : proj.phase === 'question'
              ? rules.askBlocked
                ? fr.jeu.refusRoyalBloque
                : selectedSpecialeACible
                  ? fr.jeu.choisirCibleSpeciale
                  : selectedIsSpeciale
                    ? fr.consignes.questionSpeciale
                    : fr.consignes.question
              : fr.consignes.reponse;

  // Libellé du chip confirmé : le passé de CE qui a été fait (repli par phase après un
  // rechargement, où `sent` n'existe plus).
  const chipLabel = sent
    ? sent.kind === 'passe'
      ? fr.fait.passe
      : fr.fait.valide
    : proj.phase === 'reponse'
      ? fr.fait.passe
      : fr.fait.valide;

  const spinner = sentSlow ? <span className="btn__spinner" aria-hidden="true" /> : null;

  const trackerActions =
    over || !alive ? null : powerMode ? (
      <button className="btn btn--nu btn--petit" onClick={() => setPowerMode(null)}>
        {fr.jeu.annulerPouvoir}
      </button>
    ) : youSubmitted ? (
      <span className="fait-chip" role="status">
        <span className="fait-chip__coche" aria-hidden="true">
          ✓
        </span>
        {chipLabel}
      </span>
    ) : (
      <>
        {proj.phase === 'pioche' && (
          <button
            className={`btn btn--givre btn--petit ${pendingSent ? 'btn--envoi' : ''}`}
            onClick={submitPioche}
            disabled={pendingSent || (powerCards.length > 1 && !discardId)}
          >
            {spinner}
            {fr.consignes.validerPioche}
          </button>
        )}
        {proj.phase === 'question' && (
          <>
            {selectedIsSpeciale && !selectedSpecialeACible && (
              <button
                className="btn btn--petit"
                onClick={stageSpeciale}
                disabled={pendingSent || stagedSpeciales.length > 0}
              >
                {fr.consignes.poserSpeciale}
              </button>
            )}
            <button
              className={`btn btn--givre btn--petit ${pendingSent ? 'btn--envoi' : ''}`}
              onClick={submitQuestions}
              disabled={pendingSent}
            >
              {spinner}
              {fr.consignes.validerQuestions(stagedPlays.length)}
            </button>
          </>
        )}
        {proj.phase === 'reponse' && (
          <>
            <button
              className={`btn btn--petit ${pendingSent && sent?.kind === 'passe' ? 'btn--envoi' : ''}`}
              onClick={passReponse}
              disabled={pendingSent}
            >
              {sent?.kind === 'passe' && spinner}
              {fr.pass}
            </button>
            <button
              className={`btn btn--primaire btn--petit ${
                pendingSent && sent?.kind === 'declaration' ? 'btn--envoi' : ''
              }`}
              onClick={() => setDeclaring(true)}
              disabled={pendingSent}
            >
              {sent?.kind === 'declaration' && spinner}
              {fr.declaration.button}
            </button>
          </>
        )}
      </>
    );

  // ---- sièges : adversaires dans l'ordre de la table -------------------------------
  const seatedOpponents = proj.seatOrder
    .filter((uid) => uid !== me.userId)
    .map((uid) => proj.opponents.find((o) => o.userId === uid))
    .filter((o): o is NonNullable<typeof o> => Boolean(o));
  const nOpp = seatedOpponents.length;

  const mySpecial = proj.boardBySeat[me.userId]?.specialSlot ?? null;
  const stagedSpecialeSansCible = stagedSpeciales.find((s) => s.targetSeat === undefined);
  const stagedSpecialeSansCibleCard = stagedSpecialeSansCible
    ? handCards.actions.find((c) => c.id === stagedSpecialeSansCible.cardId)
    : undefined;
  const specialeZoneLegale =
    !!selectedCard && selectedIsSpeciale && !selectedSpecialeACible && stagedSpeciales.length === 0;
  const receivedQuestions = questionsAgainst(me.userId);

  // La matière du tiroir : les réponses publiques de CE tour chez les adversaires. Tiroir
  // fermé, la poignée porte le solde non lu ; ouvert, tout est réputé lu.
  const publicAnswers = proj.seatOrder
    .filter((uid) => uid !== me.userId)
    .reduce(
      (n, uid) => n + questionsAgainst(uid).filter((q) => q.placed.answeredOui !== undefined).length,
      0,
    );
  const unreadAnswers = showNotes ? 0 : Math.max(0, publicAnswers - answersSeen);
  useEffect(() => {
    if (showNotes) setAnswersSeen(publicAnswers);
  }, [showNotes, publicAnswers]);

  const hand = [...handCards.attributs, ...handCards.actions];

  // S3 : la carte en lecture (choisie au clic, ou levée au premier appui tactile) affiche
  // sa légende de chrome — nom + texte VERBATIM de la face — sous l'éventail, pour que
  // l'effet se lise sans la loupe (et au tactile, où la loupe n'existe pas).
  const readCard = selectedCard ?? hand.find((c) => c.id === raisedId) ?? null;
  const readTexte = readCard ? questionCardTexte(readCard) : null;

  // §8.1 — la distribution : toute carte qui ENTRE en main vole depuis sa pioche
  // (attributs à la pioche, actions sur un « oui »), 60ms d'écart, puis se pose en éventail.
  const prevHandIds = useRef<string[]>(hand.map((c) => c.id));
  useLayoutEffect(() => {
    const ids = hand.map((c) => c.id);
    const fresh = ids.filter((id) => !prevHandIds.current.includes(id));
    prevHandIds.current = ids;
    if (fresh.length === 0 || reduceMotion()) return;
    const arrivals: Flight[] = [];
    fresh.forEach((id, i) => {
      const card = hand.find((c) => c.id === id);
      if (!card) return;
      const kind = card.type === 'attribut' ? 'attributs' : 'actions';
      const fromEl = document.querySelector(`[data-pioche='${kind}']`);
      const toEl = document.querySelector(`[data-carte-main='${CSS.escape(id)}']`);
      if (!fromEl || !toEl) return;
      arrivals.push(makeFlight(`arr-${id}`, id, 'main', fromEl, toEl, { back: kind }, i * 60));
    });
    if (arrivals.length > 0) setFlights((f) => [...f, ...arrivals]);
  }, [hand]);

  // §8.2 — la pose : la carte mise en attente voyage de la main vers la zone du siège visé
  // et atterrit avec un léger sur-pivotement corrigé (keyframes vol-carte).
  const stagedIdsKey = [...stagedPlays.map((p) => p.cardId), ...stagedSpeciales.map((s) => s.cardId)].join(',');
  const prevStagedIds = useRef<string[]>([]);
  useLayoutEffect(() => {
    const ids = stagedIdsKey === '' ? [] : stagedIdsKey.split(',');
    const fresh = ids.filter((id) => !prevStagedIds.current.includes(id));
    prevStagedIds.current = ids;
    if (fresh.length === 0 || reduceMotion()) return;
    const poses: Flight[] = [];
    for (const id of fresh) {
      const card = hand.find((c) => c.id === id);
      const fromEl = document.querySelector(`[data-carte-main='${CSS.escape(id)}']`);
      const toEl = document.querySelector(`[data-fantome='${CSS.escape(id)}']`);
      if (!card || !fromEl || !toEl) continue;
      poses.push(makeFlight(`pose-${id}`, id, 'fantome', fromEl, toEl, { face: card }, 0));
    }
    if (poses.length > 0) setFlights((f) => [...f, ...poses]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stagedIdsKey]);

  const toggleNotes = () => setShowNotes((s) => !s);

  // B13 : les absents en clair — la barrière ne les attend pas (auto-passe serveur),
  // le point de connexion 2px ne suffisait pas à le dire.
  const deconnectes = seatedOpponents.filter((o) => o.alive && !o.connected);

  return (
    <div className="jeu">
      <GameTopBar
        tour={proj.tour}
        meneurVous={proj.meneur === me.userId}
        elimine={!alive}
        onHelp={() => setShowHelp(true)}
        onExit={onExit}
      />

      {/* bande haute : l'arc des sièges */}
      <div className="places-arc">
        <AideZone sujet="sieges" className="btn-aide--arc" />
        {seatedOpponents.map((opp, idx) => {
          const seat = seatOf(opp.userId);
          const isTargeted =
            (stagedCountBySeat.get(seat) ?? 0) > 0 || stagedSpeciales.some((s) => s.targetSeat === seat);
          const zoneLegale =
            targeting &&
            opp.alive &&
            (selectedSpecialeACible
              ? stagedSpeciales.length === 0
              : (stagedCountBySeat.get(seat) ?? 0) < maxPerTarget && stagedPlays.length < rules.max);
          const oppSpecial = proj.boardBySeat[opp.userId]?.specialSlot;
          const ghosts = ghostsFor(seat);
          const extras =
            ghosts || oppSpecial || isTargeted ? (
              <>
                {ghosts}
                {oppSpecial && (
                  <span className="pose-ev__item" title={fr.jeu.emplacementSpecial}>
                    <PlacedMiniCard placed={oppSpecial} />
                    <span className="pose-ev__spe-note">{fr.jeu.statCourt.speciale}</span>
                  </span>
                )}
                {isTargeted && <span className="pose-ev__cible-note">{fr.jeu.cible}</span>}
              </>
            ) : null;
          return (
            <SeatPlaque
              key={opp.userId}
              opp={opp}
              seat={seat + 1}
              arcIndex={idx - (nOpp - 1) / 2}
              isMeneur={proj.meneur === opp.userId}
              submitted={proj.barrier.submitted.includes(opp.userId)}
              possibles={penseBete.remaining(opp.userId)}
              tint={seatTint(seat)}
              questions={questionsAgainst(opp.userId)}
              stagedGhosts={extras}
              zoneLegale={zoneLegale}
              plaqueLegale={powerPicksOpponent && opp.alive}
              pickMode={powerPicksPlaced}
              canPick={canPickPlaced}
              onZone={() => stageOn(opp.userId)}
              onPlaque={() => stageOn(opp.userId)}
              onPick={(q) => pickPlaced(q.placerId, q.placed.targetSeat, q.stackIndex, q.placed)}
            />
          );
        })}
      </div>

      {/* traqueur de phase : étapes + coches prêt par siège + consigne + actions */}
      <PhaseTracker
        p={proj}
        instruction={instruction}
        avis={
          deconnectes.length > 0
            ? deconnectes.map((o) => (
                <span key={o.userId} className="traqueur__deco">
                  <span className="point-conn point-conn--deco" aria-hidden="true" />
                  {fr.jeu.deconnecte(o.displayName)}
                </span>
              ))
            : null
        }
      >
        {trackerActions}
      </PhaseTracker>

      {/* centre : la table partagée */}
      <section className="table-centre">
        <AideZone sujet="table" className="btn-aide--table" />
        {(banner || info) && (
          <div className="table-centre__notices">
            {banner && (
              <div className="notice notice--erreur" role="alert">
                {banner}
              </div>
            )}
            {info && (
              <div className="notice" role="status">
                {info}
                <button className="btn btn--nu btn--petit" onClick={() => onInfoDismiss?.()}>
                  ✕
                </button>
              </div>
            )}
          </div>
        )}

        <div className="table-centre__scene">
          <DeckPile kind="attributs" count={proj.drawCounts.attributs} label={fr.jeu.attributs} />
          <div className="table-centre__tour" aria-hidden="true">
            <span className="libelle">{fr.tour}</span>
            <strong>{proj.tour}</strong>
          </div>
          <DeckPile kind="actions" count={proj.drawCounts.actions} label={fr.jeu.actions} />
        </div>
      </section>

      {/* tiroir pense-bête : toujours en surimpression (jamais de reflux de la table),
          voile + focus — il ne s'ouvre que par la poignée */}
      <div
        className={`tiroir-voile ${showNotes ? 'tiroir-voile--visible' : ''}`}
        onClick={() => setShowNotes(false)}
        aria-hidden="true"
      />
      <aside
        id="tiroir-pense-bete"
        className={`tiroir ${showNotes ? 'tiroir--ouvert' : ''}`}
        role="dialog"
        aria-label={fr.penseBete.title}
      >
        <div className="tiroir__entete">
          <h3 className="titre-affiche tiroir__titre">{fr.penseBete.title}</h3>
          <button
            ref={notesCloseRef}
            className="btn btn--nu btn--petit"
            onClick={() => setShowNotes(false)}
            aria-label={fr.penseBete.fermer}
          >
            ✕
          </button>
        </div>
        <p className="pense-bete__note">{fr.penseBete.note}</p>
        <div className="tiroir__corps">
          <PenseBeteGrid
            rows={proj.seatOrder
              .filter((uid) => uid !== me.userId)
              .map((uid) => {
                const o = proj.opponents.find((x) => x.userId === uid);
                return o
                  ? {
                      userId: o.userId,
                      displayName: o.displayName,
                      alive: o.alive,
                      tint: seatTint(seatOf(o.userId)),
                      // QoL §2 : les réponses publiques de CE tour (answeredOui est public ;
                      // la face reste celle que la projection montre à CE spectateur), les
                      // plateaux étant vidés par le moteur à chaque fin de tour.
                      answers: questionsAgainst(o.userId)
                        .filter((q) => q.placed.answeredOui !== undefined)
                        .map((q) => ({ key: `${q.placerId}:${q.stackIndex}`, placed: q.placed }))
                        .reverse(),
                    }
                  : null;
              })
              .filter((r): r is NonNullable<typeof r> => r !== null)}
            get={penseBete.get}
            toggle={penseBete.toggle}
            remaining={penseBete.remaining}
          />
        </div>
      </aside>

      {/* QoL §3 : la poignée du pense-bête — l'onglet vertical au bord droit, TOUJOURS
          visible ; tiroir ouvert, elle chevauche son bord gauche (même contrôle spatial). */}
      <button
        className={[
          'tiroir-poignee',
          showNotes ? 'tiroir-poignee--ouvert' : '',
          handlePulse ? 'tiroir-poignee--pulse' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={toggleNotes}
        aria-expanded={showNotes}
        aria-controls="tiroir-pense-bete"
        aria-label={
          showNotes
            ? fr.penseBete.fermer
            : unreadAnswers > 0
              ? `${fr.penseBete.ouvrir} — ${fr.penseBete.nouvellesReponses(unreadAnswers)}`
              : fr.penseBete.ouvrir
        }
        title={
          unreadAnswers > 0
            ? `${fr.penseBete.title} — ${fr.penseBete.nouvellesReponses(unreadAnswers)}`
            : fr.penseBete.title
        }
      >
        {unreadAnswers > 0 && (
          <span className="tiroir-poignee__badge" aria-hidden="true">
            {unreadAnswers}
          </span>
        )}
        <NotebookIcon />
        <span className="tiroir-poignee__texte">{fr.penseBete.title}</span>
      </button>

      {/* bande basse : mon dock */}
      <div className="dock surface-levee">
        <div className="dock__interieur">
          <div className="dock__zone dock__zone--dieu">
            <span className="libelle dock__titre">
              {fr.yourGod} <AideZone sujet="dieu" />
            </span>
            {/* B12 : l'état persiste après le temps fort — le dock et la barre le disent */}
            {!alive && <span className="dock__elimine">{fr.jeu.elimine}</span>}
            <MyGodCard god={me.god} />
          </div>

          <div className="dock__zone dock__zone--main">
            <span className="libelle dock__titre">
              {fr.jeu.maMain} — {hand.length} <AideZone sujet="main" />
            </span>
            {hand.length === 0 && (
              // Jamais un vide muet : une ligne dit pourquoi la main est vide (390 pioche).
              <p className="main-vide">
                {proj.phase === 'pioche' && alive && !over
                  ? youSubmitted
                    ? fr.jeu.mainVideAttente
                    : fr.jeu.mainVidePioche
                  : fr.jeu.mainVide}
              </p>
            )}
            {hand.length > 0 && (
            <div className="main-ev" style={{ '--n': hand.length } as CSSProperties}>
              {hand.map((card, idx) => {
                const i = idx - (hand.length - 1) / 2;
                const staged = stagedCardIds.has(card.id);
                const target = targetNameOf(card.id);
                // Verrouillée = injouable, PAS inerte : aria-disabled (et non disabled)
                // garde le survol et le focus clavier — la loupe d'inspection (QoL §1)
                // doit rester lisible à toutes les phases.
                const locked = proj.phase !== 'question' || youSubmitted || !alive;
                return (
                  <button
                    key={card.id}
                    data-carte-main={card.id}
                    className={[
                      'main-ev__carte',
                      selectedCardId === card.id ? 'main-ev__carte--choisie' : '',
                      staged ? 'main-ev__carte--posee' : '',
                      raisedId === card.id ? 'main-ev__carte--levee' : '',
                    ].join(' ')}
                    style={
                      {
                        '--i': i,
                        '--abs-i': Math.abs(i),
                        '--z': 10 + idx,
                        visibility: volMain.has(card.id) ? 'hidden' : undefined,
                      } as CSSProperties
                    }
                    aria-disabled={locked || undefined}
                    onClick={() => {
                      // Tactile (pas de survol) : le premier appui LÈVE la carte couverte
                      // pour la lire, le second agit — parité avec le lift au survol (B5).
                      if (window.matchMedia('(pointer: coarse)').matches && raisedId !== card.id) {
                        setRaisedId(card.id);
                        return;
                      }
                      if (locked) return;
                      if (staged) unstage(card.id);
                      else setSelectedCardId((cur) => (cur === card.id ? null : card.id));
                    }}
                    title={describeQuestionCard(card)}
                  >
                    <GameCard
                      size="md"
                      face={{
                        src: questionCardSrc(card),
                        alt: describeQuestionCard(card),
                        typeLabel: card.type === 'attribut' ? 'Attribut' : 'Action',
                        bodyLabel: describeQuestionCard(card),
                        bandColor: questionCardBand(card),
                        tint: card.type === 'attribut' ? 'teinte-attribut' : 'teinte-action',
                      }}
                    />
                    {staged && target && (
                      <span className="main-ev__note">→ {target}</span>
                    )}
                  </button>
                );
              })}
            </div>
            )}
            {readCard && (
              <p className="carte-legende carte-legende--main">
                <strong className="carte-legende__nom">{describeQuestionCard(readCard)}</strong>
                {readTexte && <span className="carte-legende__texte">{readTexte}</span>}
              </p>
            )}
          </div>

          {(receivedQuestions.length > 0 || mySpecial || stagedSpecialeSansCibleCard || specialeZoneLegale) && (
            <div className="dock__zone dock__zone--recu">
              {receivedQuestions.length > 0 && (
                <>
                  <span className="libelle dock__titre">
                    {fr.jeu.contreVous} <AideZone sujet="contreVous" />
                  </span>
                  <div className="pose-ev">
                    {receivedQuestions.map((q) => {
                      const desc = q.placed.card ? describeQuestionCard(q.placed.card) : fr.jeu.faceCachee;
                      const titre = `${desc} — ${fr.jeu.poseePar(q.placerName)}`;
                      return powerPicksPlaced && canPickPlaced(q.placed) ? (
                        <button
                          key={`${q.placerId}:${q.stackIndex}`}
                          className="pose-ev__item pose-ev__item--choisissable"
                          onClick={() => pickPlaced(q.placerId, q.placed.targetSeat, q.stackIndex, q.placed)}
                          title={titre}
                        >
                          <PlacedMiniCard placed={q.placed} />
                        </button>
                      ) : (
                        <span key={`${q.placerId}:${q.stackIndex}`} className="pose-ev__item">
                          <PlacedMiniCard placed={q.placed} title={titre} />
                        </span>
                      );
                    })}
                  </div>
                </>
              )}
              {(mySpecial || stagedSpecialeSansCibleCard || specialeZoneLegale) && (
                <>
                  <span className="libelle dock__titre">{fr.jeu.emplacementSpecial}</span>
                  <div className={`zone-speciale ${specialeZoneLegale ? 'zone-speciale--legale' : ''}`}>
                    {mySpecial &&
                      (mySpecial.card ? (
                        <PlacedMiniCard placed={mySpecial} title={describeQuestionCard(mySpecial.card)} />
                      ) : (
                        <PlacedMiniCard placed={mySpecial} title={fr.jeu.faceCachee} />
                      ))}
                    {stagedSpecialeSansCibleCard && (
                      <button
                        className="pose-ev__item pose-ev__item--fantome"
                        data-fantome={stagedSpecialeSansCibleCard.id}
                        style={
                          volFantome.has(stagedSpecialeSansCibleCard.id)
                            ? { visibility: 'hidden' }
                            : undefined
                        }
                        onClick={() => unstage(stagedSpecialeSansCibleCard.id)}
                        title={`${describeQuestionCard(stagedSpecialeSansCibleCard)} — ${fr.consignes.retirer}`}
                      >
                        <PlacedMiniCard
                          placed={{ card: stagedSpecialeSansCibleCard, cardKind: 'action', targetSeat: -1 }}
                        />
                        <span className="pose-ev__fantome-note">{fr.jeu.aValider}</span>
                      </button>
                    )}
                    {specialeZoneLegale && !mySpecial && !stagedSpecialeSansCibleCard && (
                      <button className="pose-ev__deposer" onClick={stageSpeciale}>
                        {fr.consignes.poserSpeciale}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          <div className="dock__zone dock__zone--pouvoir">
            <span className="libelle dock__titre">
              {fr.jeu.pouvoir} <AideZone sujet="pouvoir" />
            </span>
            {powerCards.map((pow) => {
              const def = data.POWERS[pow.effectKey];
              const activable = def?.kind === 'active' && alive && !over && proj.status === 'enCours';
              const arme = powerMode === pow.effectKey;
              return (
                <div key={pow.id} className={`pouvoir-slot ${arme ? 'pouvoir-slot--arme' : ''}`}>
                  <GameCard
                    size="md"
                    face={{
                      src: pouvoirCardSrc(pow.effectKey),
                      alt: def?.label ?? fr.jeu.pouvoir,
                      typeLabel: fr.jeu.pouvoir,
                      bodyLabel: def?.label ?? pow.effectKey.replace(/_/g, ' '),
                      tint: 'teinte-pouvoir',
                    }}
                  />
                  {/* S3 : nom + effet verbatim de la face en légende — lisible sans loupe */}
                  <p className="carte-legende carte-legende--pouvoir">
                    <strong className="carte-legende__nom">
                      {def?.label ?? pow.effectKey.replace(/_/g, ' ')}
                    </strong>
                    {def?.texte && <span className="carte-legende__texte">{def.texte}</span>}
                  </p>
                  {activable && (
                    <button
                      className="btn btn--petit pouvoir-slot__utiliser"
                      onClick={() => {
                        if (pow.effectKey === 'deduction') send('power', { effectKey: 'deduction' });
                        else setPowerMode(arme ? null : pow.effectKey);
                      }}
                    >
                      {arme ? fr.jeu.annulerPouvoir : fr.jeu.utiliser}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* modale : défausse de pouvoir (pioche, 2 pouvoirs) */}
      {!over && alive && proj.phase === 'pioche' && !youSubmitted && powerCards.length > 1 && (
        <div className="voile">
          <div className="modale">
            <h2 className="titre-affiche modale__titre">{fr.consignes.piocheDefausse}</h2>
            <div className="choix-cartes">
              {powerCards.map((pow) => (
                <button
                  key={pow.id}
                  className={`choix-carte ${discardId === pow.id ? 'choix-carte--choisi' : ''}`}
                  onClick={() => setDiscardId((cur) => (cur === pow.id ? null : pow.id))}
                >
                  <GameCard
                    size="lg"
                    face={{
                      src: pouvoirCardSrc(pow.effectKey),
                      alt: data.POWERS[pow.effectKey]?.label ?? pow.effectKey,
                      typeLabel: fr.jeu.pouvoir,
                      bodyLabel: data.POWERS[pow.effectKey]?.label ?? pow.effectKey.replace(/_/g, ' '),
                      tint: 'teinte-pouvoir',
                    }}
                  />
                  {/* S3 : le choix se lit sans loupe — nom + effet verbatim sous chaque carte */}
                  <span className="carte-legende carte-legende--choix">
                    <strong className="carte-legende__nom">
                      {data.POWERS[pow.effectKey]?.label ?? pow.effectKey.replace(/_/g, ' ')}
                    </strong>
                    {data.POWERS[pow.effectKey]?.texte && (
                      <span className="carte-legende__texte">{data.POWERS[pow.effectKey]!.texte}</span>
                    )}
                  </span>
                  <span className="choix-carte__note">
                    {discardId === pow.id ? fr.jeu.defausserCeluiCi : ''}
                  </span>
                </button>
              ))}
            </div>
            <div className="modale__pied">
              <button
                className={`btn btn--givre ${pendingSent ? 'btn--envoi' : ''}`}
                onClick={submitPioche}
                disabled={pendingSent || !discardId}
              >
                {spinner}
                {fr.consignes.validerPioche}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* modale : déclaration Panthéons — LE temps fort du jeu (S4) : bande signature,
          titre divin (chartreuse, son usage réservé), noms sous les portraits, marques du
          pense-bête en surimpression et badge « N possibles » par rangée (notes locales,
          jamais envoyées — aucune information cachée n'entre ici). */}
      {declaring && (
        <div className="voile">
          <div className="modale modale--ceremonie">
            <div className="tri-bande modale__bande" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <h2 className="titre-affiche modale__titre modale__titre--divin">
              {fr.declaration.title}
            </h2>
            <p className="modale__texte">{fr.declaration.instruction}</p>
            {liveOpponents.map((opp) => {
              const seat = seatOf(opp.userId);
              return (
                <div className="decl-rang" key={opp.userId}>
                  <div className="decl-rang__nom">
                    {opp.displayName}
                    <span
                      className="place__possibles"
                      style={{ '--teinte-place': `var(${seatTint(seat)})` } as CSSProperties}
                      title={`${fr.penseBete.title} — ${fr.penseBete.restants(penseBete.remaining(opp.userId))}`}
                    >
                      {fr.penseBete.restants(penseBete.remaining(opp.userId))}
                    </span>
                    <span className="decl-rang__choix">
                      {guesses[opp.userId] ? GODS[guesses[opp.userId]!].label : fr.declaration.aChoisir}
                    </span>
                  </div>
                  <div className="decl-dieux">
                    {ALL_GODS.map((god) => (
                      <DeclDieu
                        key={god.id}
                        godId={god.id}
                        chosen={guesses[opp.userId] === god.id}
                        mark={penseBete.get(opp.userId, god.id)}
                        onPick={() => setGuesses((g) => ({ ...g, [opp.userId]: god.id }))}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
            <div className="modale__pied">
              <button className="btn btn--nu" onClick={() => setDeclaring(false)}>
                {fr.declaration.cancel}
              </button>
              <button
                className={`btn btn--primaire ${pendingSent ? 'btn--envoi' : ''}`}
                onClick={submitDeclaration}
                disabled={pendingSent || !declarationComplete}
              >
                {sent?.kind === 'declaration' && spinner}
                {fr.declaration.confirm}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* modale : aide */}
      {showHelp && (
        <div className="voile" onClick={() => setShowHelp(false)}>
          <div className="modale" onClick={(e) => e.stopPropagation()}>
            <h2 className="titre-affiche modale__titre">{fr.aide.titre}</h2>
            {fr.aide.corps.map((t) => (
              <p className="modale__texte" key={t}>
                {t}
              </p>
            ))}
            <img
              src={penseBeteSrc()}
              alt={fr.aide.penseBeteAlt}
              style={{ width: '100%', border: '1px solid var(--filet-fort)' }}
            />
            <div className="modale__pied">
              <button className="btn" onClick={() => setShowHelp(false)}>
                {fr.aide.fermer}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* vols de cartes en cours (§8.1–8.2) : clones fixes, transform-only, auto-retirés */}
      {flights.map((f) => (
        <span
          key={f.key}
          className="vol"
          aria-hidden="true"
          style={
            {
              top: f.top,
              left: f.left,
              width: f.w,
              height: f.h,
              '--dx': `${f.dx}px`,
              '--dy': `${f.dy}px`,
              '--dech': f.dech,
              '--delai': `${f.delay}ms`,
            } as CSSProperties
          }
          onAnimationEnd={(e) => {
            if (e.target === e.currentTarget) {
              setFlights((cur) => cur.filter((x) => x.key !== f.key));
            }
          }}
        >
          {f.face ? (
            <GameCard
              size="sm"
              inspect={false}
              face={{
                src: questionCardSrc(f.face),
                alt: '',
                typeLabel: f.face.type === 'attribut' ? 'Attribut' : 'Action',
                bodyLabel: describeQuestionCard(f.face),
                bandColor: questionCardBand(f.face),
                tint: f.face.type === 'attribut' ? 'teinte-attribut' : 'teinte-action',
              }}
            />
          ) : (
            <GameCard size="sm" back={f.back ?? 'attributs'} />
          )}
        </span>
      ))}

      {/* temps fort : élimination (S4, B12) — plein écran, langage vermillon ; remplace
          l'ancienne bannière d'info. La fin de partie a son propre écran : pas de beat. */}
      {elimBeat && !over && (
        <div className="voile voile--elimine">
          <div
            className="beat-elimine"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="beat-elimine-titre"
          >
            <span className="beat-elimine__sceau" aria-hidden="true">
              ✕
            </span>
            <h2 id="beat-elimine-titre" className="titre-affiche beat-elimine__titre">
              {elimBeat.includes(me.userId)
                ? fr.elimination.titreVous
                : fr.elimination.titre(
                    elimBeat
                      .map((uid) => proj.opponents.find((o) => o.userId === uid)?.displayName ?? uid)
                      .join(', '),
                  )}
            </h2>
            {elimBeat.includes(me.userId) && (
              <p className="beat-elimine__texte">{fr.elimination.corpsVous}</p>
            )}
            {elimBeat
              .filter((uid) => uid !== me.userId)
              .map((uid) => (
                <p key={uid} className="beat-elimine__texte">
                  {fr.elimination.corps(
                    proj.opponents.find((o) => o.userId === uid)?.displayName ?? uid,
                  )}
                </p>
              ))}
            <button className="btn btn--givre" onClick={() => setElimBeat(null)} autoFocus>
              {fr.elimination.continuer}
            </button>
          </div>
        </div>
      )}

      {/* fin de partie — séquence étagée (S4) : bande signature → titre → verdict → la
          carte du vainqueur (SA face pour lui seul ; pour les autres le verso — son dieu
          reste secret, règle de projection) → retour. */}
      {over && (
        <div className="voile">
          <div className="modale modale--ceremonie fin">
            <div className="tri-bande fin__bande" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <h2 className="titre-affiche fin__titre">{fr.fin.titre}</h2>
            <p className="fin__texte">
              {proj.winner === me.userId
                ? fr.fin.vainqueurVous
                : fr.fin.vainqueur(
                    proj.opponents.find((o) => o.userId === proj.winner)?.displayName ??
                      proj.winner ??
                      '—',
                  )}
            </p>
            {proj.winner &&
              (proj.winner === me.userId ? (
                <WinnerGod godId={me.god} />
              ) : (
                <div className="fin__dieu fin__dieu--secret">
                  <GameCard size="lg" back="personnages" inspect={false} />
                  <p className="fin__note">
                    {fr.fin.dieuCache(
                      proj.opponents.find((o) => o.userId === proj.winner)?.displayName ??
                        proj.winner,
                    )}
                  </p>
                </div>
              ))}
            <button className="btn btn--givre fin__retour" onClick={onExit}>
              {fr.fin.retour}
            </button>
          </div>
        </div>
      )}

      {/* QoL §1 : la loupe d'inspection — portail unique, une prévisualisation à la fois */}
      <CardInspectLayer />
    </div>
  );
}

/**
 * Choix de dieu de la déclaration (S4) : portrait + NOM (fini les 12 têtes muettes),
 * marque du pense-bête en surimpression (✕ exclu / ★ retenu — vos notes locales guident
 * le choix, jamais envoyées), état choisi fort (anneau chartreuse + coche), et la loupe :
 * la vraie carte Personnage en grand. `title` reste le libellé NU (ancrage stable).
 */
function DeclDieu({
  godId,
  chosen,
  mark,
  onPick,
}: {
  godId: GodId;
  chosen: boolean;
  mark: Mark;
  onPick: () => void;
}) {
  const ref = useCardInspect<HTMLButtonElement>({ face: godCardFace(godId) });
  return (
    <button
      ref={ref}
      className={[
        'decl-dieu',
        chosen ? 'decl-dieu--choisi' : '',
        !chosen && mark === 'exclu' ? 'decl-dieu--exclu' : '',
        !chosen && mark === 'suspect' ? 'decl-dieu--retenu' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={onPick}
      aria-pressed={chosen}
      title={GODS[godId].label}
      aria-label={
        mark === 'inconnu'
          ? GODS[godId].label
          : `${GODS[godId].label} — ${fr.penseBete.etats[mark]}`
      }
    >
      <span className="decl-dieu__portrait">
        <img src={godPortraitSrc(godId)} alt="" />
        {chosen && (
          <span className="decl-dieu__coche" aria-hidden="true">
            ✓
          </span>
        )}
        {!chosen && mark !== 'inconnu' && (
          <span className={`decl-dieu__marque decl-dieu__marque--${mark}`} aria-hidden="true">
            {mark === 'exclu' ? '✕' : '★'}
          </span>
        )}
      </span>
      <span className="decl-dieu__nom">{GODS[godId].label}</span>
    </button>
  );
}

/** Carnet filaire — même langage de trait que les pictos des trois temps. */
function NotebookIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="7" y="4.5" width="19" height="23" rx="2" />
      <path d="M12 4.5v23" />
      <path d="M16.5 11h5.5M16.5 16h5.5M16.5 21h3.5" />
    </svg>
  );
}

/** La pioche : pile visiblement empilée de versos (3–4 couches décalées) + compte. */
function DeckPile({
  kind,
  count,
  label,
}: {
  kind: 'attributs' | 'actions';
  count: number;
  label: string;
}) {
  const layers = count === 0 ? 0 : Math.min(4, 1 + Math.floor(count / 10));
  return (
    <div className="pioche-pile" title={fr.jeu.cartesRestantes(count)}>
      <div
        className={`pioche-pile__couches ${layers === 0 ? 'pioche-pile__couches--vide' : ''}`}
        data-pioche={kind}
      >
        {Array.from({ length: layers }, (_, k) => (
          <span key={k} className="pioche-pile__couche" style={{ '--k': k } as CSSProperties}>
            <GameCard size="sm" back={kind} />
          </span>
        ))}
        {layers === 0 && <span className="pioche-pile__creux">·</span>}
      </div>
      <span className="libelle pioche-pile__libelle">
        {label} · {count}
      </span>
    </div>
  );
}

/**
 * Mon dieu : face cachée en permanence sur la table ; MAINTENIR POUR RÉVÉLER affiche la
 * face révélée en GRAND (la loupe d'inspection, QoL §1) le temps de l'appui — pointeur
 * maintenu (souris/tactile) ou Espace/Entrée maintenu (clavier). Le survol seul ne montre
 * rien. L'identité (face, libellés) n'est montée dans le DOM QUE pendant l'appui.
 */
function MyGodCard({ god }: { god: GodId }) {
  const [held, setHeld] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const el = btnRef.current;
    if (!held || !el) return;
    showInspect({ anchor: el, face: godCardFace(god) });
    return () => hideInspect(el);
  }, [held, god]);

  return (
    <>
      {/* S4 (Q4) : un léger voile pendant la révélation — la carte tenue ne s'offre plus
          à un regard par-dessus l'épaule sur une table pleinement éclairée. */}
      {held && <span className="revele-voile" aria-hidden="true" />}
      <button
        ref={btnRef}
        className="dock-dieu"
        onPointerDown={(e) => {
          e.preventDefault();
          setHeld(true);
        }}
        onPointerUp={() => setHeld(false)}
        onPointerCancel={() => setHeld(false)}
        onPointerLeave={() => setHeld(false)}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            setHeld(true);
          }
        }}
        onKeyUp={() => setHeld(false)}
        onBlur={() => setHeld(false)}
        onContextMenu={(e) => e.preventDefault()}
        aria-label={fr.yourGod}
      >
        <GameCard size="md" back="personnages" inspect={false} />
      </button>
      <span className="dock-dieu__hint">{fr.jeu.monDieuHint}</span>
    </>
  );
}

/** The winner's god face on the end screen (only known for the viewer themself). */
function WinnerGod({ godId }: { godId: GodId | null }) {
  if (!godId) return null;
  return (
    <div className="fin__dieu">
      <GameCard
        size="lg"
        face={{
          src: godCardSrc(godId),
          alt: GODS[godId].label,
          typeLabel: 'Personnage',
          bodyLabel: GODS[godId].label,
          tint: 'teinte-personnage',
        }}
      />
    </div>
  );
}
