/**
 * Pense-bête v2 (Visual V2 §7) — la grille de déduction, outil de premier rang.
 * Colonnes : les 12 dieux en tuiles-portraits (≥ 44px, chrome carte : arrondi, encre,
 * élévation). Rangées : vos adversaires, en-tête teinté à l'identité de leur siège (le
 * même accent que le badge « N possibles » de leur plaque). Cellules : bascules TRI-ÉTAT
 * inconnu → exclu (✕, la cellule s'éteint) → retenu (★ + anneau), état annoncé
 * (aria-pressed + libellé), navigation clavier complète (Tab + flèches).
 *
 * Présentationnel : les marques vivent dans usePenseBete (state/pense-bete.ts) — jamais
 * envoyées, persistance sessionStorage identique v1.
 */
import { useRef } from 'react';
import { ALL_GODS, GODS, type GodId } from '@pantheons/engine';
import type { Mark } from '../state/pense-bete.js';
import { godPortraitSrc } from '../assets.js';
import { fr } from '../i18n/fr.js';

const GLYPH: Record<Mark, string> = { inconnu: '', exclu: '✕', suspect: '★' };
const PRESSED: Record<Mark, boolean | 'mixed'> = { inconnu: false, exclu: true, suspect: 'mixed' };

export interface PenseBeteRow {
  userId: string;
  displayName: string;
  alive: boolean;
  /** Accent d'identité de siège (var CSS), partagé avec le badge de la plaque. */
  tint: string;
}

export function PenseBeteGrid({
  rows,
  get,
  toggle,
  remaining,
}: {
  rows: PenseBeteRow[];
  get: (opp: string, god: GodId) => Mark;
  toggle: (opp: string, god: GodId) => void;
  remaining: (opp: string) => number;
}) {
  const gridRef = useRef<HTMLDivElement | null>(null);

  /** Flèches : déplace le focus de cellule en cellule (les cellules restent tabbables). */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const deltas: Record<string, [number, number]> = {
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
    };
    const delta = deltas[e.key];
    if (!delta) return;
    const cell = (e.target as HTMLElement).closest<HTMLElement>('[data-r]');
    if (!cell) return;
    const r = Number(cell.dataset.r) + delta[0];
    const c = Number(cell.dataset.c) + delta[1];
    const next = gridRef.current?.querySelector<HTMLElement>(`[data-r='${r}'][data-c='${c}']`);
    if (next) {
      e.preventDefault();
      next.focus();
    }
  };

  return (
    <div>
      <div className="pb-grille" ref={gridRef} onKeyDown={handleKeyDown}>
        <div className="pb-grille__rang">
          <span className="pb-grille__coin" />
          {ALL_GODS.map((god) => (
            <span
              key={god.id}
              className="pb-dieu"
              title={`${god.label} — ${fr.penseBete.axes.genre} ${god.genre}, ${fr.penseBete.axes.couleurYeux} ${god.couleurYeux}, ${god.pantheon}`}
            >
              <img src={godPortraitSrc(god.id)} alt={god.label} />
            </span>
          ))}
        </div>

        {rows.map((opp, r) => (
          <div className="pb-grille__rang" key={opp.userId}>
            <span
              className="pb-grille__adv"
              style={{ '--teinte-rang': `var(${opp.tint})` } as React.CSSProperties}
              title={opp.displayName}
            >
              {opp.alive ? opp.displayName : `✕ ${opp.displayName}`}
            </span>
            {ALL_GODS.map((god, c) => {
              const mark = get(opp.userId, god.id);
              return (
                <button
                  key={god.id}
                  data-r={r}
                  data-c={c}
                  className={`pb-case ${mark === 'exclu' ? 'pb-case--exclu' : ''} ${
                    mark === 'suspect' ? 'pb-case--retenu' : ''
                  }`}
                  onClick={() => toggle(opp.userId, god.id)}
                  aria-pressed={PRESSED[mark]}
                  aria-label={`${opp.displayName} — ${GODS[god.id].label} : ${fr.penseBete.etats[mark]}`}
                >
                  <span aria-hidden="true">{GLYPH[mark]}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="pb-restants">
        {rows
          .filter((o) => o.alive)
          .map((o) => `${o.displayName} : ${fr.penseBete.restants(remaining(o.userId))}`)
          .join(' · ')}
      </div>
    </div>
  );
}
