/**
 * Barre de navigation — port du TopBar WoG (design.specs.md §9 côté WoG), rendue dans la DA
 * du pense-bête : marine, filets hairline, libellés mono espacés.
 *
 * Gauche : logo GG (→ portail gosgames, nouvel onglet) · « Panthéons » (→ accueil du jeu).
 * Droite : pseudo (→ page compte du portail, nouvel onglet) · Déconnexion.
 *
 * La session vit en sessionStorage (pas de cookie httpOnly comme WoG) : la déconnexion
 * efface session + resume locaux puis renvoie au portail.
 */
import { clearSession, loadSession } from '../auth/handoff.js';
import { fr } from '../i18n/fr.js';
import { navigate } from '../router.js';
import { clearResume } from '../state/resume.js';
import gosgamesLogoUrl from '../ui-art/brand/gosgames-logo.png';

const PLATFORM_HOME = 'https://www.gosgames.com';
const PLATFORM_ACCOUNT = 'https://www.gosgames.com/account';

export function TopBar() {
  const session = loadSession();

  const handleSignOut = () => {
    // La déconnexion invalide le resume : le siège appartient à la session qu'on ferme.
    clearResume();
    clearSession();
    window.location.href = PLATFORM_HOME;
  };

  return (
    <header className="barre-nav">
      <div className="barre-nav__gauche">
        <a
          className="barre-nav__logo"
          href={PLATFORM_HOME}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={fr.nav.backToPortal}
        >
          <img src={gosgamesLogoUrl} alt="GosGames" width={32} height={32} />
        </a>
        <span className="barre-nav__filet" aria-hidden="true" />
        <button
          type="button"
          className="barre-nav__titre titre-affiche"
          onClick={() => navigate('/')}
        >
          Panthéons
        </button>
      </div>

      <div className="barre-nav__droite">
        {session && (
          <a
            className="barre-nav__compte"
            href={PLATFORM_ACCOUNT}
            target="_blank"
            rel="noopener noreferrer"
            title={fr.nav.account}
          >
            {session.displayName ?? session.userId}
          </a>
        )}
        <button type="button" className="btn btn--nu btn--petit" onClick={handleSignOut}>
          {fr.nav.signOut}
        </button>
      </div>
    </header>
  );
}
