import { ImageResponse } from "next/og";

export const size = {
  width: 64,
  height: 64,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1f2a63 0%, #4f46e5 100%)",
          color: "#ffffff",
          fontSize: 30,
          fontWeight: 800,
          fontFamily: "Inter, system-ui, sans-serif",
          borderRadius: 14,
          letterSpacing: -1,
        }}
      >
        GF
      </div>
    ),
    size,
  );
}
