import Lottie from 'lottie-react';
import type { AnimationId } from '../animationRegistry';
import { animationsById, idleAnimation } from '../animationRegistry';
import type { PointerEvent } from 'react';
import { useEffect, useState } from 'react';
import { spriteSequences } from '../animationSequences';
import { hasBundledLottieAsset, loadBundledLottieAsset } from '../lottieAssetLoader';

interface PetCharacterProps {
  activeAnimation: AnimationId;
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
}

export function PetCharacter({ activeAnimation, onPointerDown }: PetCharacterProps) {
  const sequence = spriteSequences[activeAnimation] ?? spriteSequences.idle_breathe_wind;
  const [lottieData, setLottieData] = useState<unknown>();
  const [frameIndex, setFrameIndex] = useState(0);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);

  useEffect(() => {
    setFrameIndex(0);
    setImageLoadFailed(false);
  }, [activeAnimation]);

  useEffect(() => {
    let cancelled = false;

    setLottieData(undefined);

    if (!hasBundledLottieAsset(activeAnimation)) {
      return () => {
        cancelled = true;
      };
    }

    loadBundledLottieAsset(activeAnimation)
      .then((asset) => {
        if (!cancelled) setLottieData(asset);
      })
      .catch(() => {
        if (!cancelled) setLottieData(undefined);
      });

    return () => {
      cancelled = true;
    };
  }, [activeAnimation]);

  useEffect(() => {
    setImageLoadFailed(false);
  }, [frameIndex, sequence]);

  useEffect(() => {
    const currentFrame = sequence?.frames[frameIndex];
    if (!currentFrame) return undefined;

    const atLastFrame = frameIndex >= sequence.frames.length - 1;
    if (atLastFrame && !sequence.loop) return undefined;

    const timer = window.setTimeout(() => {
      setFrameIndex((index) => {
        const nextIndex = index + 1;
        if (nextIndex >= sequence.frames.length) return 0;
        return nextIndex;
      });
    }, currentFrame.durationMs);

    return () => window.clearTimeout(timer);
  }, [frameIndex, sequence]);

  const frame = sequence?.frames[frameIndex] ?? sequence?.frames[0];
  const fallbackFrame = activeAnimation === idleAnimation ? undefined : spriteSequences.idle_breathe_wind?.frames[0];
  const visibleFrame = imageLoadFailed ? (fallbackFrame ?? frame) : frame;
  const meta = animationsById[activeAnimation];
  const frameKey = `${activeAnimation}-${frameIndex}`;
  const spriteContent = visibleFrame ? (
    <div
      className={`pet-sprite anim-${activeAnimation} motion-${visibleFrame.motion}`}
      aria-label={meta?.description ?? '国风桌宠预览'}
    >
      <img
        key={frameKey}
        src={visibleFrame.image}
        alt={visibleFrame.label}
        draggable={false}
        onError={() => setImageLoadFailed(true)}
      />
    </div>
  ) : null;

  if (!lottieData && !spriteContent) return null;

  return (
    <div className="pet-stage" onPointerDown={onPointerDown}>
      {lottieData ? (
        <Lottie
          key={activeAnimation}
          className="lottie-pet"
          animationData={lottieData}
          loop={meta?.loop ?? false}
        />
      ) : (
        spriteContent
      )}
    </div>
  );
}
