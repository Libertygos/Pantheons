/**
 * Pense-bête — the per-player deduction grid. CLIENT-ONLY (Decision 5 / game-state-model.md):
 * this state is NEVER sent to the server and never appears in any projection. It is the
 * player's private scratch pad: for each opponent × axis-value, mark possible / excluded.
 */
import { useState } from 'react';
import { ALL_GODS, GENRES, COULEURS_YEUX, PANTHEONS } from '@pantheons/engine';
import { fr } from '../i18n/fr.js';

type Mark = 'unknown' | 'yes' | 'no';
const cycle: Record<Mark, Mark> = { unknown: 'yes', yes: 'no', no: 'unknown' };
const glyph: Record<Mark, string> = { unknown: '·', yes: '✓', no: '✕' };

export function PenseBeteGrid({ opponents }: { opponents: { userId: string; displayName: string }[] }) {
  // marks[opponentId][`${axe}:${valeur}`] = Mark
  const [marks, setMarks] = useState<Record<string, Record<string, Mark>>>({});

  const rows: { axe: keyof typeof fr.penseBete.axes; valeur: string; label: string }[] = [
    ...PANTHEONS.map((v) => ({ axe: 'pantheon' as const, valeur: v, label: v })),
    ...GENRES.map((v) => ({ axe: 'genre' as const, valeur: v, label: v })),
    ...COULEURS_YEUX.map((v) => ({ axe: 'couleurYeux' as const, valeur: v, label: v })),
  ];

  const get = (opp: string, key: string): Mark => marks[opp]?.[key] ?? 'unknown';
  const toggle = (opp: string, key: string) =>
    setMarks((m) => ({ ...m, [opp]: { ...m[opp], [key]: cycle[get(opp, key)] } }));

  return (
    <div style={{ fontSize: 12 }}>
      <strong>{fr.penseBete.title}</strong>
      <div style={{ opacity: 0.6, marginBottom: 4 }}>{fr.penseBete.note}</div>
      <table style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: 2 }} />
            {opponents.map((o) => (
              <th key={o.userId} style={{ padding: 2, fontWeight: 600 }}>
                {o.displayName}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const key = `${r.axe}:${r.valeur}`;
            return (
              <tr key={key}>
                <td style={{ padding: 2, whiteSpace: 'nowrap' }}>
                  <span style={{ opacity: 0.6 }}>{fr.penseBete.axes[r.axe]}:</span> {r.label}
                </td>
                {opponents.map((o) => (
                  <td key={o.userId} style={{ textAlign: 'center', padding: 2 }}>
                    <button
                      onClick={() => toggle(o.userId, key)}
                      style={{ width: 24, cursor: 'pointer', background: 'transparent', border: '1px solid #443', color: '#cdbde8' }}
                    >
                      {glyph[get(o.userId, key)]}
                    </button>
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ opacity: 0.5, marginTop: 4 }}>
        {ALL_GODS.length} dieux · {rows.length} valeurs d’attribut
      </div>
    </div>
  );
}
