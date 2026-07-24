# Version 1.2.4

## Pense-bête entier — les 12 dieux toujours visibles (présentation seule)

Directive joueur (2026-07-24, exécutée hors sessions planifiées — dossier
`polish/STATE.md`, règle ratifiée en §3). Zéro diff moteur/serveur/protocole ;
PNG intacts ; UI français seul.

1. **Les 12 dieux d'un coup, pour chaque joueur.** Ouvrir le pense-bête montre
   TOUJOURS les 12 possibilités de chaque rangée — plus aucun défilement horizontal ne
   cache une colonne. Le tiroir prend la largeur de la grille entière
   (`min(840px, 96vw)`) quitte à couvrir la table : c'est une surimpression qu'on
   referme d'un geste, le compromis est assumé. Fenêtre étroite (< 840px) : chaque
   rangée passe sur deux lignes — nom + réponses, puis les 12 cases pleine largeur —
   rien ne sort jamais de l'écran, à 390 comme à 1280.
2. **Les réponses s'agrandissent comme les dieux.** Chaque réponse publique du tiroir
   (vignette + pastille ✓ OUI / ✗ NON) porte désormais la loupe d'inspection : survol,
   focus clavier, ET clic — au tactile, un tap l'ouvre, un second tap sur la même
   vignette la range. La loupe montre la vraie face de la carte avec le verdict en
   plaque de nom. Une réponse face cachée reste inerte : rien à agrandir, rien à
   divulguer.

# Version 1.2.3

## Deep polish S4 — atmosphère, temps forts & retours (présentation seule)

Session polish S4 (2026-07-24, protocole `CONTINUE-POLISH.md`, dossier `polish/STATE.md`).
Zéro diff moteur/serveur/protocole ; PNG intacts ; UI français seul.

1. **Cérémonie de déclaration.** La modale « Panthéons » ne ressemble plus à l'aide :
   tri-bande signature en tête, titre chartreuse (son usage réservé — la déclaration EST
   le moment divin), lueur discrète sur le cadre. Les 12 dieux sont NOMMÉS sous leur
   portrait ; les marques de VOTRE pense-bête s'y projettent (✕ exclu — portrait éteint,
   nom barré ; ★ retenu — liseré turquoise), et chaque rangée porte le badge vivant
   « N possibles » à la teinte du siège. État choisi fort : anneau chartreuse + lueur +
   coche + nom allumé (le liseré 1px ne portait pas le moment). L'ordre des rangées est
   l'ordre des sièges. Notes locales seulement — rien de caché n'entre dans cette modale.
2. **Élimination : un temps fort.** La déclaration ratée n'est plus une bannière
   dissimissible : plein écran vermillon (sceau ✕ tamponné, titre « Vous êtes éliminé » /
   « X est éliminé », corps explicite, « Continuer »). L'état PERSISTE ensuite : chip
   « Éliminé » dans la barre haute ET sur le dock, consigne de spectateur dans le
   traqueur (« vous suivez la partie en spectateur ») — l'UI d'un éliminé ne ressemble
   plus à une table jouable (B12).
3. **Fin de partie étagée.** Bande signature balayée (3 temps), titre, verdict, puis la
   carte du vainqueur : SA face pour lui seul (déjà sienne) ; pour les autres le VERSO
   avec « Le dieu de X restera secret. » — la règle de projection devient un moment au
   lieu d'un manque. Modale au même habit cérémonial que la déclaration.
4. **Meneur pour soi (B17).** Chip chartreuse « Meneur : vous » dans la barre haute —
   jusqu'ici seuls les adversaires meneurs étaient marqués.
5. **Attente & déconnexion (B13).** La consigne confirmée dit « la table attend X… »
   (remplace « en attente de X… ») ; une déconnexion adverse s'affiche en toutes
   lettres sous le traqueur (« Déconnexion d'Ophélie — reconnexion en attente, la
   partie continue sans l'attendre. », élision comprise) et en étiquette « Déconnecté »
   sur la plaque — le point rouge 2px ne portait pas l'état. Aucun compte à rebours
   inventé (timeout de barrière : ⟨INPUT WoG⟩).
6. **Révélation assombrie (Q4).** Pendant l'appui « maintenir pour révéler », un voile
   léger assombrit la table sous la loupe — la carte tenue ne s'offre plus à un regard
   par-dessus l'épaule sur une scène pleinement éclairée.
7. **Reduced-motion.** Les délais d'animation s'effondrent avec les durées (les
   séquences étagées n'imposent aucune attente aveugle) ; tous les nouveaux effets sont
   transform + opacity.

# Version 1.2.2

## Deep polish S3 — lisibilité & qualité du français (présentation seule)

Session polish S3 (2026-07-24, protocole `CONTINUE-POLISH.md`, dossier `polish/STATE.md`).
Zéro diff moteur/serveur/protocole ; PNG intacts ; UI français seul.

1. **La table des dieux dans le pense-bête.** Le tiroir porte enfin le contenu du
   pense-bête physique : sous la grille, les 12 identités et leurs trois attributs
   (`glossary.md`, table canonique), groupées par panthéon — portrait, nom, genre
   (glyphe + libellé), yeux (icône d'œil colorée + libellé, jamais la couleur seule),
   loupe sur chaque rangée. La grille gagne une rangée d'en-tête « panthéon » (4 bandeaux
   de 3 colonnes, icône + nom) — l'axe panthéon se lit au moment de cocher.
2. **Légendes de chrome des cartes.** Le nom et le texte VERBATIM de la face
   (`card-catalog.md`, orthographe [sic] conservée) se lisent désormais sans la loupe :
   sous le pouvoir du dock, sous chaque carte de la modale de défausse, et sous
   l'éventail pour la carte choisie (ou levée au premier appui tactile — là où la loupe
   n'existe pas). Les Multiple recomposent leur set avec les libellés des dieux ; les
   Spéciales annoncent leur phase de déclenchement. Un insigne ⌕ au coin des faces
   inspectables (pointeur fin seulement) rend la loupe découvrable — jamais sur
   l'éventail héros de l'accueil, qui a déjà son zoom.
3. **Élision & typographie.** « en attente d'Ophélie… » (l'aide `de + voyelle/h → d'`
   s'applique aux noms interpolés, aussi pour « Question d'X espionnée ») ; espaces
   insécables avant : ; ! ? et à l'intérieur des « » dans tout le chrome — plus
   d'orphelin « ? » en début de ligne à 390.
4. **Contraste (AA).** La tagline de l'accueil devient opaque, posée au-dessus de
   l'éventail et ombrée — son contraste ne dépend plus des cartes qui passent derrière ;
   les tampons ✓ OUI / ✗ NON passent à l'encre sombre sur les couleurs de légende (le
   blanc tombait à 2,4:1 sur le vert) ; le ✕ « exclu » du pense-bête passe au
   vermillon sombre sur fond explicite (l'opacité 0.72 le délavait sous AA).
5. **Tailles minimales.** Plus aucun texte informatif sous 10px rendu (audit complet :
   badges, jetons, libellés de zone, notes d'éventail, poignée, chips du tiroir…) ;
   les phrases passent à 11px.
6. **Divers.** La ★ « retenu » du pense-bête quitte la chartreuse (réservée au divin :
   meneur, CTA, déclaration) pour la turquoise ; les cartes-règles de l'accueil perdent
   leur pente une fois empilées (≤980px) — le corps de texte tournait flou à 390 ;
   « Défausser celui-ci » et l'alt du pense-bête rejoignent `fr.ts`.

# Version 1.2.1

## Deep polish S2 — disposition, hiérarchie & panneaux (présentation seule)

Session polish S2 (2026-07-24, protocole `CONTINUE-POLISH.md`, dossier `polish/STATE.md`).
Zéro diff moteur/serveur/protocole ; PNG intacts ; UI français seul.

1. **Tiroir pense-bête — plus jamais une prise de contrôle.** L'auto-ouverture de la
   phase réponse est remplacée par un signal : la poignée bat une fois et porte un badge
   turquoise « réponses non lues » (compte des réponses publiques adverses du tour, réputé
   lu à l'ouverture). Le tiroir ne s'ouvre que par sa poignée, toujours en surimpression
   (le reflux `padding-right` de la table est supprimé), largeur ≤ 460px. Les modales
   (`.voile`, z 70) passent AU-DESSUS du tiroir (57) et de sa poignée (58) — un temps fort
   ne passe plus sous un panneau. Échap congédie la couche la plus haute : loupe → modale
   (déclaration, aide, aides de zone) → tiroir ; la défausse de pouvoir, action requise,
   ne se ferme pas.
2. **Grille du pense-bête.** Rangée réordonnée : nom (colonne collante au défilement),
   réponses du tour, puis les 12 dieux en pistes fixes de 48px ; la grille défile
   horizontalement dans le tiroir avec des fondus de bord qui n'apparaissent que s'il
   reste du contenu de ce côté — plus d'overflow caché à 390.
3. **Table & dock.** Une carte validée n'est plus rendue deux fois (les fantômes locaux
   s'effacent dès la confirmation serveur) ; l'éventail de la main s'espace (54px / 38px
   à ≤600px) et, au tactile, le premier appui LÈVE la carte couverte, le second agit ;
   main vide = une ligne d'explication par état (pioche à valider / en attente / aucune
   carte) au lieu d'une bande morte ; aucune zone du dock ne déborde sur sa voisine
   (« Contre vous » enveloppe) ; un jeton de plaque plus large que sa rangée s'abrège au
   lieu de déborder du cadre.
4. **Salon.** Les badges HÔTE / VOUS respirent (les règles `.siege__nom` visaient
   `.place__nom`) ; quand la table peut démarrer, la ligne d'état passe à « Tout le monde
   est prêt — l'hôte peut lancer la partie. » (vert) ; « Copier le lien d'invitation »
   devient un vrai bouton avec confirmation « ✓ Copié ! » sur place.
5. **Accueil & fond.** Le libellé « Rejoindre avec un code » est enfin rendu au-dessus
   des cases ; le fond « table de nuit » quitte `background-attachment: fixed` (ratés
   iOS Safari, coût de repaint) pour une couche `body::before` en position fixe — rendu
   identique.

# Version 1.2.0

## Visual V2 — « des cartes sur une table de nuit » (phases A–E)

Session 4 (2026-07-08). Restyle intégral de la couche de présentation sur le brief
Visual V2 : profondeur, physicalité, sens spatial — marque intacte (marine, mono,
chartreuse, faces PNG immuables), zéro diff moteur/serveur/protocole.

1. **Fondation (A)** — jetons de profondeur (rampe d'ombres 4 crans + liseret haut),
   atmosphère de table (spot radial + vignette + grain), jetons de motion
   (120/240/420ms, expo-out, back-out), primitive `<GameCard>` (4 tailles, chrome
   d'encre, flip 3D intégré, face cachée sans aucune donnée d'identité dans le DOM).
2. **Landing (B)** — l'éventail des douze vraies cartes Personnage en héros (survol ET
   focus clavier : la carte se redresse, les voisines s'écartent ; rangée scroll-snap
   sous 900px), mat de table pour les actions (CTA lumineux, code segmenté 5 cases),
   les trois temps posés en cartes I·II·III sur ligne pointillée, légende en jetons.
3. **La table (C)** — trois bandes : arc des sièges adverses (plaques + compteurs en
   jetons libellés, plus de codes à une lettre ; les questions s'attachent au siège
   VISÉ, tous poseurs confondus), traqueur de phase (remplace onglets + bannière,
   coches prêt par siège), table centrale (pioches empilées sur `drawCounts`, tour),
   dock (dieu à appui maintenu = flip 3D, main en éventail, Contre vous / Spéciale,
   pouvoir armé). Classes de siège du jeu = `.place*` (`.siege` reste au lobby).
4. **Pense-bête (D)** — tiroir de droite (ESC, voile, focus géré), grille tri-état
   (inconnu → exclu ✕ → retenu ★, aria-pressed, navigation aux flèches), badges
   « N possibles » vivants sur les plaques, teintés par siège comme leur rangée ;
   persistance sessionStorage strictement identique.
5. **Juice (E)** — vols de cartes pioche→main et main→siège (clones fixes,
   transform-only), tampons ✓ OUI / ✗ NON, entrées de modales + révélation de la
   carte du vainqueur, secousse d'élimination, chaloupe <1° de la main. Reduced-motion
   respecté effet par effet (durées à zéro, vols non créés, anneaux statiques).

Écart assumé vs brief (signalé, §12) : jamais de flip face-visible des dieux adverses
(éliminés ou déclarés) — la projection never-send ne les transmet pas, c'est la règle.

# Version 1.1.1

## Retours de mise en prod : pseudo, barre de navigation, partie de test admin

Session 3 (2026-07-07), premiers retours après la mise en ligne.

1. **Pseudo dans le lobby** — la plateforme émet le nom d'affichage dans la claim
   `username` du handoff token (gosgames `handoffMint.ts`) ; Panthéons lisait
   `displayName`, toujours absente, et retombait sur l'user_id brut (UUID). Le
   vérificateur lit désormais `username` (fallback `displayName`), la session S-JWT et
   la réponse `/auth/exchange` transportent le nom jusqu'au client (landing + lobby).
2. **Barre de navigation** — port du TopBar WoG dans la DA du pense-bête
   (`.barre-nav`, sticky) : logo GG → portail gosgames, « Panthéons » → accueil,
   pseudo → gosgames.com/account, Déconnexion (efface session + resume locaux puis
   renvoie au portail). Affichée sur l'accueil et le lobby ; la partie garde son
   propre chrome, comme WoG.
3. **Partie de test à 2 joueurs (admin)** — `ADMIN_USER_IDS` (env serveur, user_id
   plateforme séparés par des virgules) : quand l'hôte du salon est admin, le minimum
   effectif de sièges tombe à 2 (retrait de sièges, `canStart`, libellés) ; le moteur
   accepte 2..7 (`ABSOLUTE_MIN_PLAYERS`), la règle des 4 reste la politique de lobby
   pour tout hôte normal.

# Version 1.1.0

## Vraies faces : transcription intégrale + logique des effets + DA re-vérifiée

Session 2 (2026-07-07). Les 64 faces de cartes, indisponibles en 1.0.0 (pointeurs LFS),
sont des fichiers git normaux depuis la fin de session 1 — cette version accomplit le
mandat original de 1.0.0 (« read every .webp and define the logic of every card »).

### Claude code done

1. **Vérification des assets** ✓ — 64/64 faces réelles (en-têtes RIFF, aucun pointeur).
2. **DA re-analysée sur les vraies faces** ✓ — écart modéré, extension sans contradiction
   (PANTHEONS_PROGRESS.md §1bis) : couleurs d'identité par catégorie (Attribut sarcelle
   `#338381`, Action vermillon-saumon, **Pouvoir violet `#614BA9`** — absent du
   pense-bête), fonds Personnage = couleur de panthéon, bande diagonale = couleur d'yeux,
   ratio réel 520×804 (le 5/7 supposé rognait les faces). Tokens + tuiles fallback +
   versos par catégorie + `object-fit: contain` appliqués ; landing/lobby inchangés.
3. **Catalogue transcrit à 100 %** ✓ — `docs/card-catalog.md` : 12 pouvoirs, 9 Non
   (chacune porte SA question — les 9 valeurs d'attribut — + malus par axe), 9 Multiple
   (sets de 4 dieux verbatim, sans effet additionnel), 9 Spéciales (texte + phase
   imprimée), questions Attribut verbatim. Plus aucun `⟨À_TRANSCRIRE⟩`. **Erratas
   d'assets** consignés (§7) : bande Ganesh rouge vs pense-bête turquoise (→ `bleus`
   canonique), icônes interverties (Multiple 1/5), fichier `optimisse` titré
   **OPTIMISME**, formulation d'Exécution.
4. **Logique câblée de bout en bout** ✓ — engine : effets Non/Spéciales/pouvoirs réels
   (modificateurs de pioche et de questions, suivi « aucun oui au tour précédent »,
   activations validées une fois par tour, âmes sœurs à la déclaration, deck 27 cartes) ;
   serveur : message `power`, payloads de pose des Spéciales, canal privé `reveal`
   (never-send) ; client : limites dynamiques, Spéciales à cible, dock pouvoir
   activable, plateaux à piles. **Découverte de modèle** : les faces (Espionnage,
   Spéciales 1/4) prouvent que les questions posées sont **face cachée** → redaction
   par viewer dans `projection.ts` ([OPUS 🔒] — relecture Jules), versos affichés.
5. **Vérification** ✓ — engine 39 tests (dont 19 effets + 3 redaction), serveur 15,
   typecheck et build verts. Arbitrages détaillés : PANTHEONS_PROGRESS.md §8.1.

# Version 1.0.0

## Bootstrap: define the Pantheons card catalog from the source art

Pantheons is a **different game from War of Guilds** (WoG), but it reuses WoG's proven
landing-page, game-room, and refresh/resume architecture. The room/lobby/refresh port is
already written up in `wog-room.md` at the root of this project — read that first for the
networking, lobby, and reconnection model. Pantheons has **12 characters (gods)** instead of
WoG's 10, which is what makes a 4–7-player table keep the "no deduction by elimination" hidden-
information property intact (12 − 7 = 5 characters always set aside, comfortably ≥ 4).

This first version has **no gameplay code yet** — its whole job is to establish the
**authoritative card catalog and card logic** from the source card art.

### Claude code tasks

First tasks, in order:

1. **Read the current files from the WoG repo** (`../war-of-guilds`) as the reference
   implementation — the pnpm monorepo layout (`packages/engine`, `apps/server`,
   `apps/client`), the engine purity rules, the thin authoritative server, the per-seat
   projection / hidden-information model, and the landing/room/refresh behaviour summarized in
   `wog-room.md`. Pantheons follows the same architecture; only the game content differs.

2. **Read every `.webp` image in the folder `conversion_cartes/`** and use them to define:
   - the **logic of every card** (what each card does, its cost/effect/timing), and
   - the **attributes of all 12 gods** (each god's identity, its attributes and powers).

   Every card is present in `conversion_cartes/` (all cards + a **pense-bête / cheat-sheet**).
   The catalog derived here becomes the source of truth for the engine data, exactly as
   WoG's `gameplay.md` + `mandate.md` are for WoG.

3. **Card catalog & copy counts.** The deck is built from these card kinds and copy counts:
   - **Attributes** — **36 distinct attributes**, **4 copies of each** → **144 attribute
     cards** total.
   - **Actions** — **one copy of each** action card.
   - **Characters (gods)** — **one copy of each** of the **12** god cards.
   - **Pouvoirs (powers)** — **one copy of each** power card.

   Record, per card: its id, kind (attribute / action / character / pouvoir), copy count, and
   its full rule/effect logic as read from the art. Cross-check against the pense-bête so no
   card is missing and no logic contradicts it.

Deliverable of 1.0.0: a complete, authoritative Pantheons card catalog (all cards, all god
attributes, all copy counts) written as the project's source-of-truth spec — the basis every
later engine/server/client version implements against.

Convention carried over from WoG: display **version X.Y.Z** at the bottom of the landing page,
read from this file's topmost `# Version` heading. Keep this `versions.md` the running record —
newest version on top, each with `### Claude code tasks` then `### Claude code done`.

### Claude code done

_2026-07-07 — catalog authored; card faces restored as plain git files (ex-LFS); effect
text transcription pending._

1. **WoG reference read** ✓ — `wog-room.md` (the authoritative extraction) + the local
   `../war-of-guilds` checkout. The landing/room/refresh model was ported into Pantheons in
   the same pass: server room codes + registry + `GET /api/rooms/:code/exists`, host/ready
   lobby with ADD_SEAT/REMOVE_SEAT (min 4 / max 7), 60 s lobby & match reconnection grace,
   duplicate-account rejection (`ALREADY_IN_ROOM`), ≥2-concurrent-drops abort back to a
   fresh lobby; client landing (create / join-by-code / resume auto-redirect), room
   acquisition state machine (adopt / probe / reconnect / fresh-join / duplicate view),
   `localStorage` resume record with rotated-token re-persist, active-room baton, and
   `leave(false)` teardown on refresh.

2. **Art read** — partial, externally blocked. `Pense_Bête.webp` is hydrated and fully
   transcribed: the 12-god table (genre / couleur des yeux / panthéon) is complete in
   `docs/card-catalog.md` §1 and `packages/engine/src/data/gods.ts` (`TRANSCRIBED = true`;
   one caveat: Ganesh's iris is stylised — `bleus` from his band, re-confirm on his card
   face). The 64 card faces were un-hydrated Git LFS pointers behind an exhausted LFS
   budget; **restored 2026-07-07**: the real WebPs were recovered from GitHub's
   `media.githubusercontent.com` endpoint (sha256-verified against the pointers),
   recommitted as plain git files, and LFS tracking removed. Per-card effect text,
   Multiple god-sets, and Spéciale trigger phases remain recorded as `⟨À_TRANSCRIRE⟩`
   until transcribed from the faces into `docs/card-catalog.md`.

3. **Card catalog & copy counts** ✓ — `docs/card-catalog.md` (source of truth): 12
   Personnages ×1, **9 distinct Attributs ×4 = 36** (the deduction space is closed at
   9 values: 2 genres + 3 couleurs d'yeux + 4 panthéons — the "36 distinct attributes →
   144" phrasing in this file's task list doesn't match the assets and is flagged there
   for ratification), 27 Actions ×1 (9 Non / 9 Multiple / 9 Spéciale), 12 Pouvoirs ×1.
   Every card id, kind, copy count and asset filename is recorded; engine data
   (`gods.ts`, `actions.ts`, `powers.ts`, `setup.ts`) and specs (`glossary.md`,
   `rules.md`) updated to match; engine + server test suites green. The landing page
   displays this file's version per the WoG convention.

4. **Launch (2026-07-07)** ✓ — full playable UI (landing / lobby / game screens, DA from
   the pense-bête, cf. `PANTHEONS_PROGRESS.md`) plus the production layer mirroring WoG:
   server `/healthz/ready` (DB ping) + `/metrics` (Prometheus gauges) + `CLIENT_DIST` +
   idempotent drizzle migrations at boot; `Dockerfile`/`.dockerignore` (versions.md kept
   in context — vite stamps the version from it); `.github/workflows/ci.yml` (typecheck →
   tests → build → GHCR image `ghcr.io/libertygos/pantheons` → homelab newTag retarget).
   Card faces are plain git files since 2026-07-07, so a normal checkout bakes the real
   card art (no `lfs: true` needed). Deployed at **pantheons.gosgames.com** via
   `homelab/infra/pantheons` (ArgoCD app, Traefik IngressRoute, cert, CNPG `pantheons`
   DB). **Actions for Jules:** add the `HOMELAB_DEPLOY_TOKEN` secret to this repo (same
   PAT as WoG) for future auto-deploys, and seed the platform catalog so Pantheons shows
   as `live` on www.gosgames.com.
