import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

/** Speaker ids come from the project's own script — see video.config.json "speakers". */
type Speaker = string;

type Props = {
  speaker?: Speaker;
  text: string;
  from: number;
  position?: "top" | "center" | "bottom";
};

export const Caption: React.FC<Props> = ({
  text,
  from,
  position = "top",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - from;

  if (local < 0) return null;

  const pop = spring({
    frame: local,
    fps,
    config: { damping: 16, stiffness: 130 },
  });
  const translateY = interpolate(pop, [0, 1], [30, 0]);
  const opacity = interpolate(local, [0, 8], [0, 1], {
    extrapolateRight: "clamp",
  });

  const anchor =
    position === "top"
      ? { top: 140 }
      : position === "bottom"
        ? { bottom: 140 }
        : { top: "50%", transform: "translateY(-50%)" };

  return (
    <div
      style={{
        position: "absolute",
        ...anchor,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        opacity,
      }}
    >
      <div
        style={{
          maxWidth: 900,
          padding: "0 60px",
          transform: `translateY(${translateY}px)`,
        }}
      >
        <div
          style={{
            color: "#111",
            fontSize: 62,
            fontWeight: 900,
            lineHeight: 1.15,
            textAlign: "center",
            fontFamily:
              "'Fraunces', 'Times New Roman', system-ui, sans-serif",
            letterSpacing: "-0.5px",
            textShadow: "0 2px 0 rgba(255,255,255,0.35)",
          }}
        >
          {text}
        </div>
      </div>
    </div>
  );
};
