/** In-match view — static-PNG display over the per-seat projection (moved from App.tsx). */
import type { PlayerProjection } from '@pantheons/engine';
import { GODS } from '@pantheons/engine';
import { PhaseIndicator } from '../components/PhaseIndicator.js';
import { BoardSlots } from '../components/BoardSlots.js';
import { PenseBeteGrid } from '../components/PenseBeteGrid.js';
import { CardImage } from '../components/CardImage.js';
import { godCardSrc } from '../assets.js';
import { fr } from '../i18n/fr.js';

export function GameView({
  proj,
  send,
  banner,
  over,
  onExit,
}: {
  proj: PlayerProjection;
  send: (type: string, payload: unknown) => void;
  banner: string | null;
  over: boolean;
  onExit: () => void;
}) {
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 16, fontFamily: 'system-ui, sans-serif' }}>
      {banner && <div style={{ background: '#402', padding: 8, borderRadius: 6, marginBottom: 8 }}>{banner}</div>}
      <PhaseIndicator p={proj} />

      <section style={{ display: 'flex', gap: 16 }}>
        <div>
          <h3>{fr.yourGod}</h3>
          <CardImage src={godCardSrc(proj.self.god)} label={GODS[proj.self.god].label} width={120} />
          <p style={{ fontSize: 12 }}>
            Attributs: {proj.self.hand.attributs.length} · Actions: {proj.self.hand.actions.length} · Pouvoirs: {proj.self.powers.length}
          </p>
          {!over && <PhaseActions proj={proj} send={send} />}
        </div>
        <div style={{ flex: 1 }}>
          <PenseBeteGrid opponents={proj.opponents.map((o) => ({ userId: o.userId, displayName: o.displayName }))} />
        </div>
      </section>

      <h3>Plateaux</h3>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {proj.seatOrder.map((uid) => {
          const board = proj.boardBySeat[uid];
          if (!board) return null;
          const name = uid === proj.self.userId ? proj.self.displayName : proj.opponents.find((o) => o.userId === uid)?.displayName ?? uid;
          return <BoardSlots key={uid} board={board} ownerName={name} />;
        })}
      </div>

      {over && (
        <div style={{ display: 'grid', placeItems: 'center', padding: 32, color: '#cdbde8' }}>
          <p>{fr.gameOver(proj.winner ?? '?')}</p>
          <button onClick={onExit} style={{ cursor: 'pointer', padding: '8px 20px' }}>
            {fr.appTitle} — accueil
          </button>
        </div>
      )}
    </div>
  );
}

/** Minimal phase-action controls wiring the three submissions to the barrier. */
function PhaseActions({ proj, send }: { proj: PlayerProjection; send: (t: string, p: unknown) => void }) {
  if (proj.barrier.youSubmitted) return <p style={{ opacity: 0.6 }}>{fr.submit} ✓</p>;
  switch (proj.phase) {
    case 'pioche':
      return <button onClick={() => send('pioche', {})}>{fr.phases.pioche} — {fr.submit}</button>;
    case 'question':
      // Full targeting UI is Phase-1 polish; submitting 0 questions is a valid pass.
      return <button onClick={() => send('question', { intent: { plays: [] } })}>{fr.pass}</button>;
    case 'reponse':
      return (
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => send('declaration', {})}>{fr.pass}</button>
          <button
            onClick={() => {
              const guesses: Record<string, string> = {};
              for (const o of proj.opponents) if (o.alive) guesses[o.userId] = proj.self.god; // placeholder guesses
              send('declaration', { guesses });
            }}
          >
            {fr.declaration.button}
          </button>
        </div>
      );
  }
}
