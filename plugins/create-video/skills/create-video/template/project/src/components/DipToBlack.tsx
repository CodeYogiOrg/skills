import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";

type Props = {
  /** Total dip length; screen is fully dark at the midpoint. */
  durationInFrames?: number;
  /** Dip through a different color, e.g. the paper beige "#D9C5A3". */
  color?: string;
};

/**
 * Dark-out / dark-in overlay for major section boundaries. Mount in
 * Video.tsx inside a <Sequence> centered on the cut:
 *
 *   <Sequence from={boundaryFrame - 12} durationInFrames={24}>
 *     <DipToBlack />
 *   </Sequence>
 */
export const DipToBlack: React.FC<Props> = ({
  durationInFrames = 24,
  color = "#000",
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame,
    [0, durationInFrames / 2, durationInFrames],
    [0, 1, 0],
    { easing: Easing.inOut(Easing.quad) },
  );

  return (
    <AbsoluteFill style={{ backgroundColor: color, opacity, pointerEvents: "none" }} />
  );
};
