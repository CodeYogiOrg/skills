import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

/**
 * Spring entrance for word-anchored visuals. Pass `at` (scene-relative frame)
 * so the element is ALWAYS mounted in its final layout slot and only its
 * scale/opacity animates — never gate siblings behind <Sequence> inside a
 * shared flex/grid container, or each new arrival re-centers the layout and
 * displaces the icons already on screen.
 */
export const PopIn: React.FC<{ children: React.ReactNode; at?: number }> = ({
  children,
  at = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - at;
  const scale = spring({
    frame: local,
    fps,
    config: { damping: 14, stiffness: 160 },
  });
  const opacity = interpolate(local, [0, 6], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div style={{ transform: `scale(${scale})`, opacity }}>{children}</div>
  );
};
