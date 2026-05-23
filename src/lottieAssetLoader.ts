import type { AnimationId } from './animationRegistry';

const lottieModules = import.meta.glob('./assets/lottie/*.json', {
  import: 'default'
}) as Record<string, () => Promise<unknown>>;

const lottieAssetCache: Partial<Record<AnimationId, unknown>> = {};

function lottiePathFor(animationId: AnimationId) {
  return `./assets/lottie/${animationId}.json`;
}

export function hasBundledLottieAsset(animationId: AnimationId): boolean {
  return Boolean(lottieModules[lottiePathFor(animationId)]);
}

export async function loadBundledLottieAsset(animationId: AnimationId): Promise<unknown | undefined> {
  const cachedAsset = lottieAssetCache[animationId];
  if (cachedAsset) return cachedAsset;

  const loadAsset = lottieModules[lottiePathFor(animationId)];
  if (!loadAsset) return undefined;

  const asset = await loadAsset();
  lottieAssetCache[animationId] = asset;
  return asset;
}
