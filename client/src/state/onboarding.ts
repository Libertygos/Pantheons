/**
 * Astuces du premier tour (S5) — état de congédiement, CLIENT-ONLY, même discipline que le
 * pense-bête (state/pense-bete.ts) : sessionStorage par salon, jamais envoyé au serveur.
 * Une astuce congédiée ne revient pas, même après un rechargement mi-partie ; les astuces
 * ne s'affichent de toute façon qu'au tour 1 (GameView). Le contenu (fr.ts) est tiré de
 * rules.md §5 et ne dépend JAMAIS d'une identité cachée.
 */
import { useEffect, useState } from 'react';

export type AstucePhase = 'pioche' | 'question' | 'reponse';

type Vues = Partial<Record<AstucePhase, boolean>>;

function storageKey(roomId: string): string {
  return `pantheons.astuces.${roomId}`;
}

function load(roomId: string): Vues {
  try {
    return JSON.parse(sessionStorage.getItem(storageKey(roomId)) ?? '{}') as Vues;
  } catch {
    return {};
  }
}

export function useAstuces(roomId: string) {
  const [vues, setVues] = useState<Vues>(() => load(roomId));

  useEffect(() => {
    sessionStorage.setItem(storageKey(roomId), JSON.stringify(vues));
  }, [roomId, vues]);

  const dismissed = (phase: AstucePhase): boolean => vues[phase] === true;
  const dismiss = (phase: AstucePhase) => setVues((v) => ({ ...v, [phase]: true }));

  return { dismissed, dismiss };
}
