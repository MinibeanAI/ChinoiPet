import type { AnimationId } from './animationRegistry';
import type { SpriteMotion, SpriteSequence } from './animationSequences';

interface SequenceManifest {
  id: AnimationId;
  status?: SpriteSequence['status'];
  fps: number;
  loop?: boolean;
  label?: string;
  motion?: SpriteMotion;
}

const frameModules = import.meta.glob('./assets/sequences/*/frame-*.png', {
  eager: true,
  import: 'default',
  query: '?url'
}) as Record<string, string>;

const manifestModules = import.meta.glob('./assets/sequences/*/manifest.json', {
  eager: true,
  import: 'default'
}) as Record<string, SequenceManifest>;

const defaultMotionByAnimation: Partial<Record<AnimationId, SpriteMotion>> = {
  idle_breathe_wind: 'breathe',
  pet_tap_smile: 'tap',
  clingy_pout: 'tap',
  blow_kiss: 'prompt',
  wave_come_here: 'wave',
  listen_to_crowd: 'listen',
  drink_reminder: 'prompt',
  rest_reminder: 'prompt',
  calendar_gentle_prompt: 'prompt',
  calendar_urgent_prompt: 'prompt',
  sleeve_sweep_loop: 'sleeve',
  robe_sweep_intro: 'robe',
  skirt_release_spin: 'spin',
  robe_remove_stage: 'robe',
  single_leg_knee_slide_backbend: 'slide'
};

function manifestKeyFor(animationId: string) {
  return `./assets/sequences/${animationId}/manifest.json`;
}

function parseFramePath(filePath: string) {
  const match = filePath.match(/\.\/assets\/sequences\/([^/]+)\/frame-(\d+)\.png$/);
  if (!match) return null;

  return {
    animationId: match[1] as AnimationId,
    index: Number(match[2])
  };
}

export function getBundledSequenceOverrides(): Partial<Record<AnimationId, SpriteSequence>> {
  const groupedFrames = new Map<AnimationId, Array<{ index: number; image: string }>>();

  for (const [filePath, image] of Object.entries(frameModules)) {
    const parsed = parseFramePath(filePath);
    if (!parsed) continue;

    const frames = groupedFrames.get(parsed.animationId) ?? [];
    frames.push({ index: parsed.index, image });
    groupedFrames.set(parsed.animationId, frames);
  }

  const overrides: Partial<Record<AnimationId, SpriteSequence>> = {};

  for (const [animationId, frames] of groupedFrames.entries()) {
    const manifest = manifestModules[manifestKeyFor(animationId)];
    if (!manifest || manifest.id !== animationId || !Number.isFinite(manifest.fps) || manifest.fps <= 0) {
      continue;
    }

    const durationMs = Math.round(1000 / manifest.fps);
    const motion = manifest.motion ?? defaultMotionByAnimation[animationId] ?? 'idle';
    const label = manifest.label ?? animationId;

    overrides[animationId] = {
      status: manifest.status ?? 'keyframe-review',
      loop: manifest.loop,
      frames: frames
        .sort((left, right) => left.index - right.index)
        .map((frame, index) => ({
          image: frame.image,
          durationMs,
          motion,
          label: `${label} ${index + 1}`
        }))
    };
  }

  return overrides;
}
