/**
 * Siège d'adversaire (Visual V2 §6.1–6.2) : une plaque sur l'arc haut de la table —
 * vignette dos-de-carte générique (jamais d'identité), nom + point de connexion, badges
 * (meneur / éliminé / prêt), compteurs en jetons libellés (plus aucun code à une lettre) —
 * et, DESSOUS, la zone de pose : les questions jouées CONTRE ce joueur, en petit éventail,
 * là où la table raconte « qui s'est fait demander quoi ».
 *
 * La zone est aussi l'affordance : bouton « Poser ici » + halo pulsé quand elle est une
 * cible légale de l'action en cours ; les cartes posées deviennent cliquables en mode
 * Sabotage / Espionnage. Un siège éliminé se désature — son dieu RESTE face cachée
 * (règle du jeu : le dieu d'un éliminé n'est jamais révélé ; la projection ne l'envoie pas).
 */
import type { CSSProperties, ReactNode } from 'react';
import type { OpponentView, PlacedCardView } from '@pantheons/engine';
import { GameCard } from './GameCard.js';
import { describeQuestionCard, questionCardBand } from './card-text.js';
import { questionCardSrc } from '../assets.js';
import { fr } from '../i18n/fr.js';

/** Une carte posée contre ce siège, avec sa provenance (adressage moteur du plateau du poseur). */
export interface SeatQuestion {
  placerId: string;
  placerName: string;
  stackIndex: number;
  placed: PlacedCardView;
}

/** Mini-carte posée : face si visible pour ce spectateur, sinon le verso de catégorie. */
export function PlacedMiniCard({ placed, title }: { placed: PlacedCardView; title?: string }) {
  const card = placed.card;
  return (
    <span className="pose" title={title}>
      {card ? (
        <GameCard
          size="sm"
          face={{
            src: questionCardSrc(card),
            alt: describeQuestionCard(card),
            typeLabel: card.type === 'attribut' ? 'Attribut' : 'Action',
            bodyLabel: describeQuestionCard(card),
            bandColor: questionCardBand(card),
            tint: card.type === 'attribut' ? 'teinte-attribut' : 'teinte-action',
          }}
        />
      ) : (
        <GameCard size="sm" back={placed.cardKind === 'attribut' ? 'attributs' : 'actions'} />
      )}
      {placed.answeredOui !== undefined && (
        <span
          className={`reponse-pastille ${placed.answeredOui ? 'reponse-pastille--oui' : 'reponse-pastille--non'}`}
        >
          {/* icône + couleur, jamais la couleur seule (§8.3) */}
          {placed.answeredOui ? `✓ ${fr.oui}` : `✗ ${fr.non}`}
        </span>
      )}
    </span>
  );
}

export function SeatPlaque({
  opp,
  seat,
  arcIndex,
  isMeneur,
  submitted,
  possibles,
  tint,
  questions,
  stagedGhosts,
  zoneLegale,
  plaqueLegale,
  pickMode,
  canPick,
  onZone,
  onPlaque,
  onPick,
}: {
  opp: OpponentView;
  /** Siège global (numérotation 1..n de la table physique). */
  seat: number;
  /** Index centré sur l'arc (−(n−1)/2 … +(n−1)/2) pour la courbe. */
  arcIndex: number;
  isMeneur: boolean;
  submitted: boolean;
  /** Conclusion du pense-bête : dieux encore possibles pour ce siège (badge vivant). */
  possibles: number;
  /** Accent d'identité de siège (var CSS) — le même que sa rangée du pense-bête. */
  tint: string;
  questions: SeatQuestion[];
  /** Prévisualisations locales : cartes de MA main mises en attente sur ce siège. */
  stagedGhosts: ReactNode;
  /** La zone de pose est une cible légale de la question sélectionnée. */
  zoneLegale: boolean;
  /** La plaque elle-même est cliquable (pouvoir ciblant un adversaire). */
  plaqueLegale: boolean;
  /** Sabotage / Espionnage : les cartes posées deviennent choisissables. */
  pickMode: boolean;
  canPick: (placed: PlacedCardView) => boolean;
  onZone: () => void;
  onPlaque: () => void;
  onPick: (q: SeatQuestion) => void;
}) {
  const style = { '--s': arcIndex, '--abs-s': Math.abs(arcIndex) } as CSSProperties;

  const plaqueContenu = (
    <>
      <GameCard size="xs" back="personnages" className="place__vignette" />
      <span className="place__identite">
        <span className="place__nom">
          <span className={`point-conn ${opp.connected ? '' : 'point-conn--deco'}`} />
          <span className="place__nom-texte">{opp.displayName}</span>
          {submitted && opp.alive && (
            <span className="place__pret" title={fr.lobby.ready} aria-label={fr.lobby.ready}>
              ✓
            </span>
          )}
        </span>
        <span className="place__jetons">
          <span className="jeton-stat jeton-stat--attribut" title={fr.jeu.statLong.attributs(opp.handCounts.attributs)} aria-label={fr.jeu.statLong.attributs(opp.handCounts.attributs)}>
            {fr.jeu.statCourt.attributs} {opp.handCounts.attributs}
          </span>
          <span className="jeton-stat jeton-stat--action" title={fr.jeu.statLong.actions(opp.handCounts.actions)} aria-label={fr.jeu.statLong.actions(opp.handCounts.actions)}>
            {fr.jeu.statCourt.actions} {opp.handCounts.actions}
          </span>
          <span className="jeton-stat jeton-stat--pouvoir" title={fr.jeu.statLong.pouvoirs(opp.powerCount)} aria-label={fr.jeu.statLong.pouvoirs(opp.powerCount)}>
            {fr.jeu.statCourt.pouvoirs} {opp.powerCount}
          </span>
          {opp.hasSpecialCard && (
            <span className="jeton-stat jeton-stat--speciale" title={fr.jeu.statLong.speciale} aria-label={fr.jeu.statLong.speciale}>
              {fr.jeu.statCourt.speciale} ✓
            </span>
          )}
          {opp.alive && (
            <span
              className="place__possibles"
              style={{ '--teinte-place': `var(${tint})` } as CSSProperties}
              title={`${fr.penseBete.title} — ${fr.penseBete.restants(possibles)}`}
            >
              {fr.penseBete.restants(possibles)}
            </span>
          )}
        </span>
      </span>
    </>
  );

  return (
    <div className={`place ${!opp.alive ? 'place--elimine' : ''}`} style={style}>
      {isMeneur && <span className="place__etiquette">{fr.meneur}</span>}
      {!opp.alive && <span className="place__etiquette place__etiquette--elimine">{fr.jeu.elimine}</span>}
      {/* B13 : la déconnexion en toutes lettres — le point 2px ne portait pas l'état */}
      {opp.alive && !opp.connected && (
        <span className="place__etiquette place__etiquette--deco">{fr.jeu.deconnecteCourt}</span>
      )}

      {plaqueLegale ? (
        <button className="place__plaque place__plaque--legale" onClick={onPlaque}>
          {plaqueContenu}
        </button>
      ) : (
        <div className="place__plaque">{plaqueContenu}</div>
      )}

      <div className={`place__zone ${zoneLegale ? 'place__zone--legale' : ''}`}>
        <span className="libelle place__zone-libelle">
          {seat} · {opp.displayName}
        </span>
        <div className="pose-ev">
          {questions.map((q, i) => {
            const desc = q.placed.card ? describeQuestionCard(q.placed.card) : fr.jeu.faceCachee;
            const titre = `${desc} — ${fr.jeu.poseePar(q.placerName)}`;
            return pickMode && canPick(q.placed) ? (
              <button
                key={`${q.placerId}:${q.stackIndex}`}
                className="pose-ev__item pose-ev__item--choisissable"
                style={{ '--k': i } as CSSProperties}
                onClick={() => onPick(q)}
                title={titre}
              >
                <PlacedMiniCard placed={q.placed} />
              </button>
            ) : (
              <span key={`${q.placerId}:${q.stackIndex}`} className="pose-ev__item" style={{ '--k': i } as CSSProperties}>
                <PlacedMiniCard placed={q.placed} title={titre} />
              </span>
            );
          })}
          {stagedGhosts}
          {questions.length === 0 && !stagedGhosts && !zoneLegale && (
            // S5 : le creux garde son « · » discret mais se laisse lire (title = aria).
            <span
              className="pose-ev__creux"
              title={fr.jeu.emplacementVide}
              aria-label={fr.jeu.emplacementVide}
            >
              ·
            </span>
          )}
          {zoneLegale && (
            <button className="pose-ev__deposer" onClick={onZone}>
              {fr.jeu.poserIci}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
