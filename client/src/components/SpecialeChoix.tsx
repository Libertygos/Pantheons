/**
 * Spéciales (#1835) : l'écran de choix du propriétaire quand sa Spéciale se déclenche
 * (2 : deux questions d'autres joueurs à défausser ; 4 : une question posée par un autre à un
 * autre ; 7 : un pouvoir de la pile ; 8 : deux attributs de la pile), et le bandeau qui montre
 * à tous la Spéciale déclenchée.
 */
import { useState } from 'react';
import type { PlacedRef, PlayerProjection } from '@pantheons/engine';
import { data } from '@pantheons/engine';
import { VALEUR_LABEL } from '../assets.js';
import { fr } from '../i18n/fr.js';

type Send = (type: string, payload: unknown) => void;

const sameRef = (a: PlacedRef, b: PlacedRef) =>
  a.placer === b.placer && a.seat === b.seat && a.stackIndex === b.stackIndex;

export function SpecialeChoix({
  proj,
  nameOf,
  send,
}: {
  proj: PlayerProjection;
  nameOf: (uid: string) => string;
  send: Send;
}) {
  const choice = proj.specialeChoice;
  const [refs, setRefs] = useState<PlacedRef[]>([]);
  const [valeurs, setValeurs] = useState<string[]>([]);
  if (!choice) return null;

  const done = (c: unknown) => {
    send('speciale', { choice: c });
    setRefs([]);
    setValeurs([]);
  };
  const refLabel = (r: PlacedRef) => {
    const placed = proj.boardBySeat[r.placer]?.questionSlots[r.seat]?.[r.stackIndex];
    const kind = placed?.cardKind === 'action' ? fr.speciale.kindAction : fr.speciale.kindAttribut;
    return fr.speciale.questionDe(nameOf(r.placer), nameOf(proj.seatOrder[r.seat] ?? ''), kind);
  };

  let titre: string = fr.speciale.titre;
  let texte = '';
  let corps: React.ReactNode = null;
  let valider: React.ReactNode = null;

  if (choice.effectKey === 'action_special_2' || choice.effectKey === 'action_special_4') {
    const deux = choice.effectKey === 'action_special_2';
    const max = deux ? choice.count : 1;
    titre = deux ? fr.speciale.titre2 : fr.speciale.titre4;
    texte = deux ? fr.speciale.texte2(max) : fr.speciale.texte4;
    corps = (
      <div className="speciale-choix__liste">
        {choice.candidates.map((r) => {
          const choisi = refs.some((x) => sameRef(x, r));
          return (
            <button
              key={`${r.placer}-${r.seat}-${r.stackIndex}`}
              className={`btn ${choisi ? 'btn--givre' : 'btn--nu'}`}
              aria-pressed={choisi}
              onClick={() =>
                setRefs((cur) =>
                  choisi ? cur.filter((x) => !sameRef(x, r)) : cur.length < max ? [...cur, r] : cur,
                )
              }
            >
              {refLabel(r)}
            </button>
          );
        })}
      </div>
    );
    valider = (
      <button
        className="btn btn--givre"
        disabled={refs.length !== max}
        onClick={() => done(deux ? { kind: 'discard', refs } : { kind: 'take', ref: refs[0] })}
      >
        {deux ? fr.speciale.defausser : fr.speciale.prendre}
      </button>
    );
  } else if (choice.effectKey === 'action_special_7') {
    titre = fr.speciale.titre7;
    texte = fr.speciale.texte7;
    corps = (
      <div className="speciale-choix__liste">
        {choice.options.map((k) => (
          <button key={k} className="btn btn--nu" onClick={() => done({ kind: 'pouvoir', effectKey: k })}>
            {data.POWERS[k]?.label ?? k}
          </button>
        ))}
      </div>
    );
  } else {
    titre = fr.speciale.titre8;
    texte = fr.speciale.texte8;
    const dispo = Object.entries(choice.options);
    const total = dispo.reduce((n, [, c]) => n + c, 0);
    const need = Math.min(2, total);
    corps = (
      <div className="speciale-choix__liste">
        {dispo.map(([v, n]) => {
          const pris = valeurs.filter((x) => x === v).length;
          return (
            <button
              key={v}
              className={`btn ${pris > 0 ? 'btn--givre' : 'btn--nu'}`}
              aria-pressed={pris > 0}
              disabled={pris >= n && pris === 0}
              onClick={() =>
                setValeurs((cur) => {
                  if (cur.includes(v)) return cur.filter((_, i) => i !== cur.lastIndexOf(v));
                  return cur.length < need ? [...cur, v] : cur;
                })
              }
            >
              {VALEUR_LABEL[v] ?? v} ({pris}/{n})
            </button>
          );
        })}
      </div>
    );
    valider = (
      <button
        className="btn btn--givre"
        disabled={valeurs.length !== need}
        onClick={() => done({ kind: 'attributs', valeurs })}
      >
        {fr.speciale.prendreAttributs}
      </button>
    );
  }

  return (
    <div className="voile">
      <div className="modale" role="dialog" aria-modal="true">
        <h2 className="titre-affiche modale__titre">{titre}</h2>
        <p className="modale__texte">{texte}</p>
        {corps}
        {valider && <div className="modale__pied">{valider}</div>}
      </div>
    </div>
  );
}

/** Les Spéciales déclenchées ce tour, montrées à tous les sièges. */
export function SpecialesMontrees({
  proj,
  nameOf,
}: {
  proj: PlayerProjection;
  nameOf: (uid: string) => string;
}) {
  if (proj.specialesShown.length === 0) return null;
  return (
    <div className="speciales-montrees" role="status" aria-live="polite">
      {proj.specialesShown.map((s) => (
        <p key={s.cardId} className="speciales-montrees__ligne">
          <strong>{fr.speciale.declenchee(nameOf(s.owner))}</strong>{' '}
          {data.ACTIONS[s.effectKey]?.texte ?? s.effectKey}
          {s.noEffect ? ` ${fr.speciale.sansEffet}` : ''}
        </p>
      ))}
    </div>
  );
}
