/** Renders a player's plateau: 6 numbered opponent question-slots + the special slot. */
import type { Board, QuestionCard } from '@pantheons/engine';
import { CardImage } from './CardImage.js';
import { cardFaceSrc } from '../assets.js';
import { fr } from '../i18n/fr.js';

export function BoardSlots({ board, ownerName }: { board: Board; ownerName: string }) {
  return (
    <div style={{ border: '1px solid #332', borderRadius: 8, padding: 8 }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>{ownerName}</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {board.questionSlots.map((slot, i) => (
          <div key={i} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, opacity: 0.6 }}>#{i + 1}</div>
            {slot ? (
              <div>
                <CardImage src={cardFaceSrc(slot.card.id)} label={describe(slot.card)} width={64} />
                {slot.answeredOui !== undefined && (
                  <div style={{ fontSize: 11 }}>{slot.answeredOui ? fr.oui : fr.non}</div>
                )}
              </div>
            ) : (
              <EmptySlot />
            )}
          </div>
        ))}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 10, opacity: 0.6 }}>Spéciale</div>
          {board.specialSlot ? (
            <CardImage src={cardFaceSrc(board.specialSlot.card.id)} label="Spéciale" width={64} />
          ) : (
            <EmptySlot />
          )}
        </div>
      </div>
    </div>
  );
}

function EmptySlot() {
  return <div style={{ width: 64, height: 90, border: '1px dashed #443', borderRadius: 8 }} />;
}

function describe(card: QuestionCard): string {
  if (card.type === 'attribut') return `${card.axe}: ${String(card.valeur)}`;
  return card.subtype;
}
