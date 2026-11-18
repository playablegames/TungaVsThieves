# Tunga vs Thieves — the revamp plan (agreed with the owner 2026-11-18)

Goal: a game that feels as finished as the best online party games — clear, fast, dramatic at the big moments, never
broken. We copy the IDEAS that make those games feel professional, never their look.

## What "professional" means here
1. One clear thing per screen — you always know what to do now.
2. Every player is easy to spot — a colour and a face, not just a name.
3. Big moments are short and dramatic; everything else is calm and still.
4. The same sound for the same event, every time.
5. The game never waits on one person — timers keep it moving.
6. It never breaks — drop out, come back, you're still in.
7. "Play again" is one tap.

## The steps

```
STEP 1  FOUNDATION                            STEP 2  LOOK + SOUND KIT
 - clock fix (owner pastes 0003 SQL)           - each player: a colour + a role-card face
 - connect the new rules engine to the server  - one table layout: seats round a dark table,
   (src/rules/game.ts, docs/RULES_ABSOLUTE.md)   Stones in the middle
 - delete the old play screen                  - one sound per event (turn, steal, vote, out)
   (Game.tsx, 1,850 lines) + old engine        - Remotion films for the 11 big moments
 - speed limit: every screen smooth on a
   cheap Android

STEP 3  THE 55 SCREENS, in game order          STEP 4  REAL PEOPLE
 A  Join + waiting room                        - 2-3 games with college kids
 B  Role + first deal                          - watch where they get stuck, fix it
 C  A turn                                     - crash + lag check on their phones
 D  The 7 cards
 E  Out, rounds, final vote, winner            STEP 5  PLAY STORE (TWA, dev account exists)
 F  Settings, problems, replay
    each screen: ASCII sketch -> owner OK -> build -> screenshots -> owner OK -> live
```

Why the foundation first: the screens sit on the new rules. The live game still runs the OLD engine (src/engine), so a
screen built on it now would be rebuilt later.

## Remotion (owner 2026-11-18: "Remotion will make the game come alive")
- Big moments are made on the laptop as short VIDEO FILES (video/ -> public/video/); the phone only plays them, a tap
  skips them. Names ("Riya is out") go on top as plain text. This avoids the lag of drawing animation live on the phone.
- Normal screens stay still — no looping animation.
- The 11 films: your role (BUILT as a test: role-kisaan.mp4, role-chor.mp4) · Teer Kaman hit · Teer Kaman miss ·
  Dal Badal · Faisla result · someone out · Hera Pheri · Bhukamp · new round · final vote reveal · winner.
- Bonus: the end-of-game Stone paths replay as a video players can save and post.
- Render: `npx remotion render video/index.ts YourRole public/video/role-<role>.mp4 --props='{"role":"<role>","thief":<bool>}' --crf=22`
- Still to test: playing these on the owner's phone inside the game.

## The 55 screens (checklist)
Cut by the owner: install prompt, game speed choice, streamer mode, whisper, voice notes (record + inbox), "your turn"
notification. Settings is one screen. Dropped with the old rules: surrender, debate, Dal Badal shield.

Before the game
- [ ] 1 Home (redone 2026-11-16, check against the new kit)
- [ ] 2 Age check
- [~] 3 Make / join a table — BUILT 2026-11-18 on the laptop, not live, no screenshots yet
- [ ] 4 Waiting for players
- [ ] 5 Pick a nickname (under-18 list)
- [ ] 6 Agree to Terms of use
- [ ] 7 Host: table size + add bots
- [ ] 8 Host: remove a player
- [ ] 9 Share / invite link

Start
- [ ] 10 Your role (film built as a test)
- [ ] 11 Roles in play
- [ ] 12 First pile dealt

Each turn
- [ ] 13 Watching someone's turn
- [ ] 14 Your turn: pick up the pile
- [ ] 15 Play or pass?
- [ ] 16 Passing 3
- [ ] 17 Timer runs out
- [ ] 18 Turn clock / timer ring
- [ ] 19 Talk / chat
- [ ] 20 Voice on/off + mic button
- [ ] 21 Mute a player for me
- [ ] 22 Reactions
- [ ] 23 Report / block a player
- [ ] 24 Game log (what happened)

The cards
- [ ] 25 Talashi — you see 2 cards
- [ ] 26 Talashi — you're the one searched
- [ ] 27 Hera Pheri — you steal
- [ ] 28 Hera Pheri — you're robbed, draw 2
- [ ] 29 Kundli — both see roles
- [ ] 30 Bhukamp — everyone passes 1
- [ ] 31 Faisla called
- [ ] 32 Faisla talk + vote
- [ ] 33 Faisla result / tie
- [ ] 34 Teer Kaman aim
- [ ] 35 Teer Kaman talk window
- [ ] 36 Teer Kaman name the role
- [ ] 37 Teer Kaman hit / miss
- [ ] 38 Dal Badal reveal + shuffle
- [ ] 39 Dal Badal new roles seen

Going out
- [ ] 40 You're out
- [ ] 41 Giving your extra vote
- [ ] 42 Watching while out

End of round / game
- [ ] 43 New round
- [ ] 44 Final vote
- [ ] 45 Result (who held the Stones)
- [ ] 46 Winner
- [ ] 47 Stone paths replay
- [ ] 48 Play again

Settings and problems
- [ ] 49 Settings (sound, voice, motion — one screen)
- [ ] 50 Report a problem
- [ ] 51 Someone drops / reconnects
- [ ] 52 No internet / reconnecting
- [ ] 53 Table not found / game already started
- [ ] 54 Something broke (crash screen)
- [ ] 55 Waiting for the out player

## State at the end of 2026-11-18
- Rules: 10 players = 6 villagers + 4 thieves (8e3a4b0). 37/37 rule tests pass.
- Clock fix written (supabase/migrations/0003_sweep_new_address.sql) — owner to paste it in the Supabase SQL Editor,
  then check `select jobname, command from cron.job;` shows tunga.playablegames.in.
- Screen 3 + GET /api/games/[code]/peek + the role film: committed, NOT deployed (deploy = `npx vercel deploy --prod --yes`).
- NEXT: Step 1 — connect the new rules engine to the server.
