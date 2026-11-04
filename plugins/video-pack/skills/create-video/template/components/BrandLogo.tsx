import React from "react";
import { Img, staticFile } from "remotion";

type Props = {
  /** File name (without extension) in public/logos/, e.g. "whatsapp". */
  name: string;
  size?: number;
  /** Optional white card behind the logo for contrast on the paper bg. */
  card?: boolean;
  radius?: number;
};

/**
 * Real brand logo (transparent PNG downloaded into public/logos/).
 * Preferred over the flat simple-icons <Logo> whenever a real,
 * full-color logo exists for the brand.
 */
export const BrandLogo: React.FC<Props> = ({
  name,
  size = 120,
  card = false,
  radius = 24,
}) => {
  const img = (
    <Img
      src={staticFile(`logos/${name}.png`)}
      style={{
        width: card ? size * 0.72 : size,
        height: card ? size * 0.72 : size,
        objectFit: "contain",
      }}
    />
  );

  if (!card) return img;

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
      }}
    >
      {img}
    </div>
  );
};
