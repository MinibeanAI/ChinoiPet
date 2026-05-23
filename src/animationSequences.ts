import type { AnimationId } from './animationRegistry';
import { getBundledSequenceOverrides } from './sequenceAssetLoader';

export type SpriteMotion =
  | 'idle'
  | 'breathe'
  | 'tap'
  | 'pout'
  | 'kiss'
  | 'wave'
  | 'listen'
  | 'sleeve'
  | 'robe'
  | 'spin'
  | 'jump'
  | 'land'
  | 'slide'
  | 'prompt';

export interface SpriteFrame {
  image: string;
  durationMs: number;
  motion: SpriteMotion;
  label: string;
}

export interface SpriteSequence {
  status: 'placeholder' | 'keyframe-review' | 'approved' | 'final';
  loop?: boolean;
  frames: SpriteFrame[];
}

export const spriteSequences: Partial<Record<AnimationId, SpriteSequence>> = getBundledSequenceOverrides();
