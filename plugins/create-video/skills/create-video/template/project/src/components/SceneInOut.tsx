import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";

type Props = {
  /** Duration of the parent Series.Sequence — pass the same number. */
  durationInFrames: number;
  /** Frames the content takes to fade+rise in. */
  enter?: number;
  /** Frames the content takes to fade out before the cut. */
  exit?: number;
  /** Pixels the content rises from on enter. */
  rise?: number;
  children: React.ReactNode;
};

/**
 * Seamless content-swap transition. Wrap EVERY scene's content in this
 * (background stays outside, in Video.tsx). Content fades+rises in at the
 * start and fades out fully 2 frames before the scene ends, so every hard
 * cut lands on clean paper — no crossfade ghosting between scenes.
 */
export const SceneInOut: React.FC<Props> = ({
  durationInFrames,
  enter = 12,
  exit = 10,
  rise = 30,
  children,
}) => {
  const frame = useCurrentFrame();

  const enterOpacity = interpolate(frame, [0, enter], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  // exit={0} disables the exit fade — content holds to the very last frame.
  const exitOpacity =
    exit > 0
      ? interpolate(
          frame,
          [durationInFrames - exit, durationInFrames - 2],
          [1, 0],
          {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.in(Easing.cubic),
          },
        )
      : 1;
  const translateY = interpolate(frame, [0, enter], [rise, 0], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  return (
    <AbsoluteFill
      style={{
        opacity: Math.min(enterOpacity, exitOpacity),
        transform: `translateY(${translateY}px)`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
