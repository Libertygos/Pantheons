/**
 * A player's plateau: one question STACK per opposing seat + the special slot. Posed
 * questions are FACE DOWN (projection redacts them): the placer sees the face, the target
 * sees it once resolved, everyone else sees the category VERSO — exactly the physical
 * language of the assets (the four card backs identify the deck, never the content).
 * Réponse results land as OUI/NON chips in the legend colours (vert / vermillon).
 *
 * questionSlots is indexed by the TARGET's global seat (engine rules.ts applyQuestions);
 * we label each slot with the seat number + player name it points at.
 *
 * `onPickPlaced` (optional) puts the plateau in pick mode — Sabotage / Espionnage choose a
 * posed card by clicking it.
 */
import type { BoardView, PlacedCardView, PlayerProjection, QuestionCard } from '@pantheons/engine';
import { CardImage } from './CardImage.js';
import { cardBackSrc, questionCardSrc, SUBTYPE_LABEL, VALEUR_LABEL } from '../assets.js';
import { fr } from '../i18n/fr.js';

const BAND: Record<string, string> = {
  bleus: 'var(--turquoise)',
  verts: 'var(--vert)',
  rouges: 'var(--vermillon)',
};

export function describeQuestionCard(card: QuestionCard): string {
  if (card.type === 'attribut') return VALEUR_LABEL[card.valeur] ?? String(card.valeur);
  if (card.subtype === 'non' && card.valeur) {
    return `${SUBTYPE_LABEL.non} · ${VALEUR_LABEL[String(card.valeur)] ?? card.valeur}`;
  }
  return SUBTYPE_LABEL[card.subtype];
}

export function questionCardBand(card: QuestionCard): string | undefined {
  return card.type === 'attribut' ? BAND[String(card.valeur)] : undefined;
}

function PlacedCardFace({ placed }: { placed: PlacedCardView }) {
  const tint = placed.cardKind === 'attribut' ? 'teinte-attribut' : 'teinte-action';
  if (placed.card) {
    return (
      <CardImage
        src={questionCardSrc(placed.card)}
        alt={describeQuestionCard(placed.card)}
        typeLabel={placed.card.type === 'attribut' ? 'Attribut' : 'Action'}
        bodyLabel={describeQuestionCard(placed.card)}
        bandColor={questionCardBand(placed.card)}
        className={tint}
      />
    );
  }
  // Face down: the category verso (physical backs differ per deck).
  return (
    <CardImage
      src={cardBackSrc(placed.cardKind === 'attribut' ? 'attributs' : 'actions')}
      alt={fr.jeu.faceCachee}
      typeLabel={placed.cardKind === 'attribut' ? 'Attribut' : 'Action'}
      bodyLabel={fr.jeu.faceCachee}
      className={`carte--verso ${tint}`}
    />
  );
}

export function BoardSlots({
  board,
  ownerId,
  proj,
  onPickPlaced,
}: {
  board: BoardView;
  ownerId: string;
  proj: PlayerProjection;
  /** Pick mode (Sabotage / Espionnage): click a posed card to choose it. */
  onPickPlaced?: (placer: string, targetSeat: number, stackIndex: number, placed: PlacedCardView) => void;
}) {
  const nameOf = (uid: string) =>
    uid === proj.self.userId ? `${proj.self.displayName} (${fr.jeu.vous})` : (
      proj.opponents.find((o) => o.userId === uid)?.displayName ?? uid
    );

  return (
    <div className="plateau">
      {proj.seatOrder.map((uid, seat) => {
        if (uid === ownerId) return null; // no slot pointing at the board's owner
        const stack = board.questionSlots[seat] ?? [];
        return (
          <div className="slot" key={uid}>
            <span className="libelle slot__libelle">
              {seat + 1} · {nameOf(uid)}
            </span>
            {stack.length > 0 ? (
              <div className="slot__pile">
                {stack.map((placed, stackIndex) => {
                  const face = (
                    <div className="slot__carte" key={stackIndex}>
                      <PlacedCardFace placed={placed} />
                      {placed.answeredOui !== undefined && (
                        <span
                          className={`reponse-pastille ${
                            placed.answeredOui ? 'reponse-pastille--oui' : 'reponse-pastille--non'
                          }`}
                        >
                          {placed.answeredOui ? fr.oui : fr.non}
                        </span>
                      )}
                    </div>
                  );
                  return onPickPlaced ? (
                    <button
                      key={stackIndex}
                      className="slot__choix"
                      onClick={() => onPickPlaced(ownerId, seat, stackIndex, placed)}
                    >
                      {face}
                    </button>
                  ) : (
                    face
                  );
                })}
              </div>
            ) : (
              <div className="slot__creux" aria-label="Emplacement vide">
                ·
              </div>
            )}
          </div>
        );
      })}

      <div className="slot">
        <span className="libelle slot__libelle">{fr.jeu.emplacementSpecial}</span>
        {board.specialSlot ? (
          board.specialSlot.card ? (
            <CardImage
              src={questionCardSrc(board.specialSlot.card)}
              alt={fr.jeu.emplacementSpecial}
              typeLabel="Action"
              bodyLabel={describeQuestionCard(board.specialSlot.card)}
              className="teinte-action"
            />
          ) : (
            <CardImage
              src={cardBackSrc('actions')}
              alt={fr.jeu.faceCachee}
              typeLabel="Action"
              bodyLabel={fr.jeu.faceCachee}
              className="carte--verso teinte-action"
            />
          )
        ) : (
          <div className="slot__creux" aria-label="Emplacement spécial vide">
            ·
          </div>
        )}
      </div>
    </div>
  );
}
