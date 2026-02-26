import { ImageResponse } from "next/og";

export const alt = "GuiltFree - AI Nutrition Tracker";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0b1021 0%, #1f2a63 55%, #4f46e5 100%)",
          color: "#ffffff",
          padding: "64px",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <div
          style={{
            width: "86px",
            height: "86px",
            borderRadius: "24px",
            backgroundColor: "#ffffff",
            color: "#111827",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "52px",
            fontWeight: 800,
            marginBottom: "34px",
          }}
        >
          G
        </div>
        <div style={{ fontSize: "72px", lineHeight: 1.05, fontWeight: 800 }}>
          GuiltFree
        </div>
        <div style={{ fontSize: "38px", marginTop: "18px", opacity: 0.95 }}>
          AI Nutrition Tracker
        </div>
        <div style={{ fontSize: "30px", marginTop: "24px", opacity: 0.8 }}>
          Log meals naturally. Track macros with confidence.
        </div>
      </div>
    ),
    size,
  );
}
