// TERMS OF USE (2026-11-16): the terms of use. Google Play's user-content policy wants the rules a player accepts before
// chatting or talking, with the behaviour that isn't allowed spelled out; India's IT Rules 2021 want a published user
// agreement. Plain words, short.
import type { Metadata } from "next";
import { A, LegalPage, Part, Points } from "@/components/LegalPage";
import { ADULT_AGE, COMPANY } from "@/lib/legal";

export const metadata: Metadata = { title: "Terms of use — Tunga vs Thieves" };

export default function Terms() {
  return (
    <LegalPage title="Terms of use" lead="Tunga vs Thieves is a game of bluffing among friends. Lie about your cards as much as you like. Be decent to the people.">
      <Part title="Who can play">
        <Points items={[
          <>Playing at a table with other people is for players aged {ADULT_AGE} and over.</>,
          <>If you are under {ADULT_AGE} you can play against the computer players. Chat, voice and tables with other people stay closed.</>,
          <>The game asks when you were born before your first game. Answer truthfully.</>,
        ]} />
      </Part>
      <Part title="What is not allowed">
        <p>In your name, in messages, in voice notes and when you talk at a table:</p>
        <Points items={[
          "Bullying, threats or harassment of any player.",
          "Hate or abuse about religion, caste, gender, sexuality, disability, region or language.",
          "Sexual talk or content. Anything sexual involving a child is a crime and is reported to the police.",
          "Sharing someone's private details, such as their phone number, address or photos.",
          "Pretending to be another real person, or to be us.",
          "Asking a player for money, or using a table for betting or selling.",
          "Anything against the law in India.",
          "Breaking the game on purpose: hacking, scripts, or flooding a table.",
        ]} />
      </Part>
      <Part title="If someone breaks the rules">
        <Points items={[
          <>Tap their seat. You can mute them for yourself, and <b>Report this player</b> sends us a report with the table code.</>,
          "The host of a table can mute a player for everyone.",
          "We read every report. We can close a table, delete what was sent, and keep a player out where we are able to.",
          <>For anything serious, write to us: see <A href="/contact">Contact and complaints</A>.</>,
        ]} />
      </Part>
      <Part title="Voice and messages">
        <p>Voice at a table goes live between the phones and is not recorded by us. Text messages and short voice notes you send are kept with that game. See <A href="/privacy">Privacy</A>.</p>
      </Part>
      <Part title="It is a free game">
        <p>There is no money in this game: no entry fee, no prizes, no bets, nothing to buy inside it. The printed card game is sold separately at <A href={COMPANY.site}>playablegames.in</A>.</p>
      </Part>
      <Part title="Our work, your words">
        <p>The game, its rules, names and art belong to {COMPANY.name}. What you type or say stays yours; you let us carry it to the other players at your table and keep it with the game as described in Privacy.</p>
      </Part>
      <Part title="No promises we can't keep">
        <p>We try to keep the game running and fair, but it is offered as it is. A table can drop, a bug can spoil a game, and we may change or stop the game. As far as the law allows, we are not liable for loss that follows from using it.</p>
      </Part>
      <Part title="The law">
        <p>These rules follow the laws of India. Disputes go to the courts at Mumbai. If we change these rules, the game will ask you to agree again before your next game.</p>
      </Part>
    </LegalPage>
  );
}
