import { createSocialImage } from "@/lib/socialImageFactory";

export const alt = "GuiltFree Kitchen";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return createSocialImage({
    title: "My Kitchen",
    subtitle: "Store ingredients and nutrition facts for faster meal logging.",
    accentFrom: "#064e3b",
    accentTo: "#10b981",
    routeBadge: "KITCHEN",
    glyph: "✦",
  });
}
