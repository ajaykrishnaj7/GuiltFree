import { createSocialImage } from "@/lib/socialImageFactory";

export const alt = "GuiltFree Trends";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return createSocialImage({
    title: "Trends & Analytics",
    subtitle: "Track goal reach, weekly averages, and consistency.",
    accentFrom: "#0f172a",
    accentTo: "#4f46e5",
  });
}
