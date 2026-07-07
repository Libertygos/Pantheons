# Catalog row (T-18) — feeds the gosgames catalog, NOT this repo

Decision 6: the catalog registry row is **platform-owned**. It belongs in the **gosgames
catalog decision doc**, not the Pantheons repo. Recorded here only so the value set is
unambiguous when Jules edits the gosgames repo.

| Field | Value |
|---|---|
| `slug` | `pantheons` |
| `name` | Panthéons |
| `tagline` (FR) | *Un jeu de déduction : découvrez quel dieu se cache derrière chaque joueur.* |
| `min_players` / `max_players` | 4 / 7 |
| `card_art` | First asset pushed as a plain git file (Jules, pre-build) — catalog references it. |
| `released_at` | Unknown → **"as soon as possible"**; set at launch. |

**Action:** add this row in the gosgames repo's catalog doc; ensure `card_art` points at the
thumbnail once pushed. No code change in the Pantheons repo.
