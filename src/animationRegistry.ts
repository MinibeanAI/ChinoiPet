import manifestData from '../docs/animation-manifest.json';
import type { CalendarCategory } from './global';

export type AnimationId =
  | 'idle_breathe_wind'
  | 'pet_tap_smile'
  | 'clingy_pout'
  | 'blow_kiss'
  | 'wave_come_here'
  | 'listen_to_crowd'
  | 'drink_reminder'
  | 'rest_reminder'
  | 'calendar_gentle_prompt'
  | 'calendar_urgent_prompt'
  | 'sleeve_sweep_loop'
  | 'robe_sweep_intro'
  | 'skirt_release_spin'
  | 'robe_remove_stage'
  | 'single_leg_knee_slide_backbend';

export interface AnimationMeta {
  id: AnimationId;
  category: string;
  priority: 'P0' | 'P1' | 'P2';
  durationSeconds: number;
  loop: boolean;
  description: string;
  sourceVideos: string[];
}

export const animationManifest = manifestData;

export const animationsById = Object.fromEntries(
  (manifestData.animations as AnimationMeta[]).map((animation) => [animation.id, animation])
) as Record<AnimationId, AnimationMeta>;

export const idleAnimation: AnimationId = 'idle_breathe_wind';

export const dailyAnimationPool: AnimationId[] = [
  'wave_come_here',
  'listen_to_crowd',
  'sleeve_sweep_loop'
];

export const interactionAnimationPool: AnimationId[] = [
  'pet_tap_smile',
  'clingy_pout',
  'blow_kiss',
  'wave_come_here',
  'listen_to_crowd',
  'robe_sweep_intro',
  'sleeve_sweep_loop',
  'robe_remove_stage',
  'skirt_release_spin',
  'single_leg_knee_slide_backbend'
];

export const longIdleAnimationPool: AnimationId[] = interactionAnimationPool;

export function animationDurationMs(animationId: AnimationId): number {
  return Math.round((animationsById[animationId]?.durationSeconds ?? 2) * 1000);
}

export function calendarAnimationFor(category: CalendarCategory): AnimationId {
  if (category === 'interview' || category === 'deadline' || category === 'meeting') {
    return 'calendar_urgent_prompt';
  }

  if (category === 'celebration' || category === 'stage') {
    return 'robe_sweep_intro';
  }

  return 'calendar_gentle_prompt';
}

export function bubbleForAnimation(animationId: AnimationId): string {
  switch (animationId) {
    case 'drink_reminder':
      return '该喝水啦';
    case 'rest_reminder':
      return '起来舒展一下';
    case 'clingy_pout':
      return '你怎么还不理我';
    case 'blow_kiss':
      return '给你一个亲亲';
    case 'calendar_gentle_prompt':
      return '有个日程快到了';
    case 'calendar_urgent_prompt':
      return '这个日程要认真准备';
    case 'wave_come_here':
      return '来一下';
    case 'listen_to_crowd':
      return '我在听';
    default:
      return '';
  }
}
