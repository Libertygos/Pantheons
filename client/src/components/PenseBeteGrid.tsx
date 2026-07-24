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
import {
  ALL_GODS,
  GODS,
  PANTHEONS,
  type God,
  type GodId,
  type Pantheon,
  type PlacedCardView,
} from '@pantheons/engine';
import type { Mark } from '../state/pense-bete.js';
import { cardBackSrc, godPortraitSrc, questionCardSrc, VALEUR_LABEL } from '../assets.js';
import { describeQuestionCard, godCardFace, questionCardFace } from './card-text.js';
import { currentInspect, hideInspect, showInspect, useCardInspect } from './card-inspect.js';
import { PantheonIcon } from './PantheonIcon.js';
import { fr } from '../i18n/fr.js';

const GLYPH: Record<Mark, string> = { inconnu: '', exclu: '✕', suspect: '★' };
const PRESSED: Record<Mark, boolean | 'mixed'> = { inconnu: false, exclu: true, suspect: 'mixed' };

/** Libellés courts des yeux pour la table des dieux (l'en-tête de colonne porte « Yeux »). */
const YEUX_COURT: Record<string, string> = { bleus: 'Bleus', verts: 'Verts', rouges: 'Rouges' };
/** Couleur d'iris de la légende (le langage de bandes du pense-bête). */
const YEUX_TEINTE: Record<string, string> = {
  bleus: 'var(--turquoise)',
  verts: 'var(--vert)',
  rouges: 'var(--vermillon)',
};
/** Glyphe de genre (icône + libellé texte, jamais le glyphe seul). */
const GENRE_GLYPHE: Record<string, string> = { masculin: '♂', feminin: '♀' };

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
      title={`${god.label} — ${VALEUR_LABEL[god.genre]}, ${YEUX_COURT[god.couleurYeux] ?? god.couleurYeux} (${fr.penseBete.axes.couleurYeux.toLowerCase()}), ${VALEUR_LABEL[god.pantheon]}`}
    >
      <img src={godPortraitSrc(god.id)} alt={god.label} />
    </span>
  );
}

/** Œil de légende miniature : l'amande filaire, l'iris dans la couleur de l'axe. */
function OeilMini({ couleur }: { couleur: string }) {
  return (
    <svg width="20" height="12" viewBox="0 0 30 18" fill="none" stroke="var(--filet-fort)" strokeWidth="1.6" aria-hidden="true">
      <path d="M2 9c4.4-5.3 8.7-8 13-8s8.6 2.7 13 8c-4.4 5.3-8.7 8-13 8S6.4 14.3 2 9Z" fill="var(--nuit-3)" />
      <circle cx="15" cy="9" r="4.6" fill={couleur} stroke="none" />
      <circle cx="15" cy="9" r="1.7" fill="var(--nuit-3)" stroke="none" />
    </svg>
  );
}

/**
 * La table des dieux (S3) — le contenu du pense-bête physique rendu en chrome : les 12
 * identités possibles avec leurs trois attributs (glossary.md, table canonique), groupées
 * par panthéon. Remplit le tiroir sous la grille et donne enfin de quoi déduire ; chaque
 * rangée porte la loupe (la vraie carte Personnage en grand au survol/focus).
 */
function TableDieuxRang({ god }: { god: God }) {
  const ref = useCardInspect<HTMLDivElement>({ face: godCardFace(god.id) });
  return (
    <div className="pb-table__rang" ref={ref}>
      <img className="pb-table__portrait" src={godPortraitSrc(god.id)} alt="" />
      <span className="pb-table__nom">{god.label}</span>
      <span className="pb-table__genre">
        <span className="pb-table__genre-glyphe" aria-hidden="true">
          {GENRE_GLYPHE[god.genre]}
        </span>
        {VALEUR_LABEL[god.genre]}
      </span>
      <span className="pb-table__yeux">
        <OeilMini couleur={YEUX_TEINTE[god.couleurYeux] ?? 'currentColor'} />
        {YEUX_COURT[god.couleurYeux] ?? god.couleurYeux}
      </span>
    </div>
  );
}

function TableDieux() {
  return (
    <section className="pb-table" aria-label={fr.penseBete.tableTitre}>
      <h4 className="libelle pb-table__titre">{fr.penseBete.tableTitre}</h4>
      <p className="pb-table__note">{fr.penseBete.tableNote}</p>
      {PANTHEONS.map((p: Pantheon) => (
        <div className="pb-table__groupe" key={p}>
          <div className="pb-table__pantheon">
            <PantheonIcon pantheon={p} size={18} />
            <span>{VALEUR_LABEL[p]}</span>
          </div>
          {ALL_GODS.filter((g) => g.pantheon === p).map((g) => (
            <TableDieuxRang key={g.id} god={g} />
          ))}
        </div>
      ))}
    </section>
  );
}

/**
 * Mini réponse : vignette de la carte (face ou verso de catégorie) + pastille OUI/NON.
 * La face visible s'agrandit comme les dieux — loupe au survol/focus, ET au clic/tap
 * (au tactile, re-taper la même vignette la range) ; la loupe porte la pastille en
 * plaque de nom. Une face cachée reste inerte : rien à agrandir, rien à divulguer.
 */
function MiniReponse({ placed }: { placed: PlacedCardView }) {
  const desc = placed.card ? describeQuestionCard(placed.card) : fr.jeu.faceCachee;
  const oui = placed.answeredOui === true;
  const chip = oui ? `✓ ${fr.oui}` : `✗ ${fr.non}`;
  const payload = placed.card ? { face: questionCardFace(placed.card), namePlate: chip } : null;
  const ref = useCardInspect<HTMLButtonElement>(payload);
  // Un tap déclenche pointerleave (qui range la loupe) AVANT click : l'état « déjà à la
  // loupe » se lit donc au pointerdown, sinon un second tap rouvrirait au lieu de ranger.
  const lastPointerType = useRef('');
  const dejaOuverte = useRef(false);
  return (
    <button
      type="button"
      ref={ref}
      className={`pb-reponse ${payload ? '' : 'pb-reponse--inerte'}`}
      title={`${desc} — ${oui ? fr.oui : fr.non}`}
      onPointerDown={(e) => {
        lastPointerType.current = e.pointerType;
        dejaOuverte.current = currentInspect()?.anchor === ref.current;
      }}
      onClick={() => {
        const el = ref.current;
        if (!el || !payload) return;
        if (lastPointerType.current === 'touch' && dejaOuverte.current) {
          // Second TAP sur la même vignette : la loupe se range.
          hideInspect(el);
        } else if (currentInspect()?.anchor !== el) {
          // Au pointeur fin le clic n'éteint jamais ce que le survol vient d'ouvrir.
          showInspect({ anchor: el, ...payload });
        }
      }}
    >
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
        {chip}
      </span>
    </button>
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
        {/* S3 : l'axe panthéon devient visible dans la grille — 4 bandeaux de 3 colonnes */}
        <div className="pb-grille__rang" aria-hidden="true">
          <span className="pb-grille__coin" />
          <span className="pb-grille__coin pb-grille__coin--reponses" />
          {PANTHEONS.map((p: Pantheon) => (
            <span key={p} className="pb-pantheon">
              <PantheonIcon pantheon={p} size={13} />
              <span className="pb-pantheon__nom">{VALEUR_LABEL[p]}</span>
            </span>
          ))}
        </div>
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
                // S5 : l'état vide se lit en toutes lettres — plus un « — » muet.
                <span className="pb-reponses__vide">{fr.penseBete.aucuneReponse}</span>
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

      {/* S5 : la légende des marques — la bascule tri-état et le badge « N possibles »,
          enfin expliqués là où ils servent. Échantillons dans le langage des cases. */}
      <p className="pb-legende">
        <span className="pb-legende__intro">{fr.penseBete.legende}</span>
        <span className="pb-legende__item">
          <span className="pb-legende__case" aria-hidden="true" />
          {fr.penseBete.etats.inconnu}
        </span>
        <span className="pb-legende__fleche" aria-hidden="true">
          →
        </span>
        <span className="pb-legende__item">
          <span className="pb-legende__case pb-legende__case--exclu" aria-hidden="true">
            ✕
          </span>
          {fr.penseBete.etats.exclu}
        </span>
        <span className="pb-legende__fleche" aria-hidden="true">
          →
        </span>
        <span className="pb-legende__item">
          <span className="pb-legende__case pb-legende__case--retenu" aria-hidden="true">
            ★
          </span>
          {fr.penseBete.etats.suspect}
        </span>
        <span className="pb-legende__possibles">{fr.penseBete.legendePossibles}</span>
      </p>

      <div className="pb-restants">
        {rows
          .filter((o) => o.alive)
          .map((o) => `${o.displayName} : ${fr.penseBete.restants(remaining(o.userId))}`)
          .join(' · ')}
      </div>

      <TableDieux />
    </div>
  );
}
