/**
 * Top bar: brand, tour, the three-phase rail (givre cell = current phase, like the active
 * cell of the pense-bête grid), meneur badge (chartreuse = divine), barrier progress dots,
 * help and leave.
 */
import type { PlayerProjection } from '@pantheons/engine';
import { fr } from '../i18n/fr.js';

const PHASES = ['pioche', 'question', 'reponse'] as const;

export function PhaseIndicator({
  p,
  onHelp,
  onExit,
}: {
  p: PlayerProjection;
  onHelp: () => void;
  onExit: () => void;
}) {
  const meneurName =
    p.meneur === p.self.userId
      ? `${p.self.displayName} (${fr.jeu.vous})`
      : (p.opponents.find((o) => o.userId === p.meneur)?.displayName ?? p.meneur);
  const live = [p.self, ...p.opponents].filter((x) => x.alive && x.connected);

  return (
    <div className="jeu__barre">
      <span className="jeu__marque">PANTHÉONS</span>
      <span className="jeu__tour">
        {fr.tour} {p.tour}
      </span>

      <div className="phases" role="group" aria-label="Phase du tour">
        {PHASES.map((ph) => (
          <span key={ph} className={`phases__etape ${p.phase === ph ? 'phases__etape--active' : ''}`}>
            {fr.phases[ph]}
          </span>
        ))}
      </div>

      <span className="jeu__meneur" title={fr.meneur}>
        ✶ {fr.meneur} · {meneurName}
      </span>

      <span className="jeu__barriere">
        <span className="barriere__points" aria-hidden="true">
          {live.map((x) => (
            <span
              key={x.userId}
              className={`barriere__point ${
                p.barrier.submitted.includes(x.userId) ? 'barriere__point--soumis' : ''
              }`}
            />
          ))}
        </span>
        {p.barrier.submitted.length}/{live.length}
        <button className="btn btn--nu btn--petit" onClick={onHelp} aria-label={fr.jeu.aide}>
          ?
        </button>
        <button className="btn btn--nu btn--petit" onClick={onExit}>
          {fr.jeu.quitter}
        </button>
      </span>
    </div>
  );
}
