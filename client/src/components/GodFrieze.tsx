/**
 * La frise des douze — the pense-bête's signature strip: the 12 god heads over their
 * eye-colour band, names beneath, hairline white grid. Used on the landing hero; the same
 * head crops recur in the in-game pense-bête and the declaration picker.
 */
import { ALL_GODS } from '@pantheons/engine';
import { godPortraitSrc } from '../assets.js';

export function GodFrieze() {
  return (
    <div className="frise" role="img" aria-label="Les douze dieux du jeu">
      {ALL_GODS.map((god) => (
        <div className="frise__dieu" key={god.id}>
          <img src={godPortraitSrc(god.id)} alt="" loading="lazy" />
          <span className="frise__nom">{god.label}</span>
        </div>
      ))}
    </div>
  );
}
