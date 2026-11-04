import React from "react";

export const Phone: React.FC<{
  width?: number;
  children?: React.ReactNode;
}> = ({ width = 320, children }) => {
  const height = width * 2.05;
  const bezel = width * 0.03;
  return (
    <div
      style={{
        width,
        height,
        borderRadius: width * 0.14,
        background:
          "linear-gradient(145deg, #1f2937 0%, #111827 40%, #030712 100%)",
        padding: bezel,
        boxShadow:
          "0 30px 80px rgba(0,0,0,0.35), inset 0 0 0 2px rgba(255,255,255,0.06)",
        position: "relative",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: width * 0.11,
          background: "#F8FAFC",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Dynamic Island */}
        <div
          style={{
            position: "absolute",
            top: bezel * 1.5,
            left: "50%",
            transform: "translateX(-50%)",
            width: width * 0.32,
            height: width * 0.08,
            background: "#0b0f19",
            borderRadius: 40,
            zIndex: 2,
          }}
        />
        {children}
      </div>
    </div>
  );
};

export const Laptop: React.FC<{
  width?: number;
  children?: React.ReactNode;
}> = ({ width = 900, children }) => {
  const screenHeight = width * 0.62;
  const baseHeight = width * 0.045;

  return (
    <div
      style={{ width, display: "flex", flexDirection: "column", alignItems: "center" }}
    >
      {/* screen */}
      <div
        style={{
          width: "100%",
          height: screenHeight,
          background:
            "linear-gradient(180deg, #4B5563 0%, #374151 50%, #1F2937 100%)",
          borderRadius: 22,
          padding: width * 0.018,
          boxShadow:
            "0 30px 80px rgba(0,0,0,0.35), inset 0 0 0 1.5px rgba(255,255,255,0.08)",
          position: "relative",
          boxSizing: "border-box",
        }}
      >
        {/* camera notch */}
        <div
          style={{
            position: "absolute",
            top: 6,
            left: "50%",
            transform: "translateX(-50%)",
            width: 8,
            height: 8,
            background: "#0b0f19",
            borderRadius: "50%",
            zIndex: 2,
          }}
        />
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 10,
            background: "#fff",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {children}
        </div>
      </div>
      {/* base */}
      <div
        style={{
          width: width * 1.06,
          height: baseHeight,
          background:
            "linear-gradient(180deg, #E5E7EB 0%, #9CA3AF 60%, #6B7280 100%)",
          borderBottomLeftRadius: 18,
          borderBottomRightRadius: 18,
          boxShadow: "0 15px 30px rgba(0,0,0,0.2)",
          position: "relative",
          marginTop: -2,
        }}
      >
        <div
          style={{
            width: width * 0.12,
            height: baseHeight * 0.25,
            background: "#4B5563",
            borderRadius: 4,
            position: "absolute",
            left: "50%",
            top: baseHeight * 0.28,
            transform: "translateX(-50%)",
          }}
        />
      </div>
    </div>
  );
};
