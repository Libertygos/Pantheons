/**
 * Pense-bête v2 (Visual V2 §7 + QoL §2) — la grille de déduction, outil de premier rang.
 * Rangées d'adversaires : d'abord leur NOM (colonne collante — la grille défile
 * horizontalement dans le tiroir, fondus de bord en guise d'affordance, B18), puis leurs
 * réponses PUBLIQUES de ce tour (mini-carte — face si visible pour ce spectateur, sinon le
 * verso de catégorie — plus pastille ✓ OUI / ✗ NON : icône + couleur, jamais la couleur
 * seule, vidée à chaque tour), puis les 12 dieux en tuiles-portraits (loupe d'inspection
 * au survol/focus : la carte Personnage en grand). Cellules : bascules TRI-ÉTAT inconnu →
 * exclu (✕) → retenu (★ + anneau), état annoncé (aria-pressed + libellé), navigation
 * clavier complète (Tab + flèches).
 *
 * Présentationnel : les marques vivent dans usePenseBete (state/pense-bete.ts) — jamais
 * envoyées ; les réponses viennent de la projection déjà reçue (answeredOui public).
 */
import { useEffect, useRef, useState } from 'react';
import { ALL_GODS, GODS, type God, type GodId, type PlacedCardView } from '@pantheons/engine';
import type { Mark } from '../state/pense-bete.js';
import { cardBackSrc, godPortraitSrc, questionCardSrc } from '../assets.js';
import { describeQuestionCard, godCardFace } from './card-text.js';
import { useCardInspect } from './card-inspect.js';
import { fr } from '../i18n/fr.js';

const GLYPH: Record<Mark, string> = { inconnu: '', exclu: '✕', suspect: '★' };
const PRESSED: Record<Mark, boolean | 'mixed'> = { inconnu: false, exclu: true, suspect: 'mixed' };

/** Une réponse publique de ce tour : la carte posée telle que vue par ce spectateur. */
export interface PenseBeteAnswer {
  key: string;
  placed: PlacedCardView;
}

export interface PenseBeteRow {
  userId: string;
  displayName: string;
  alive: boolean;
  /** Accent d'identité de siège (var CSS), partagé avec le badge de la plaque. */
  tint: string;
  /** Réponses données ce tour-ci, la plus récente d'abord (vide entre les tours). */
  answers: PenseBeteAnswer[];
}

/** Tuile-portrait d'en-tête, avec la loupe : la vraie carte Personnage en grand. */
function DieuEntete({ god }: { god: God }) {
  const ref = useCardInspect<HTMLSpanElement>({ face: godCardFace(god.id) });
  return (
    <span
      ref={ref}
      className="pb-dieu"
      title={`${god.label} — ${fr.penseBete.axes.genre} ${god.genre}, ${fr.penseBete.axes.couleurYeux} ${god.couleurYeux}, ${god.pantheon}`}
    >
      <img src={godPortraitSrc(god.id)} alt={god.label} />
    </span>
  );
}

/** Mini réponse : vignette de la carte (face ou verso de catégorie) + pastille OUI/NON. */
function MiniReponse({ placed }: { placed: PlacedCardView }) {
  const desc = placed.card ? describeQuestionCard(placed.card) : fr.jeu.faceCachee;
  const oui = placed.answeredOui === true;
  return (
    <span className="pb-reponse" title={`${desc} — ${oui ? fr.oui : fr.non}`}>
      <img
        className="pb-reponse__carte"
        src={
          placed.card
            ? questionCardSrc(placed.card)
            : cardBackSrc(placed.cardKind === 'attribut' ? 'attributs' : 'actions')
        }
        alt={desc}
      />
      <span className={`pb-reponse__chip ${oui ? 'pb-reponse__chip--oui' : 'pb-reponse__chip--non'}`}>
        {oui ? `✓ ${fr.oui}` : `✗ ${fr.non}`}
      </span>
    </span>
  );
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

  // B18 : la grille défile horizontalement dans le tiroir (colonne des noms collante) ;
  // les fondus de bord ne s'affichent que s'il RESTE du contenu de ce côté.
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [cues, setCues] = useState({ gauche: false, droite: false });
  const updateCues = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const gauche = el.scrollLeft > 4;
    const droite = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    setCues((c) => (c.gauche === gauche && c.droite === droite ? c : { gauche, droite }));
  };
  useEffect(() => {
    updateCues();
    const el = scrollerRef.current;
    el?.addEventListener('scroll', updateCues, { passive: true });
    window.addEventListener('resize', updateCues);
    return () => {
      el?.removeEventListener('scroll', updateCues);
      window.removeEventListener('resize', updateCues);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Le tiroir s'ouvre par transform : re-mesurer quand le contenu ou la taille change.
  useEffect(() => {
    updateCues();
  });

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
      <div
        className={[
          'pb-defile-cadre',
          cues.gauche ? 'pb-defile-cadre--gauche' : '',
          cues.droite ? 'pb-defile-cadre--droite' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div className="pb-defile" ref={scrollerRef}>
      <div className="pb-grille" ref={gridRef} onKeyDown={handleKeyDown}>
        <div className="pb-grille__rang">
          <span className="pb-grille__coin" />
          <span className="pb-grille__entete-reponses libelle">{fr.penseBete.reponses}</span>
          {ALL_GODS.map((god) => (
            <DieuEntete key={god.id} god={god} />
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
            <span className="pb-reponses">
              {opp.answers.length === 0 ? (
                <span
                  className="pb-reponses__vide"
                  title={fr.penseBete.aucuneReponse}
                  aria-label={fr.penseBete.aucuneReponse}
                >
                  —
                </span>
              ) : (
                opp.answers.map((a) => <MiniReponse key={a.key} placed={a.placed} />)
              )}
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
        </div>
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
