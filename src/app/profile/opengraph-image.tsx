import { createSocialImage } from "@/lib/socialImageFactory";

export const alt = "GuiltFree Profile";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return createSocialImage({
    title: "Profile & AI Settings",
    subtitle: "Control your account, preferences, and AI provider keys.",
    accentFrom: "#0f172a",
    accentTo: "#a855f7",
  });
}
