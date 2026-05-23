# Lottie Assets

Put final Lottie JSON files here, named by animation ID:

```text
src/assets/lottie/idle_breathe_wind.json
src/assets/lottie/pet_tap_smile.json
src/assets/lottie/wave_come_here.json
```

When a file exists here, `src/lottieAssetLoader.ts` lazy-loads it on demand and `PetCharacter` will prefer Lottie over PNG sprite frames.

Use Lottie first for daily/simple actions:

- `idle_breathe_wind`
- `pet_tap_smile`
- `wave_come_here`
- `listen_to_crowd`
- `drink_reminder`
- `rest_reminder`
- `calendar_gentle_prompt`
- `calendar_urgent_prompt`

Keep complex stage actions as PNG sequences first unless they are redrawn as clean Lottie layers.

Current JSON files are generated raster-sequence Lottie assets from the approved PNG frames:

```bash
npm run lottie:generate
npm run check:lottie
```

They are a runtime bridge so the app uses the Lottie playback path now. Replace them with hand-layered vector Lottie files when final art is redrawn.
