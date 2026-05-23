# Final Animation Sequences

Put final rendered PNG frame sequences here.

Expected layout:

```text
src/assets/sequences/<animation-id>/
  frame-000.png
  frame-001.png
  frame-002.png
  manifest.json
```

When a valid sequence exists, `src/sequenceAssetLoader.ts` automatically bundles it and overrides the placeholder key poses in `src/animationSequences.ts`.

See:

- `docs/sequence-asset-contract.md`
- `docs/dynamic-animation-pipeline.md`
