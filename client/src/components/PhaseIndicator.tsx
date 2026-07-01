/** Phase / meneur / tour indicator + barrier progress. */
import type { PlayerProjection } from '@pantheons/engine';
import { fr } from '../i18n/fr.js';

export function PhaseIndicator({ p }: { p: PlayerProjection }) {
  const meneurName = p.opponents.find((o) => o.userId === p.meneur)?.displayName
    ?? (p.meneur === p.self.userId ? p.self.displayName : p.meneur);
  const total = p.opponents.filter((o) => o.alive && o.connected).length + (p.self.alive ? 1 : 0);
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'baseline', padding: '6px 0' }}>
      <strong>{fr.phases[p.phase]}</strong>
      <span style={{ opacity: 0.7 }}>{fr.phaseHint[p.phase]}</span>
      <span>· {fr.tour} {p.tour}</span>
      <span>· {fr.meneur}: {meneurName}</span>
      <span style={{ marginLeft: 'auto', opacity: 0.7 }}>
        {p.barrier.submitted.length}/{total} {p.barrier.youSubmitted ? '✓' : ''}
      </span>
    </div>
  );
}
