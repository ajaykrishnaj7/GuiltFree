import { createSocialImage } from "@/lib/socialImageFactory";

export const alt = "GuiltFree Diary";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return createSocialImage({
    title: "Nutrition Diary",
    subtitle: "Daily timeline of your meals and macro intake.",
    accentFrom: "#111827",
    accentTo: "#22d3ee",
  });
}
