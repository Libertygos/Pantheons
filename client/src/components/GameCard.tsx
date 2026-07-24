/**
 * <GameCard> — la primitive « carte physique » du Visual V2 : coins arrondis, chrome
 * d'encre, élévation, art immuable (CardImage, Décision 5 : jamais recomposé), plaque de
 * nom optionnelle, et le retournement 3D intégré (volet preserve-3d, deux faces
 * backface-hidden).
 *
 * Discipline d'information cachée (brief §2.3) : une carte face cachée se construit avec
 * `back` SEUL — aucune prop d'identité, aucune classe dérivable. Le couple `face` + `back`
 * n'existe que pour une carte dont la face appartient déjà au joueur qui regarde (son
 * propre dieu) : `revealed` pilote alors le retournement.
 *
 * Interactivité : la carte est inerte ; on l'enveloppe dans un bouton `.carte-scene`
 * (lift + élévation au survol ET au focus clavier, cible ≥ 44px).
 *
 * Inspection (QoL §1) : toute face VISIBLE porte d'office la loupe partagée (survol ≥ 180ms
 * pointeur fin / focus clavier → prévisualisation grand format via <CardInspectLayer>).
 * `inspect={false}` la débranche (vols transients, dieu du dock, la loupe elle-même) ;
 * une carte face cachée n'a jamais de loupe — rien à agrandir, rien à divulguer.
 */
import { CardImage } from './CardImage.js';
import { useCardInspect } from './card-inspect.js';
import { cardBackSrc } from '../assets.js';
import { fr } from '../i18n/fr.js';

export type GameCardSize = 'xs' | 'sm' | 'md' | 'lg';
export type CardBackKind = 'personnages' | 'attributs' | 'actions' | 'pouvoirs';

/** Une face visible : l'image finale + le nécessaire de la tuile de secours. */
export interface GameCardFace {
  src: string;
  alt: string;
  /** En-tête de la tuile de secours, ex. « Attribut ». */
  typeLabel: string;
  /** Corps de la tuile de secours, ex. « Yeux verts ». */
  bodyLabel: string;
  /** Bande légende optionnelle de la tuile (langage des yeux). */
  bandColor?: string;
  /** Classe teinte-* de la tuile de secours. */
  tint?: string;
}

const BACK_LABEL: Record<CardBackKind, string> = {
  personnages: 'Personnage',
  attributs: 'Attribut',
  actions: 'Action',
  pouvoirs: 'Pouvoir',
};

const BACK_TINT: Record<CardBackKind, string> = {
  personnages: 'teinte-personnage',
  attributs: 'teinte-attribut',
  actions: 'teinte-action',
  pouvoirs: 'teinte-pouvoir',
};

function FaceArt({ face }: { face: GameCardFace }) {
  return (
    <CardImage
      src={face.src}
      alt={face.alt}
      typeLabel={face.typeLabel}
      bodyLabel={face.bodyLabel}
      bandColor={face.bandColor}
      className={face.tint}
    />
  );
}

/** Le verso de catégorie — générique par construction, rien d'identitaire. */
function BackArt({ kind }: { kind: CardBackKind }) {
  return (
    <CardImage
      src={cardBackSrc(kind)}
      alt={fr.jeu.faceCachee}
      typeLabel={BACK_LABEL[kind]}
      bodyLabel={fr.jeu.faceCachee}
      className={`carte--verso ${BACK_TINT[kind]}`}
    />
  );
}

export function GameCard({
  size = 'md',
  face,
  back,
  revealed = false,
  namePlate,
  className,
  inspect = true,
}: {
  size?: GameCardSize;
  /** Face visible. Absente = carte face cachée (fournir `back` seul). */
  face?: GameCardFace;
  /** Verso de catégorie. Avec `face`, active le retournement 3D piloté par `revealed`. */
  back?: CardBackKind;
  /** État du retournement (uniquement quand `face` ET `back` sont fournis). */
  revealed?: boolean;
  /** Plaque de nom optionnelle au pied de la face. */
  namePlate?: string;
  className?: string;
  /** Loupe d'inspection au survol/focus (défaut : active dès qu'une face est visible). */
  inspect?: boolean;
}) {
  const flippable = Boolean(face && back);
  const faceVisible = Boolean(face) && (!flippable || revealed);
  const inspectRef = useCardInspect<HTMLDivElement>(
    inspect && faceVisible && face ? { face, namePlate } : null,
  );
  const classes = [
    'carte-jeu',
    `carte-jeu--${size}`,
    flippable ? 'carte-jeu--retournable' : '',
    flippable && revealed ? 'carte-jeu--revele' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} ref={inspectRef}>
      <div className="carte-jeu__volet">
        {/* Face par défaut : le dos si la carte se retourne, sinon la seule face fournie. */}
        <div className="carte-jeu__face">
          {flippable ? <BackArt kind={back!} /> : face ? <FaceArt face={face} /> : back ? <BackArt kind={back} /> : null}
          {!flippable && face && namePlate && <span className="carte-jeu__plaque">{namePlate}</span>}
        </div>
        {flippable && (
          <div className="carte-jeu__face carte-jeu__face--recto">
            <FaceArt face={face!} />
            {namePlate && <span className="carte-jeu__plaque">{namePlate}</span>}
          </div>
        )}
      </div>
      {/* S3 : affordance de la loupe — un petit ⌕ au coin, pointeur fin seulement (CSS) ;
          au tactile la loupe n'existe pas, les légendes de chrome prennent le relais. */}
      {inspect && faceVisible && (
        <span className="carte-jeu__loupe" aria-hidden="true">
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <circle cx="5" cy="5" r="3.4" />
            <path d="M7.6 7.6 10.6 10.6" />
          </svg>
        </span>
      )}
    </div>
  );
}
