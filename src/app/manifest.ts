import type { MetadataRoute } from "next";

// Add to Home Screen — and on iPhones, the only way web push (turn alerts) works.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tunga vs Thieves",
    short_name: "Tunga",
    description: "Two ancient Stones, hidden thieves — play on your phones with your group.",
    start_url: "/",
    display: "standalone",
    background_color: "#1f1007",
    theme_color: "#1f1007",
    icons: [{ src: "/icon.png", sizes: "any", type: "image/png" }],
  };
}
