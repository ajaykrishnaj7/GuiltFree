import { createSocialImage } from "@/lib/socialImageFactory";

export const alt = "GuiltFree History";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return createSocialImage({
    title: "Meal History",
    subtitle: "Review your logged meals and macro details over time.",
    accentFrom: "#1f2937",
    accentTo: "#f59e0b",
    routeBadge: "HISTORY",
    glyph: "⟲",
  });
}
