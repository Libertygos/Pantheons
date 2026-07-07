/**
 * A player's plateau: one question slot per opposing seat + the special slot. Placed cards
 * are public (rules) and rendered as their final face images; réponse results land as
 * OUI/NON chips in the legend colours (vert / vermillon).
 *
 * questionSlots is indexed by the TARGET's global seat (engine rules.ts applyQuestions);
 * we label each slot with the seat number + player name it points at.
 */
import type { Board, PlayerProjection, QuestionCard } from '@pantheons/engine';
import { CardImage } from './CardImage.js';
import { questionCardSrc, SUBTYPE_LABEL, VALEUR_LABEL } from '../assets.js';
import { fr } from '../i18n/fr.js';

const BAND: Record<string, string> = {
  bleus: 'var(--turquoise)',
  verts: 'var(--vert)',
  rouges: 'var(--vermillon)',
};

export function describeQuestionCard(card: QuestionCard): string {
  if (card.type === 'attribut') return VALEUR_LABEL[card.valeur] ?? String(card.valeur);
  return SUBTYPE_LABEL[card.subtype];
}

export function questionCardBand(card: QuestionCard): string | undefined {
  return card.type === 'attribut' ? BAND[String(card.valeur)] : undefined;
}

export function BoardSlots({ board, ownerId, proj }: { board: Board; ownerId: string; proj: PlayerProjection }) {
  const nameOf = (uid: string) =>
    uid === proj.self.userId ? `${proj.self.displayName} (${fr.jeu.vous})` : (
      proj.opponents.find((o) => o.userId === uid)?.displayName ?? uid
    );

  return (
    <div className="plateau">
      {proj.seatOrder.map((uid, seat) => {
        if (uid === ownerId) return null; // no slot pointing at the board's owner
        const placed = board.questionSlots[seat] ?? null;
        return (
          <div className="slot" key={uid}>
            <span className="libelle slot__libelle">
              {seat + 1} · {nameOf(uid)}
            </span>
            {placed ? (
              <div className="slot__carte">
                <CardImage
                  src={questionCardSrc(placed.card)}
                  alt={describeQuestionCard(placed.card)}
                  typeLabel={placed.card.type === 'attribut' ? 'Attribut' : 'Action'}
                  bodyLabel={describeQuestionCard(placed.card)}
                  bandColor={questionCardBand(placed.card)}
                />
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
          <CardImage
            src={questionCardSrc(board.specialSlot.card)}
            alt={fr.jeu.emplacementSpecial}
            typeLabel="Action"
            bodyLabel={describeQuestionCard(board.specialSlot.card)}
          />
        ) : (
          <div className="slot__creux" aria-label="Emplacement spécial vide">
            ·
          </div>
        )}
      </div>
    </div>
  );
}
