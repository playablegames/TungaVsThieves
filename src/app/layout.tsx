import type { Metadata, Viewport } from "next";
import { Cinzel, Playfair_Display, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

// DESIGN.md: Playfair Display for roles, banners and reveals (roman only); Plus Jakarta Sans for everything you tap or read fast
const playfair = Playfair_Display({ variable: "--font-playfair", subsets: ["latin"], weight: ["400", "700", "900"], style: ["normal"] });
// Cinzel: the engraved capitals on the title screen buttons
const cinzel = Cinzel({ variable: "--font-cinzel", subsets: ["latin"], weight: ["600", "700"] });
const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], weight: ["400", "500", "700", "800"] });

export const metadata: Metadata = {
  title: "Tunga vs Thieves",
  description: "Two ancient Stones, hidden thieves — play Tunga vs Thieves on your phones with your group, voice built in.",
  openGraph: { title: "Tunga vs Thieves", description: "Two ancient Stones are hidden among the players. Find the thieves before they walk off with one.", type: "website" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#1f1007" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${playfair.variable} ${cinzel.variable} ${jakarta.variable} h-full antialiased`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
