import React from "react";
import { AbsoluteFill } from "remotion";

export const PaperBackground: React.FC<{ tint?: string }> = ({
  tint = "#D9C5A3",
}) => {
  return (
    <AbsoluteFill style={{ background: tint }}>
      <svg
        width="100%"
        height="100%"
        style={{ position: "absolute", inset: 0, opacity: 0.35 }}
      >
        <defs>
          <filter id="paperNoise">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.9"
              numOctaves="2"
              seed="7"
            />
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 0.55
                      0 0 0 0 0.42
                      0 0 0 0 0.25
                      0 0 0 0.6 0"
            />
          </filter>
        </defs>
        <rect
          width="100%"
          height="100%"
          filter="url(#paperNoise)"
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 50% 40%, rgba(255,255,255,0.15) 0%, rgba(0,0,0,0.15) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
