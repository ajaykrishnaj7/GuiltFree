import { createSocialImage } from "@/lib/socialImageFactory";

export const alt = "GuiltFree - AI Nutrition Tracker";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return createSocialImage({
    title: "AI Nutrition Tracker",
    subtitle: "Log meals naturally. Track macros with confidence.",
    accentFrom: "#0b1021",
    accentTo: "#4f46e5",
    routeBadge: "HOME",
    glyph: "⌂",
  });
}
