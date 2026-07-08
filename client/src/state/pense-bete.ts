/**
 * Pense-bête — état des marques, CLIENT-ONLY (Decision 5 / game-state-model.md) : jamais
 * envoyé au serveur, jamais dans une projection. Persistance IDENTIQUE à la v1 : même clé
 * sessionStorage par salon, même forme JSON, mêmes noms de marques — un rechargement
 * mi-partie garde les notes, strictement sur cet appareil.
 *
 * L'état vit ici (hook) et non dans la grille : le tiroir ET les badges « N possibles »
 * des plaques de siège lisent les mêmes marques.
 */
import { useEffect, useState } from 'react';
import { ALL_GODS, type GodId } from '@pantheons/engine';

export type Mark = 'inconnu' | 'exclu' | 'suspect';
export const CYCLE: Record<Mark, Mark> = { inconnu: 'exclu', exclu: 'suspect', suspect: 'inconnu' };

export type Marks = Record<string, Partial<Record<GodId, Mark>>>;

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

export function usePenseBete(roomId: string) {
  const [marks, setMarks] = useState<Marks>(() => load(roomId));

  useEffect(() => {
    sessionStorage.setItem(storageKey(roomId), JSON.stringify(marks));
  }, [roomId, marks]);

  const get = (opp: string, god: GodId): Mark => marks[opp]?.[god] ?? 'inconnu';
  const toggle = (opp: string, god: GodId) =>
    setMarks((m) => ({ ...m, [opp]: { ...m[opp], [god]: CYCLE[get(opp, god)] } }));
  const remaining = (opp: string) => ALL_GODS.filter((g) => get(opp, g.id) !== 'exclu').length;

  return { get, toggle, remaining };
}
