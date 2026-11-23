// PRIVACY (first written 2026-10-14; redone 2026-11-16 for the Play Store and India's DPDP Act 2023; checked against the app 2026-11-23): what the game
// keeps, in plain words. Who we are and where to write come from lib/legal.ts.
import type { Metadata } from "next";
import { A, LegalPage, Part, Points } from "@/components/LegalPage";
import { ADULT_AGE, COMPANY } from "@/lib/legal";

export const metadata: Metadata = { title: "Privacy — Tunga vs Thieves" };

/** what · where it goes · note */
const ROWS: [string, string, string][] = [
  ["The name you type", "Shown to your table and kept with the game.", "No account, no email, no phone number."],
  ["The game itself: moves, votes, accusations, chat lines", "Kept on our server with the game.", "Used to fix bugs and to make the computer players play more like people."],
  ["Messages you whisper to the player beside you", "Kept with the game. Only that player gets it.", "The table sees that you whispered, never what."],
  ["Voice, in the waiting room and at the table", "Goes live between the phones. We never record it.", "Your mic starts off; you can mute anyone for yourself."],
  ["Turn alerts, only if you switch them on", "Your phone's push address, kept with the game.", "Used only to tell you it is your move."],
  ["A crash, or a problem or player you report", "Kept with the game, and a report is emailed to us.", "The text and the table code."],
  ["How many games you have finished", "Counted on this phone and sent when you sit down at a table.", "Only to choose how skilled the computer players are: gentler for new players."],
  ["On this phone", "Your seat key, a few settings, your games count, and whether you are 18 or over.", "Clearing the browser or the app's data removes them."],
];

export default function Privacy() {
  return (
    <LegalPage title="Privacy" lead="No accounts, no ads, no tracking. Here is everything the game keeps.">
      <Part title="Who is responsible">
        <p>{COMPANY.name}, {COMPANY.address.slice(0, 2).join(", ")}. To reach us, see <A href="/contact">Contact and complaints</A>.</p>
      </Part>
      <Part title="What the game keeps">
        <dl className="flex flex-col">
          {ROWS.map(([what, where, note], i) => (
            <div key={what} className={`py-3 ${i ? "border-t border-card-ink/12" : "pt-0"}`}>
              <dt className="font-semibold">{what}</dt>
              <dd className="mt-0.5">{where} <span className="text-card-ink/70">{note}</span></dd>
            </div>
          ))}
        </dl>
      </Part>
      <Part title="What we never collect">
        <p>Your email, phone number, contacts, photos, location or advertising ID. We do not sell or share what the game keeps, and nothing is used for advertising.</p>
      </Part>
      <Part title={`Under ${ADULT_AGE}`}>
        <p>The game asks when you were born before your first game. The date is not stored or sent to us: the phone remembers only whether you are {ADULT_AGE} or over. Players under {ADULT_AGE} play against the computer players with a nickname from a list. For them there is no chat, no voice, no typed name and no turn alerts.</p>
      </Part>
      <Part title="Who helps us run it">
        <p>The game runs on hosting from Vercel and a database from Supabase, voice may pass through a relay service so phones can reach each other, and reports reach us through our Google Workspace email. They handle the data only to run the game for us. Their servers may be outside India.</p>
      </Part>
      <Part title="How long it is kept">
        <p>A game and everything sent in it, reports included, is deleted 90 days after its last move, or sooner if you ask us to delete it. What is kept on your phone stays until you clear the browser or the app&apos;s data.</p>
      </Part>
      <Part title="Your choices">
        <Points items={[
          "Ask what we hold about a game you played.",
          "Ask us to correct it or delete it.",
          "Take back your consent: stop playing and ask us to delete your games.",
          "Complain to us, and if you are not satisfied, to the Data Protection Board of India.",
        ]} />
        <p>Send the table code with your request so we can find the game: see <A href="/contact">Contact and complaints</A>, or use <b>Report a problem</b> in the menu at your table.</p>
      </Part>
    </LegalPage>
  );
}
