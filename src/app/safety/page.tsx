// SAFETY (2026-11-16): staying safe at a table, and our child-safety standards. Google Play asks apps with chat or
// voice for published standards against child sexual abuse and exploitation, and a reminder to be safe online.
import type { Metadata } from "next";
import { A, LegalPage, Part, Points } from "@/components/LegalPage";
import { ADULT_AGE } from "@/lib/legal";

export const metadata: Metadata = { title: "Safety — Tunga vs Thieves" };

export default function Safety() {
  return (
    <LegalPage title="Safety" lead="The game is built for groups of friends. Here is how to stay safe, and what we do to protect children.">
      <Part title="Staying safe at a table">
        <Points items={[
          "Play with people you know. A table code is an invitation: share it only with your group.",
          "Use a nickname. Never give your full name, phone number, address, school or college to someone you met in a game.",
          "Nobody from the game will ever ask you for money, a password or a photo.",
          "If someone makes you uncomfortable, tap their seat: mute them, report them, and leave the table.",
        ]} />
      </Part>
      <Part title={`Under ${ADULT_AGE}`}>
        <Points items={[
          <>Players under {ADULT_AGE} play against the computer players only. There is no chat, no voice and no table with other people.</>,
          "They choose a nickname from a list. Nothing they type is kept, and turn alerts are off.",
          "The game remembers only “under 18: yes” on that phone. The birth date is not stored or sent to us.",
        ]} />
      </Part>
      <Part title="Our child-safety standards">
        <p>We do not tolerate child sexual abuse or exploitation in any form. This covers sexual content involving a child, sexual talk with a child, grooming, asking a child for images, and threats or blackmail of that kind.</p>
        <Points items={[
          "Any such content or behaviour is removed as soon as we learn of it, and the player is kept out.",
          "We keep what is needed as evidence and report it to the authorities as the law requires.",
          <>Report it from the game (tap the player&rsquo;s seat, then <b>Report this player</b>) or write to us: see <A href="/contact">Contact and complaints</A>.</>,
        ]} />
      </Part>
      <Part title="Help outside the game (India)">
        <Points items={[
          <>Childline: call <b>1098</b>, free, any time.</>,
          <>Cyber crime: <A href="https://cybercrime.gov.in">cybercrime.gov.in</A> or call <b>1930</b>.</>,
          <>In an emergency call <b>112</b>.</>,
        ]} />
      </Part>
    </LegalPage>
  );
}
