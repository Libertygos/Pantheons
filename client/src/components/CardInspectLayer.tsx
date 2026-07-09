/**
 * La loupe de table (QoL §1) : rend la demande d'inspection courante dans un portail
 * au-dessus de tout (tiroir, dock, modales, vols) — la même <GameCard> re-rendue en grand,
 * hauteur ≈ min(480px, 55vh), posée à côté de sa source (droite → gauche → dessus/dessous)
 * et toujours retenue entière dans le viewport. pointer-events: none + aria-hidden :
 * c'est une loupe, pas un nouvel élément d'interface — zéro reflow de la page.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { GameCard } from './GameCard.js';
import { currentInspect, hideInspect, subscribeInspect } from './card-inspect.js';

/** --carte-ratio (faces 520×804). */
const RATIO = 520 / 804;
/** Écart carte source → loupe. */
const MARGE = 14;
/** Marge de sécurité au bord du viewport. */
const BORD = 8;

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

export function CardInspectLayer() {
  const req = useSyncExternalStore(subscribeInspect, currentInspect);

  // ESC (capté AVANT le keydown du tiroir : ESC ne ferme que la loupe), défilement ou
  // redimensionnement : la loupe se range plutôt que de dériver loin de son ancrage.
  useEffect(() => {
    if (!req) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        hideInspect();
      }
    };
    const onMove = () => hideInspect();
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [req]);

  if (!req) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const h = Math.min(480, vh * 0.55);
  const w = h * RATIO;
  const rect = req.anchor.getBoundingClientRect();

  // À droite de la source, sinon à gauche, sinon au-dessus / en dessous — jamais rogné.
  let left = rect.right + MARGE;
  let top = clamp(rect.top + rect.height / 2 - h / 2, BORD, vh - h - BORD);
  if (left + w > vw - BORD) {
    left = rect.left - MARGE - w;
    if (left < BORD) {
      left = clamp(rect.left + rect.width / 2 - w / 2, BORD, vw - w - BORD);
      top =
        rect.top - MARGE - h >= BORD
          ? rect.top - MARGE - h
          : clamp(rect.bottom + MARGE, BORD, vh - h - BORD);
    }
  }

  return createPortal(
    <div className="inspect-flottant" style={{ top, left, width: w }} aria-hidden="true">
      <GameCard size="lg" face={req.face} namePlate={req.namePlate} inspect={false} />
    </div>,
    document.body,
  );
}
