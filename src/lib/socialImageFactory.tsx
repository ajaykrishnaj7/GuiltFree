import { ImageResponse } from "next/og";

type SocialImageOptions = {
  title: string;
  subtitle: string;
  accentFrom: string;
  accentTo: string;
  routeBadge?: string;
  glyph?: string;
};

export const createSocialImage = ({
  title,
  subtitle,
  accentFrom,
  accentTo,
  routeBadge,
  glyph,
}: SocialImageOptions) =>
  new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: `linear-gradient(135deg, ${accentFrom} 0%, ${accentTo} 100%)`,
          color: "#ffffff",
          padding: "64px",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: "72px",
            top: "62px",
            fontSize: "64px",
            opacity: 0.28,
            fontWeight: 800,
          }}
        >
          {glyph || "GF"}
        </div>
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
            letterSpacing: "-1px",
          }}
        >
          GF
        </div>
        <div style={{ fontSize: "66px", lineHeight: 1.05, fontWeight: 800 }}>
          GuiltFree
        </div>
        <div style={{ fontSize: "40px", marginTop: "16px", opacity: 0.95 }}>
          {title}
        </div>
        <div style={{ fontSize: "28px", marginTop: "24px", opacity: 0.85 }}>
          {subtitle}
        </div>
        <div
          style={{
            marginTop: "24px",
            alignSelf: "flex-start",
            backgroundColor: "rgba(255,255,255,0.18)",
            border: "1px solid rgba(255,255,255,0.35)",
            borderRadius: "999px",
            padding: "8px 16px",
            fontSize: "18px",
            fontWeight: 700,
            letterSpacing: "0.06em",
          }}
        >
          {routeBadge || "HOME"}
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
