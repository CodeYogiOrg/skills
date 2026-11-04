import React from "react";
import * as simpleIcons from "simple-icons";

type Icon = { path: string; hex: string; title: string };

type Props = {
  slug: keyof typeof simpleIcons;
  size?: number;
  color?: string;
  background?: "brand" | "white" | "none";
  radius?: number;
};

export const Logo: React.FC<Props> = ({
  slug,
  size = 120,
  color,
  background = "brand",
  radius = 24,
}) => {
  const icon = (simpleIcons as unknown as Record<string, Icon>)[slug];
  if (!icon) return null;
  const brandColor = `#${icon.hex}`;
  const bg =
    background === "brand"
      ? brandColor
      : background === "white"
        ? "#fff"
        : "transparent";
  const fg = color ?? (background === "brand" ? "#fff" : brandColor);

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow:
          background === "none"
            ? "none"
            : "0 8px 24px rgba(0,0,0,0.15)",
      }}
    >
      <svg
        viewBox="0 0 24 24"
        width={size * 0.6}
        height={size * 0.6}
        fill={fg}
      >
        <path d={icon.path} />
      </svg>
    </div>
  );
};

export const TileLogo: React.FC<{
  letter: string;
  color: string;
  size?: number;
  radius?: number;
}> = ({ letter, color, size = 120, radius = 24 }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: radius,
      background: color,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#fff",
      fontSize: size * 0.55,
      fontWeight: 800,
      fontFamily: "system-ui, sans-serif",
      boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
    }}
  >
    {letter}
  </div>
);
