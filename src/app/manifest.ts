import type { MetadataRoute } from "next";

// Add to Home Screen — and on iPhones, the only way web push (turn alerts) works.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tunga vs Thieves",
    short_name: "Tunga",
    description: "Two ancient Stones, hidden thieves — play on your phones with your group.",
    start_url: "/",
    display: "standalone",
    background_color: "#021230", // (2026-11-16) the box's night: the installed app's bottom bar and splash
    theme_color: "#021230",
    icons: [{ src: "/icon.png", sizes: "192x192", type: "image/png" }, { src: "/icon-512.webp", sizes: "512x512", type: "image/webp" }],
  };
}
