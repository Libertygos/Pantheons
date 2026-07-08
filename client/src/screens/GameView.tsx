/**
 * In-match view over the per-seat projection — Visual V2 « la table » (§6) : trois bandes
 * horizontales. En haut, les sièges adverses sur un arc, chacun portant SES questions
 * reçues (la table montre « qui s'est fait demander quoi »). Au centre, la table partagée :
 * traqueur de phase (consigne + actions + coches prêt par siège), pioches empilées,
 * indicateur de tour, événements transients. En bas, mon dock : VOTRE DIEU (face cachée,
 * appui maintenu = retournement 3D), MA MAIN en éventail, CONTRE VOUS / SPÉCIALE, POUVOIR.
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
import { describeQuestionCard, questionCardBand } from '../components/card-text.js';
import { usePenseBete } from '../state/pense-bete.js';
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

export function GameView({
  proj,
  send,
  banner,
  info,
  onInfoDismiss,
  over,
  onExit,
}: {
  proj: PlayerProjection;
  send: (type: string, payload: unknown) => void;
  banner: string | null;
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
  const [discardId, setDiscardId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [flights, setFlights] = useState<Flight[]>([]);
  const notesCloseRef = useRef<HTMLButtonElement | null>(null);
  const penseBete = usePenseBete(proj.roomId);

  /** Éléments réels couverts par un vol en cours. */
  const volMain = new Set(flights.filter((f) => f.hide === 'main').map((f) => f.cardId));
  const volFantome = new Set(flights.filter((f) => f.hide === 'fantome').map((f) => f.cardId));

  // Tiroir : ESC ferme, l'ouverture donne le focus au bouton de fermeture.
  useEffect(() => {
    if (!showNotes) return;
    notesCloseRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowNotes(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showNotes]);

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
    }
  }, [phaseKey]);

  // Surface new eliminations (declaration failed — god stays hidden).
  const prevEliminated = useRef<string[]>(proj.eliminated);
  useEffect(() => {
    const fresh = proj.eliminated.filter((uid) => !prevEliminated.current.includes(uid));
    prevEliminated.current = proj.eliminated;
    if (fresh.length > 0) {
      const names = fresh.map((uid) =>
        uid === proj.self.userId
          ? `${proj.self.displayName} (${fr.jeu.vous})`
          : (proj.opponents.find((o) => o.userId === uid)?.displayName ?? uid),
      );
      setNotice(names.map((n) => fr.declaration.eliminated(n)).join(' '));
    }
  }, [proj.eliminated, proj.opponents, proj.self.displayName, proj.self.userId]);

  const me = proj.self;
  const alive = me.alive;
  const youSubmitted = proj.barrier.youSubmitted;
  const handCards = me.handCards ?? { attributs: [], actions: [] };
  const powerCards = me.powerCards ?? [];
  const liveTotal = [me, ...proj.opponents].filter((x) => x.alive && x.connected).length;

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
    if (powerCards.length > 1 && !discardId) return;
    send('pioche', powerCards.length > 1 ? { discardPowerId: discardId } : {});
  };

  const submitQuestions = () => {
    send('question', { intent: { plays: stagedPlays }, specialePlays: stagedSpeciales });
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

  const liveOpponents = proj.opponents.filter((o) => o.alive);
  const declarationComplete = liveOpponents.every((o) => guesses[o.userId]);

  const submitDeclaration = () => {
    if (!declarationComplete) return;
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
  const instruction =
    over || !alive
      ? null
      : powerMode
        ? powerPicksOpponent
          ? fr.jeu.choisirCiblePouvoir(data.POWERS[powerMode]?.label ?? powerMode)
          : fr.jeu.choisirCartePosee(data.POWERS[powerMode]?.label ?? powerMode)
        : youSubmitted
          ? fr.jeu.enAttente(proj.barrier.submitted.length, liveTotal)
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

  const trackerActions =
    over || !alive ? null : powerMode ? (
      <button className="btn btn--nu btn--petit" onClick={() => setPowerMode(null)}>
        {fr.jeu.annulerPouvoir}
      </button>
    ) : youSubmitted ? null : (
      <>
        {proj.phase === 'pioche' && (
          <button
            className="btn btn--givre btn--petit"
            onClick={submitPioche}
            disabled={powerCards.length > 1 && !discardId}
          >
            {fr.consignes.validerPioche}
          </button>
        )}
        {proj.phase === 'question' && (
          <>
            {selectedIsSpeciale && !selectedSpecialeACible && (
              <button className="btn btn--petit" onClick={stageSpeciale} disabled={stagedSpeciales.length > 0}>
                {fr.consignes.poserSpeciale}
              </button>
            )}
            <button className="btn btn--givre btn--petit" onClick={submitQuestions}>
              {fr.consignes.validerQuestions(stagedPlays.length)}
            </button>
          </>
        )}
        {proj.phase === 'reponse' && (
          <>
            <button className="btn btn--petit" onClick={() => send('declaration', {})}>
              {fr.pass}
            </button>
            <button className="btn btn--primaire btn--petit" onClick={() => setDeclaring(true)}>
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

  const hand = [...handCards.attributs, ...handCards.actions];

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

  return (
    <div className="jeu">
      <GameTopBar
        tour={proj.tour}
        notesOpen={showNotes}
        onNotes={() => setShowNotes((v) => !v)}
        onHelp={() => setShowHelp(true)}
        onExit={onExit}
      />

      {/* bande haute : l'arc des sièges */}
      <div className="places-arc">
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
      <PhaseTracker p={proj} instruction={instruction}>
        {trackerActions}
      </PhaseTracker>

      {/* centre : la table partagée */}
      <section className="table-centre">
        {(banner || notice || info) && (
          <div className="table-centre__notices">
            {banner && (
              <div className="notice notice--erreur" role="alert">
                {banner}
              </div>
            )}
            {notice && (
              <div className="notice" role="status">
                {notice}
                <button className="btn btn--nu btn--petit" onClick={() => setNotice(null)}>
                  ✕
                </button>
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

      {/* tiroir pense-bête : glisse sur la table, la table s'assombrit derrière */}
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

      {/* bande basse : mon dock */}
      <div className="dock surface-levee">
        <div className="dock__interieur">
          <div className="dock__zone dock__zone--dieu">
            <span className="libelle dock__titre">{fr.yourGod}</span>
            <MyGodCard god={me.god} />
          </div>

          <div className="dock__zone dock__zone--main">
            <span className="libelle dock__titre">
              {fr.jeu.maMain} — {hand.length}
            </span>
            <div className="main-ev" style={{ '--n': hand.length } as CSSProperties}>
              {hand.map((card, idx) => {
                const i = idx - (hand.length - 1) / 2;
                const staged = stagedCardIds.has(card.id);
                const target = targetNameOf(card.id);
                return (
                  <button
                    key={card.id}
                    data-carte-main={card.id}
                    className={[
                      'main-ev__carte',
                      selectedCardId === card.id ? 'main-ev__carte--choisie' : '',
                      staged ? 'main-ev__carte--posee' : '',
                    ].join(' ')}
                    style={
                      {
                        '--i': i,
                        '--abs-i': Math.abs(i),
                        '--z': 10 + idx,
                        visibility: volMain.has(card.id) ? 'hidden' : undefined,
                      } as CSSProperties
                    }
                    disabled={proj.phase !== 'question' || youSubmitted || !alive}
                    onClick={() => {
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
          </div>

          {(receivedQuestions.length > 0 || mySpecial || stagedSpecialeSansCibleCard || specialeZoneLegale) && (
            <div className="dock__zone dock__zone--recu">
              {receivedQuestions.length > 0 && (
                <>
                  <span className="libelle dock__titre">{fr.jeu.contreVous}</span>
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
            <span className="libelle dock__titre">{fr.jeu.pouvoir}</span>
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
                  <span className="choix-carte__note">
                    {discardId === pow.id ? 'défausser celui-ci' : ''}
                  </span>
                </button>
              ))}
            </div>
            <div className="modale__pied">
              <button className="btn btn--givre" onClick={submitPioche} disabled={!discardId}>
                {fr.consignes.validerPioche}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* modale : déclaration Panthéons */}
      {declaring && (
        <div className="voile">
          <div className="modale">
            <h2 className="titre-affiche modale__titre">{fr.declaration.title}</h2>
            <p className="modale__texte">{fr.declaration.instruction}</p>
            {liveOpponents.map((opp) => (
              <div className="decl-rang" key={opp.userId}>
                <div className="decl-rang__nom">
                  {opp.displayName}
                  <span className="decl-rang__choix">
                    {guesses[opp.userId] ? GODS[guesses[opp.userId]!].label : fr.declaration.aChoisir}
                  </span>
                </div>
                <div className="decl-dieux">
                  {ALL_GODS.map((god) => (
                    <button
                      key={god.id}
                      className={`decl-dieu ${guesses[opp.userId] === god.id ? 'decl-dieu--choisi' : ''}`}
                      onClick={() => setGuesses((g) => ({ ...g, [opp.userId]: god.id }))}
                      title={god.label}
                    >
                      <img src={godPortraitSrc(god.id)} alt={god.label} />
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div className="modale__pied">
              <button className="btn btn--nu" onClick={() => setDeclaring(false)}>
                {fr.declaration.cancel}
              </button>
              <button
                className="btn btn--primaire"
                onClick={submitDeclaration}
                disabled={!declarationComplete}
              >
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
              alt="Pense-bête des 12 dieux"
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

      {/* fin de partie */}
      {over && (
        <div className="voile">
          <div className="modale fin">
            <h2 className="titre-affiche fin__titre">{fr.fin.titre}</h2>
            <div className="tri-bande" aria-hidden="true" style={{ margin: '18px 0' }}>
              <span />
              <span />
              <span />
            </div>
            <p className="fin__texte">
              {proj.winner === me.userId
                ? fr.fin.vainqueurVous
                : fr.fin.vainqueur(
                    proj.opponents.find((o) => o.userId === proj.winner)?.displayName ??
                      proj.winner ??
                      '—',
                  )}
            </p>
            {proj.winner && <WinnerGod godId={proj.winner === me.userId ? me.god : null} />}
            <button className="btn btn--givre" onClick={onExit}>
              {fr.fin.retour}
            </button>
          </div>
        </div>
      )}
    </div>
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
 * Mon dieu : face cachée par défaut ; le retournement 3D se tient tant qu'on maintient —
 * survol (pointeur fin), appui maintenu (tactile), Espace/Entrée maintenu (clavier).
 */
function MyGodCard({ god }: { god: GodId }) {
  const [held, setHeld] = useState(false);
  return (
    <>
      <button
        className="dock-dieu"
        onPointerDown={(e) => {
          e.preventDefault();
          setHeld(true);
        }}
        onPointerUp={() => setHeld(false)}
        onPointerCancel={() => setHeld(false)}
        onPointerEnter={(e) => {
          if (e.pointerType === 'mouse') setHeld(true);
        }}
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
        aria-label={`${fr.yourGod} — ${GODS[god].label}`}
      >
        <GameCard
          size="md"
          back="personnages"
          revealed={held}
          face={{
            src: godCardSrc(god),
            alt: GODS[god].label,
            typeLabel: 'Personnage',
            bodyLabel: GODS[god].label,
            tint: 'teinte-personnage',
          }}
        />
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
