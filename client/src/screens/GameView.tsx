/**
 * In-match view over the per-seat projection. Screen-first layout (not a table replica):
 * top bar (phase rail + barrier), opponents rank (compact tiles = targets during Question,
 * board selectors otherwise), one focused plateau, own-hand dock, collapsible pense-bête.
 * Cards are final images displayed as-is; all interaction is chrome around them.
 */
import { useEffect, useRef, useState } from 'react';
import type { GodId, PlacedCardView, PlayerProjection, QuestionPlay } from '@pantheons/engine';
import { GODS, ALL_GODS, data } from '@pantheons/engine';
import { PhaseIndicator } from '../components/PhaseIndicator.js';
import { BoardSlots, describeQuestionCard, questionCardBand } from '../components/BoardSlots.js';
import { PenseBeteGrid } from '../components/PenseBeteGrid.js';
import { CardImage } from '../components/CardImage.js';
import {
  cardBackSrc,
  godCardSrc,
  godPortraitSrc,
  penseBeteSrc,
  pouvoirCardSrc,
  questionCardSrc,
} from '../assets.js';
import { fr } from '../i18n/fr.js';

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
  const [viewedBoard, setViewedBoard] = useState(proj.self.userId);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [stagedPlays, setStagedPlays] = useState<QuestionPlay[]>([]);
  const [stagedSpeciales, setStagedSpeciales] = useState<StagedSpeciale[]>([]);
  /** Pouvoir actif en attente de sa cible (adversaire ou carte posée). */
  const [powerMode, setPowerMode] = useState<string | null>(null);
  const [declaring, setDeclaring] = useState(false);
  const [guesses, setGuesses] = useState<Record<string, GodId>>({});
  const [showHelp, setShowHelp] = useState(false);
  const [discardId, setDiscardId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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

  /** Sabotage / Espionnage : choisir une carte posée sur le plateau affiché. */
  const pickPlaced = (placer: string, targetSeat: number, stackIndex: number, placed: PlacedCardView) => {
    if (!powerPicksPlaced) return;
    if (powerMode === 'sabotage' && (placed.cardKind !== 'attribut' || placed.answeredOui !== undefined)) return;
    send('power', { effectKey: powerMode, placer, targetSeat, stackIndex });
    setPowerMode(null);
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

  const viewedOwner = proj.boardBySeat[viewedBoard] ? viewedBoard : me.userId;
  const viewedName =
    viewedOwner === me.userId
      ? fr.jeu.votrePlateau
      : fr.jeu.plateauDe(proj.opponents.find((o) => o.userId === viewedOwner)?.displayName ?? viewedOwner);

  return (
    <div className="jeu">
      <PhaseIndicator p={proj} onHelp={() => setShowHelp(true)} onExit={onExit} />

      {/* rang des adversaires */}
      <div className="table-rang">
        {proj.opponents.map((opp) => {
          const seat = seatOf(opp.userId);
          const isTargeted =
            (stagedCountBySeat.get(seat) ?? 0) > 0 || stagedSpeciales.some((s) => s.targetSeat === seat);
          const targetable =
            (powerPicksOpponent && opp.alive) ||
            (targeting &&
              opp.alive &&
              (selectedSpecialeACible
                ? stagedSpeciales.length === 0
                : (stagedCountBySeat.get(seat) ?? 0) < maxPerTarget && stagedPlays.length < rules.max));
          return (
            <button
              key={opp.userId}
              className={[
                'adversaire',
                viewedOwner === opp.userId ? 'adversaire--regarde' : '',
                targetable ? 'adversaire--cible' : '',
                isTargeted ? 'adversaire--choisi' : '',
                !opp.alive ? 'adversaire--mort' : '',
              ].join(' ')}
              onClick={() => {
                if (targetable) stageOn(opp.userId);
                else if (opp.alive || proj.boardBySeat[opp.userId]) setViewedBoard(opp.userId);
              }}
            >
              {proj.meneur === opp.userId && <span className="adversaire__etiquette">{fr.meneur}</span>}
              {!opp.alive && (
                <span className="adversaire__etiquette adversaire__etiquette--elimine">
                  {fr.jeu.elimine}
                </span>
              )}
              <span className="adversaire__nom">
                <span className={`point-conn ${opp.connected ? '' : 'point-conn--deco'}`} />
                <span className="adversaire__nom-texte">{opp.displayName}</span>
              </span>
              <span className="adversaire__compteurs">
                <span title={fr.jeu.attributs}>A {opp.handCounts.attributs}</span>
                <span title={fr.jeu.actions}>Ac {opp.handCounts.actions}</span>
                <span title={fr.jeu.pouvoir}>P {opp.powerCount}</span>
                {opp.hasSpecialCard && <span title={fr.jeu.emplacementSpecial}>S✶</span>}
              </span>
              {targetable && <span className="adversaire__cible-note">{fr.jeu.poserIci}</span>}
              {isTargeted && <span className="adversaire__cible-note">{fr.jeu.cible}</span>}
            </button>
          );
        })}
      </div>

      {/* bannières */}
      {(banner || notice || info) && (
        <div className="consigne">
          {banner && (
            <div className="notice notice--erreur" role="alert">
              {banner}
            </div>
          )}
          {notice && (
            <div className="notice" role="status" style={{ marginTop: banner ? 8 : 0 }}>
              {notice}
              <button className="btn btn--nu btn--petit" onClick={() => setNotice(null)}>
                ✕
              </button>
            </div>
          )}
          {info && (
            <div className="notice" role="status" style={{ marginTop: banner || notice ? 8 : 0 }}>
              {info}
              <button className="btn btn--nu btn--petit" onClick={() => onInfoDismiss?.()}>
                ✕
              </button>
            </div>
          )}
        </div>
      )}

      {/* consigne de phase + actions */}
      {!over && alive && (
        <div className="consigne">
          <div className={`consigne__cadre ${youSubmitted ? 'consigne__cadre--attente' : ''}`}>
            <span className="consigne__texte">
              {powerMode
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
                      : fr.consignes.reponse}
            </span>
            {powerMode && (
              <span className="consigne__actions">
                <button className="btn btn--nu btn--petit" onClick={() => setPowerMode(null)}>
                  {fr.jeu.annulerPouvoir}
                </button>
              </span>
            )}
            {!youSubmitted && (
              <span className="consigne__actions">
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
                      <button
                        className="btn btn--petit"
                        onClick={stageSpeciale}
                        disabled={stagedSpeciales.length > 0}
                      >
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
              </span>
            )}
          </div>
        </div>
      )}

      {/* centre : plateau + pense-bête */}
      <div className="jeu__centre">
        <section className="plateau-zone">
          <div className="plateau__proprio">
            <span className="plateau__proprio-nom">{viewedName}</span>
            {viewedOwner !== me.userId && (
              <button className="btn btn--nu btn--petit" onClick={() => setViewedBoard(me.userId)}>
                {fr.jeu.voirMonPlateau}
              </button>
            )}
          </div>
          {proj.boardBySeat[viewedOwner] && (
            <BoardSlots
              board={proj.boardBySeat[viewedOwner]!}
              ownerId={viewedOwner}
              proj={proj}
              onPickPlaced={powerPicksPlaced ? pickPlaced : undefined}
            />
          )}
        </section>

        <aside className="pense-bete">
          <PenseBeteGrid
            roomId={proj.roomId}
            opponents={proj.opponents.map((o) => ({
              userId: o.userId,
              displayName: o.displayName,
              alive: o.alive,
            }))}
          />
        </aside>
      </div>

      {/* dock : mon dieu, ma main, mon pouvoir */}
      <div className="main-dock">
        <div className="main-dock__interieur">
          <div className="mon-dieu">
            <span className="libelle main-dock__section-titre">{fr.yourGod}</span>
            <MyGodCard god={me.god} />
          </div>

          <div>
            <span className="libelle main-dock__section-titre">
              {fr.jeu.maMain} — {handCards.attributs.length + handCards.actions.length}
            </span>
            <div className="ma-main">
              {[...handCards.attributs, ...handCards.actions].map((card) => {
                const staged = stagedCardIds.has(card.id);
                const target = targetNameOf(card.id);
                return (
                  <button
                    key={card.id}
                    className={[
                      'carte-main',
                      selectedCardId === card.id ? 'carte-main--choisie' : '',
                      staged ? 'carte-main--posee' : '',
                    ].join(' ')}
                    disabled={proj.phase !== 'question' || youSubmitted || !alive}
                    onClick={() => {
                      if (staged) unstage(card.id);
                      else setSelectedCardId((cur) => (cur === card.id ? null : card.id));
                    }}
                    title={describeQuestionCard(card)}
                  >
                    <CardImage
                      src={questionCardSrc(card)}
                      alt={describeQuestionCard(card)}
                      typeLabel={card.type === 'attribut' ? 'Attribut' : 'Action'}
                      bodyLabel={describeQuestionCard(card)}
                      bandColor={questionCardBand(card)}
                      className={card.type === 'attribut' ? 'teinte-attribut' : 'teinte-action'}
                    />
                    <span className="carte-main__note">
                      {staged && target ? `→ ${target} · ${fr.consignes.retirer}` : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mon-pouvoir">
            <span className="libelle main-dock__section-titre">{fr.jeu.pouvoir}</span>
            {powerCards.map((pow) => {
              const def = data.POWERS[pow.effectKey];
              const activable =
                def?.kind === 'active' && alive && !over && proj.status === 'enCours';
              return (
                <div key={pow.id} className="mon-pouvoir__carte">
                  <CardImage
                    src={pouvoirCardSrc(pow.effectKey)}
                    alt={def?.label ?? fr.jeu.pouvoir}
                    typeLabel={fr.jeu.pouvoir}
                    bodyLabel={def?.label ?? pow.effectKey.replace(/_/g, ' ')}
                    className="teinte-pouvoir"
                  />
                  {activable && (
                    <button
                      className="btn btn--petit mon-pouvoir__utiliser"
                      onClick={() => {
                        if (pow.effectKey === 'deduction') send('power', { effectKey: 'deduction' });
                        else setPowerMode(pow.effectKey);
                      }}
                    >
                      {powerMode === pow.effectKey ? fr.jeu.annulerPouvoir : fr.jeu.utiliser}
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
                  <CardImage
                    src={pouvoirCardSrc(pow.effectKey)}
                    alt={data.POWERS[pow.effectKey]?.label ?? pow.effectKey}
                    typeLabel={fr.jeu.pouvoir}
                    bodyLabel={data.POWERS[pow.effectKey]?.label ?? pow.effectKey.replace(/_/g, ' ')}
                    className="teinte-pouvoir"
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
            {proj.winner && (
              <WinnerGod
                godId={proj.winner === me.userId ? me.god : null}
              />
            )}
            <button className="btn btn--givre" onClick={onExit}>
              {fr.fin.retour}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Own god card: face-down by default, revealed on hover/focus or tap-toggle (touch). */
function MyGodCard({ god }: { god: GodId }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <>
      <button
        className="mon-dieu__scene"
        data-revele={revealed}
        onClick={() => setRevealed((r) => !r)}
        aria-label={`${fr.yourGod} — ${GODS[god].label}`}
      >
        <span className="mon-dieu__dos">
          <CardImage
            src={cardBackSrc('personnages')}
            alt=""
            typeLabel="Personnage"
            bodyLabel="? ? ?"
            className="teinte-personnage"
          />
        </span>
        <span className="mon-dieu__face">
          <CardImage
            src={godCardSrc(god)}
            alt={GODS[god].label}
            typeLabel="Personnage"
            bodyLabel={GODS[god].label}
            className="teinte-personnage"
          />
        </span>
      </button>
      <span className="mon-dieu__hint">{fr.jeu.monDieuHint}</span>
    </>
  );
}

/** The winner's god face on the end screen (only known for the viewer themself). */
function WinnerGod({ godId }: { godId: GodId | null }) {
  if (!godId) return null;
  return (
    <div style={{ width: 130, margin: '0 auto 22px' }}>
      <CardImage
        src={godCardSrc(godId)}
        alt={GODS[godId].label}
        typeLabel="Personnage"
        bodyLabel={GODS[godId].label}
      />
    </div>
  );
}
