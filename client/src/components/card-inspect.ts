/**
 * Inspection de carte (QoL §1) — le magasin singleton de la « loupe » : UNE prévisualisation
 * à la fois, ancrée à sa carte source, rendue par <CardInspectLayer> au-dessus de tout.
 * La primitive GameCard s'y branche d'office pour toute face visible ; les portraits du
 * pense-bête et du sélecteur de déclaration s'y attachent via le même hook.
 *
 * Déclencheurs : survol ≥ 180ms sur pointeur fin, ou focus clavier (:focus-visible).
 * Congé : sortie du pointeur, perte de focus, ESC, défilement. Aucune donnée cachée n'y
 * transite : seul ce qui est déjà face visible pour ce spectateur peut être agrandi.
 */
import { useEffect, useRef } from 'react';
import type { GameCardFace } from './GameCard.js';

export interface InspectRequest {
  anchor: HTMLElement;
  face: GameCardFace;
  namePlate?: string;
}

const HOVER_DELAY = 180;

let current: InspectRequest | null = null;
const listeners = new Set<() => void>();

export function showInspect(req: InspectRequest): void {
  current = req;
  listeners.forEach((l) => l());
}

/** Range la loupe — si `anchor` est fourni, seulement si elle appartient à cet ancrage. */
export function hideInspect(anchor?: HTMLElement): void {
  if (current === null) return;
  if (anchor && current.anchor !== anchor) return;
  current = null;
  listeners.forEach((l) => l());
}

export function subscribeInspect(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function currentInspect(): InspectRequest | null {
  return current;
}

/**
 * Attache le comportement d'inspection à l'élément qui reçoit la ref retournée.
 * Le focus clavier est écouté sur l'enveloppe interactive la plus proche (le bouton qui
 * emballe la carte) ; sans enveloppe (carte pouvoir, mini-carte posée, portrait), l'élément
 * devient lui-même tabbable — parité clavier/souris. Payload null = inspection désactivée
 * (face cachée, vol en cours, dieu du dock).
 */
export function useCardInspect<T extends HTMLElement>(
  payload: { face: GameCardFace; namePlate?: string } | null,
) {
  const ref = useRef<T | null>(null);
  const payloadRef = useRef(payload);
  payloadRef.current = payload;
  const enabled = payload !== null;

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    if (!el.closest('button, a, [tabindex], input, select, textarea')) el.tabIndex = 0;
    const focusable = (el.closest('button, a, [tabindex], input, select, textarea') ??
      el) as HTMLElement;

    let timer: number | undefined;
    const show = () => {
      const p = payloadRef.current;
      if (p) showInspect({ anchor: el, face: p.face, namePlate: p.namePlate });
    };
    const onPointerEnter = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
      window.clearTimeout(timer);
      timer = window.setTimeout(show, HOVER_DELAY);
    };
    const onPointerLeave = () => {
      window.clearTimeout(timer);
      hideInspect(el);
    };
    const onFocusIn = () => {
      if (focusable.matches(':focus-visible')) show();
    };
    const onFocusOut = () => {
      window.clearTimeout(timer);
      hideInspect(el);
    };
    el.addEventListener('pointerenter', onPointerEnter);
    el.addEventListener('pointerleave', onPointerLeave);
    focusable.addEventListener('focusin', onFocusIn);
    focusable.addEventListener('focusout', onFocusOut);
    return () => {
      el.removeEventListener('pointerenter', onPointerEnter);
      el.removeEventListener('pointerleave', onPointerLeave);
      focusable.removeEventListener('focusin', onFocusIn);
      focusable.removeEventListener('focusout', onFocusOut);
      window.clearTimeout(timer);
      hideInspect(el);
    };
  }, [enabled]);

  return ref;
}
