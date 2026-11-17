// ABOUT (2026-11-16): who makes the game, and the licences of what it is built with.
import type { Metadata } from "next";
import { A, LegalPage, Part, Points } from "@/components/LegalPage";
import { COMPANY } from "@/lib/legal";

export const metadata: Metadata = { title: "About — Tunga vs Thieves" };

export default function About() {
  return (
    <LegalPage title="About" lead="Tunga vs Thieves is a card game of trust and treachery for 4 to 12 players. This is its free online table.">
      <Part title="Who makes it">
        <address className="not-italic">
          <b>{COMPANY.name}</b> ({COMPANY.udyam})<br />
          {COMPANY.address.map((l) => <span key={l}>{l}<br /></span>)}
        </address>
        <p>The game, its rules, names and art are copyright &copy; 2026 {COMPANY.name}. All rights reserved.</p>
      </Part>
      <Part title="The printed game">
        <p>75 cards in a box, for a table of friends with no phones. <A href={COMPANY.site}>Buy it at playablegames.in</A>.</p>
      </Part>
      <Part title="Built with">
        <Points items={[
          "Lettering: Cinzel and Poppins, under the SIL Open Font Licence.",
          "Music: written for this game.",
          "Software: Next.js and React (MIT licence), Supabase and LiveKit client libraries (MIT and Apache 2.0), Remotion.",
        ]} />
      </Part>
      <Part title="Free, with no catch">
        <p>No money, no prizes, no bets, no ads and no accounts.</p>
      </Part>
    </LegalPage>
  );
}
