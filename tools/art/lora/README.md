# panthflat: the Panthéons style LoRA (homelab #1706)

A flat-vector style LoRA on FLUX.2 klein 4B base, trained with ai-toolkit on the image station
(same route as War of Guilds' wogpaint and À l'abordage's abordink). Trigger word: `panthflat`.

- **Dataset**: 38 text-free images built from `conversion_cartes/` by `build_dataset.py` (it reads the
  god captions from `gods_captions.py` and erases the lettering with `clean.py`). Captions are in
  `captions/`. No training image holds text: text is added by code later (Jules, 2026-11-05).
  Left out: the text-only Actions and the 4 backs. The source art is never modified.
- **Config**: `panthflat-klein4b.yaml` (rank 16, lr 1e-4, 2000 steps, 768/1024 buckets).
- **Use**: workflow `flux2-klein-base-4b` with `panthflat-klein4b-s2000.safetensors` at strength 1.0.
  On the distilled `flux2-klein-4b` the style barely shows, even at 1.4.
- **Weights**: file bank `jules/gosgames/game-art-masters/pantheons/lora/` (not git).
  Test sheets: `jules/Panthéons/1706-style-lora/`.
