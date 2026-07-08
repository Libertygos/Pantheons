/**
 * Le traqueur de phase (Visual V2 §6.4) — remplace le rail d'onglets ET la bannière
 * jaune : trois étapes PIOCHE → QUESTION → RÉPONSE, l'étape active en givre, une ligne
 * de consigne, les actions primaires attachées à l'étape active (children), et les
 * coches « prêt » PAR SIÈGE (le jeu simultané est la mécanique-titre : on montre QUI a
 * soumis, pas juste un compte).
 */
import { Fragment, type ReactNode } from 'react';
import type { PlayerProjection } from '@pantheons/engine';
import { fr } from '../i18n/fr.js';

const PHASES = ['pioche', 'question', 'reponse'] as const;

export function PhaseTracker({
  p,
  instruction,
  children,
}: {
  p: PlayerProjection;
  instruction: string | null;
  /** Boutons d'action de l'étape active (VALIDER LA PIOCHE, PASSER, DÉCLARER…). */
  children?: ReactNode;
}) {
  // Coches par siège, dans l'ordre de la table — vivants et connectés seulement,
  // comme l'ancienne barrière.
  const bySeat = p.seatOrder
    .map((uid) => (uid === p.self.userId ? p.self : p.opponents.find((o) => o.userId === uid)))
    .filter((x): x is NonNullable<typeof x> => Boolean(x && x.alive && x.connected));

  return (
    <div className="traqueur">
      <div className="traqueur__cadre surface-levee">
        <div className="traqueur__etapes" role="group" aria-label="Phase du tour">
          {PHASES.map((ph, i) => (
            <Fragment key={ph}>
              {i > 0 && <span className="traqueur__lien" aria-hidden="true" />}
              <span
                className={`traqueur__etape ${p.phase === ph ? 'traqueur__etape--active' : ''}`}
                aria-current={p.phase === ph ? 'step' : undefined}
              >
                <span className="traqueur__num" aria-hidden="true">
                  {i + 1}
                </span>
                {fr.phases[ph]}
              </span>
            </Fragment>
          ))}

          <span className="traqueur__prets">
            {bySeat.map((x) => {
              const ok = p.barrier.submitted.includes(x.userId);
              const nom = x.userId === p.self.userId ? `${x.displayName} (${fr.jeu.vous})` : x.displayName;
              return (
                <span
                  key={x.userId}
                  className={`pret-tique ${ok ? 'pret-tique--ok' : ''}`}
                  title={`${nom} — ${ok ? fr.lobby.ready : fr.lobby.notReady}`}
                  aria-label={`${nom} — ${ok ? fr.lobby.ready : fr.lobby.notReady}`}
                >
                  <span className="pret-tique__coche" aria-hidden="true">
                    {ok ? '✓' : '·'}
                  </span>
                  <span className="pret-tique__nom">{x.displayName}</span>
                </span>
              );
            })}
          </span>
        </div>

        {(instruction || children) && (
          <div className="traqueur__pied">
            {instruction && <span className="traqueur__consigne">{instruction}</span>}
            {children && <span className="traqueur__actions">{children}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
