// CONTACT AND COMPLAINTS (2026-11-16): India's IT Rules 2021 ask for a named Grievance Officer with contact details,
// a reply within 24 hours and an answer within 15 days. The name and the email are confirmed by the owner (lib/legal.ts).
import type { Metadata } from "next";
import { A, LegalPage, Part, Points } from "@/components/LegalPage";
import { COMPANY } from "@/lib/legal";

export const metadata: Metadata = { title: "Contact and complaints — Tunga vs Thieves" };

export default function Contact() {
  return (
    <LegalPage title="Contact and complaints" lead="A problem with a player, a question about your data, or a complaint about the game: this is where it goes.">
      <Part title="Fastest: from inside the game">
        <Points items={[
          <>About a player: tap their seat, then <b>Report this player</b>.</>,
          <>About anything else: open the menu at your table, then <b>Report a problem</b>.</>,
        ]} />
        <p>Both send us the table code, so we can find the game.</p>
      </Part>
      <Part title="Grievance Officer">
        <address className="not-italic">
          {COMPANY.grievanceOfficer && <><b>{COMPANY.grievanceOfficer}</b><br /></>}
          {COMPANY.grievanceOfficer ? "Grievance Officer, " : "The Grievance Officer, "}{COMPANY.name}<br />
          {COMPANY.address.map((l) => <span key={l}>{l}<br /></span>)}
          {COMPANY.email && <>Email: <A href={`mailto:${COMPANY.email}`}>{COMPANY.email}</A><br /></>}
          {COMPANY.phone && <>Phone: <A href={`tel:${COMPANY.phone.replace(/\s/g, "")}`}>{COMPANY.phone}</A><br /></>}
          Instagram: {COMPANY.instagram}
        </address>
      </Part>
      <Part title="What to send">
        <Points items={[
          "The table code, if it is about a game.",
          "What happened, and when.",
          "How we can reach you.",
        ]} />
      </Part>
      <Part title="How fast we answer">
        <Points items={[
          "We acknowledge a complaint within 24 hours.",
          "We give you an answer within 15 days.",
          "Reports about a child's safety are looked at first.",
        ]} />
        <p>If you are not satisfied with our answer on a data matter, you can take it to the Data Protection Board of India.</p>
      </Part>
      <Part title="Buying the card game">
        <p>Orders, delivery and returns of the printed game are handled on <A href={COMPANY.site}>playablegames.in</A>.</p>
      </Part>
    </LegalPage>
  );
}
