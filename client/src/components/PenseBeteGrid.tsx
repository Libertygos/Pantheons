/**
 * Pense-bête — the per-player deduction grid, CLIENT-ONLY (Decision 5 /
 * game-state-model.md): never sent to the server, never in any projection.
 *
 * Modelled on the physical artefact: columns = the 12 god heads (pense-bête crops),
 * rows = your live opponents; you strike gods out per opponent. Cell cycles
 * · (inconnu) → ✕ (exclu) → ○ (suspect) → ·. Marks persist per room in sessionStorage so a
 * reload mid-match keeps your notes — still strictly on this device.
 */
import { useEffect, useState } from 'react';
import { ALL_GODS, GODS, type GodId } from '@pantheons/engine';
import { godPortraitSrc } from '../assets.js';
import { fr } from '../i18n/fr.js';

type Mark = 'inconnu' | 'exclu' | 'suspect';
const CYCLE: Record<Mark, Mark> = { inconnu: 'exclu', exclu: 'suspect', suspect: 'inconnu' };
const GLYPH: Record<Mark, string> = { inconnu: '', exclu: '✕', suspect: '○' };

type Marks = Record<string, Partial<Record<GodId, Mark>>>;

function storageKey(roomId: string): string {
  return `pantheons.pense-bete.${roomId}`;
}

function load(roomId: string): Marks {
  try {
    return JSON.parse(sessionStorage.getItem(storageKey(roomId)) ?? '{}') as Marks;
  } catch {
    return {};
  }
}

export function PenseBeteGrid({
  roomId,
  opponents,
}: {
  roomId: string;
  opponents: { userId: string; displayName: string; alive: boolean }[];
}) {
  const [marks, setMarks] = useState<Marks>(() => load(roomId));

  useEffect(() => {
    sessionStorage.setItem(storageKey(roomId), JSON.stringify(marks));
  }, [roomId, marks]);

  const get = (opp: string, god: GodId): Mark => marks[opp]?.[god] ?? 'inconnu';
  const toggle = (opp: string, god: GodId) =>
    setMarks((m) => ({ ...m, [opp]: { ...m[opp], [god]: CYCLE[get(opp, god)] } }));

  const remaining = (opp: string) => ALL_GODS.filter((g) => get(opp, g.id) !== 'exclu').length;

  return (
    <div>
      <div className="pense-bete__titre-rang">
        <h3 className="titre-affiche pense-bete__titre">{fr.penseBete.title}</h3>
      </div>
      <p className="pense-bete__note">{fr.penseBete.note}</p>

      <div className="pb-grille">
        <div className="pb-grille__rang">
          <span className="pb-grille__coin" />
          {ALL_GODS.map((god) => (
            <span
              key={god.id}
              className="pb-grille__dieu-tete"
              title={`${god.label} — ${fr.penseBete.axes.genre} ${god.genre}, ${fr.penseBete.axes.couleurYeux} ${god.couleurYeux}, ${god.pantheon}`}
            >
              <img src={godPortraitSrc(god.id)} alt={god.label} />
            </span>
          ))}
        </div>

        {opponents.map((opp) => (
          <div className="pb-grille__rang" key={opp.userId}>
            <span className="pb-grille__adv" title={opp.displayName}>
              {opp.alive ? opp.displayName : `✕ ${opp.displayName}`}
            </span>
            {ALL_GODS.map((god) => {
              const mark = get(opp.userId, god.id);
              return (
                <button
                  key={god.id}
                  className={`pb-case ${mark === 'exclu' ? 'pb-case--exclu' : ''} ${
                    mark === 'suspect' ? 'pb-case--suspect' : ''
                  }`}
                  onClick={() => toggle(opp.userId, god.id)}
                  aria-label={`${opp.displayName} — ${GODS[god.id].label} : ${mark}`}
                >
                  {GLYPH[mark]}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="pb-restants">
        {opponents
          .filter((o) => o.alive)
          .map((o) => `${o.displayName} : ${fr.penseBete.restants(remaining(o.userId))}`)
          .join(' · ')}
      </div>
    </div>
  );
}
