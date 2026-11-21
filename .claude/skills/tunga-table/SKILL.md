---
name: tunga-table
description: How Tunga vs Thieves Online is built. Read before ANY work in tunga-online:
  rules, server, bots, screens, films, deploy.
---

# Tunga table: the house rules

## 1. Where things live
- Rules = src/rules/game.ts, written from docs/RULES_ABSOLUTE.md (the owner's answers).
  The rules are the ONLY thing that changes a game. Every rule cites its number, e.g. [3.2].
- Bots = src/rules/brain.ts. Server plumbing = src/server/game.ts + src/server/bots.ts.
- Plan + screen checklist = docs/REVAMP_PLAN.md. Read it first.

## 2. The server is in charge
- A phone sends a move; the server checks its shape (zod), the rules check it is legal.
- A phone sees ONLY view(state, seat): its own hand and role, public events, and events
  sent to it. Never someone else's hand, role or ballot until the game is over.
- Every new event type: decide who may see it (to: "all" | [seats] | [] = server only).
  The leak check in src/server/game.test.ts must stay green.

## 3. The clock
- Every decision gets 20 s [2.8]. Time out = the app passes for you (keeps 2 at random).
- Talk never moves the clock. Two time-outs in a row = a stand-in that only plays safe.
- Bots' turns wait 1.5 s; bots vote and do Bhukamp at once.

## 4. Bots
- Each server call rebuilds every bot from the game's log. A bot's belief update must
  depend only on the events read so far, never on today's hand or side. Anything that
  needs "my hand back then" is saved as a server-only bot_note event.
- src/server/bots.test.ts proves a rebuilt bot = a live bot. Never let it go red.
- Bots reason like players; nothing exists to balance the game (docs/BOT_LOGIC.md).
  Balance is measured with scripts/balance-brain.mts, never guessed.

## 5. Screens (the owner's way)
- 2026-11-21 owner: do NOT ask about every screen. Build routine screens in the approved
  table look, check screenshots at 442x884 yourself. Bring to the owner ONLY: rule decisions,
  legal/Play Store items (age, terms, report/block), changes to an approved look, and the
  core turn screen. One item at a time.
- Look: night navy + gold, Cinzel titles + Poppins text. Normal screens are still;
  big moments are short Remotion films (video/ → public/video/), a tap skips them.
- One clear thing per screen. Smooth on a cheap Android.
- Ask before any design change. Plans go in chat (English + ASCII), not artifacts.

## 6. Done means
- npx tsc --noEmit, npx eslint src, npx vitest run: all clean.
- Run the server tests several times. They use random deals, and a test that fails once
  in ten runs is a bug in the test or the code.

## 7. Going live
- ONLY `npx vercel deploy --prod --yes` from the repo folder (Vercel project
  tunga-thieves, account chibolar). git push builds a different project that is NOT live.
- After deploying, open a chunk of tunga.playablegames.in and check the new text is there.
- Supabase project = wbidmtgnhiinvfnrsqkk. The owner's other project is Bale.
  Check the project id before any SQL.

## 8. Other skills here
- Screens: game-ui-ux, web-design-guidelines, emil-design-eng, frontend-design.
- Big moments: game-feel (ignore its screen-shake/hit-stop code: our films are videos).
- Sound: audio-design. React speed: vercel-react-best-practices. Database: supabase.
- Remotion: remotion-best-practices.
- Installed 2026-11-19 by copying reviewed files: gamedev-skills/awesome-gamedev-agent-skills
  c6ca6c4, vercel-labs/agent-skills 1a2c79d, supabase/agent-skills c9be0e9.
