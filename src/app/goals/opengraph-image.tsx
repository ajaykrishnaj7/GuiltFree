import { createSocialImage } from "@/lib/socialImageFactory";

export const alt = "GuiltFree Goals";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return createSocialImage({
    title: "Goals",
    subtitle: "Tune your daily targets for calories and macros.",
    accentFrom: "#064e3b",
    accentTo: "#10b981",
    routeBadge: "GOALS",
    glyph: "◎",
  });
}
