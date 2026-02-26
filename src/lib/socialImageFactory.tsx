import { ImageResponse } from "next/og";

type SocialImageOptions = {
  title: string;
  subtitle: string;
  accentFrom: string;
  accentTo: string;
};

export const createSocialImage = ({
  title,
  subtitle,
  accentFrom,
  accentTo,
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
          background: `linear-gradient(135deg, ${accentFrom} 0%, #1f2a63 55%, ${accentTo} 100%)`,
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
        <div style={{ fontSize: "66px", lineHeight: 1.05, fontWeight: 800 }}>
          GuiltFree
        </div>
        <div style={{ fontSize: "40px", marginTop: "16px", opacity: 0.95 }}>
          {title}
        </div>
        <div style={{ fontSize: "28px", marginTop: "24px", opacity: 0.85 }}>
          {subtitle}
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
