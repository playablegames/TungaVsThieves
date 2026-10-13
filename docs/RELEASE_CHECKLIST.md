# Tunga vs Thieves online — release checklist

The gates a build must pass before real players get it. Each line is a yes/no. Written 2026-10-13 from what this
project has actually tripped on. Tick it on the `preview` site, then promote to `main` (= the live site).

## 1. The game itself
- [ ] **Rules frozen** for the release (role table, Bhukamp 1 left + 1 right, Teer Kaman, Faisla caller takes the cards).
      Any change after the freeze = a new release.
- [ ] **Rulebook = the code.** The rulebook (`Tunga/Tunga_vs_Thieves_Rulebook_v17.md`) says exactly what `src/engine` does,
      including the role table (7p = 3 thieves).
- [ ] **Balance inside 45–55% village wins at every table size, measured on 1,000 games (±3)** in the cloud
      (`gh workflow run sims.yml -f games=1000`). One number from 250 games (±6) is a look, not a decision.
- [ ] **Bots pass the scorecard** against real players (`npx tsx scripts/learn-from-games.mts`): ballots, Stone
      sitting, claims, Teer Kaman within the human range.
- [ ] **At least 10 real games** on the release build with 3+ different real people, and the logs analysed.

## 2. Code health
- [ ] **GitHub Actions green** on the release commit: `fast` (types, lint, quick tests) and `slow` (the fuzz).
- [ ] No dev-only door open: `/dev/films`, `debugRig`, `window.__fx` answer only under `next dev` (check them on the
      live URL — they must 404 / not exist).
- [ ] `tells.json` re-learned after the last bot change (`npx tsx scripts/tells-learn.mts 150`).

## 3. The live setup
- [ ] **Vercel env vars on BOTH Production and Preview** (Supabase, LiveKit, TURN, VAPID). Without them a preview
      keeps games in memory and they vanish (2026-10-13: a whole game lost).
- [ ] **Rotate the Supabase service key** before going public; it has lived in local files and logs.
- [ ] Supabase: RLS on, backups on, the `games`/`messages` tables have a clean-up plan (old games pile up).
- [ ] A **rollback** you have tried once: Vercel → Deployments → the previous one → "Promote to Production".

## 4. On real phones (not just the desktop)
- [ ] Android Chrome, iPhone Safari, and **the WhatsApp in-app browser** (where invite links open): join, voice,
      alerts, sound.
- [ ] A cheap Android: 60 fps on the table, no lag in the films, **battery** over a 15-minute game.
- [ ] **Sound on phone speakers**: the music sits under voices (it ducks), effects don't clip, the narrator is clear.
- [ ] Reduce-motion on: no shakes, particles, burns or films; words and the table still tell the whole story.
- [ ] 360 px wide screens: no text cut off (the stamped words were, until 2026-10-13).

## 5. People
- [ ] A **first game anyone can finish** without help: the tutorial / Learn by playing works start to end.
- [ ] Every big moment is understood without reading (nudges glow, films and words say what happened).
- [ ] **Privacy note** in the app (DRAFT at /privacy, 2026-10-14 — the owner's name and a contact still to add): what is stored (game logs, chat, names), for how long, voice is not recorded
      unless a whisper is sent. India's DPDP Act 2023 applies to personal data.
- [ ] **No dark patterns** (India's 2023 guidelines): no fake urgency, no nudges on lethal moves, nothing hidden.
- [x] A way to report a problem — ☰ → Report a problem (2026-10-14).

## 6. Licences and art
- [ ] All art is the designer's own (art-source/) — no placeholder or generated stock left in.
- [ ] **Remotion licence**: free only for a company of up to 3 people — buy the company licence if that changes.
- [ ] Fonts licensed for web use; the music is our own (scripts/music/make_music.py) — no samples.
- [ ] Bot voices (when they come): a licensed TTS service, never an unofficial endpoint.

## 7. Launch week (added 2026-10-14 from indie and Steam launch checklists — adapted for a free web game)
- [ ] **Load test**: bot clients play whole games at **2× the expected peak** of tables at once, and one long soak run
      (memory leaks show in soaks, not spikes). Watch Supabase, LiveKit and Vercel limits while it runs.
- [ ] **Crash reports on**: phones report crashes by themselves (`/api/report`, kept in that game's log as a server-only
      line); someone reads them every day of launch week. ☰ → Report a problem works.
- [ ] **Hotfix plan**: a game-breaking bug is fixed and live within **24–48 h**; small ones wait for the week-1 update.
- [ ] **Rollback drill**: the rollback (§3) tried once **this week**, with a named person who presses it.
- [ ] **Slow network**: a whole game on a throttled "3G" connection and on a phone that drops out and comes back.
- [ ] **Someone new plays the opening** with no help — How to play, the role screen, the first turn — the last 48 h.
- [ ] **No debug in the build**: no `console.log`, dev pages 404 on the live URL (checked 2026-10-14: clean).
- [ ] **Share preview**: the WhatsApp link preview shows the cover and one clear line (Open Graph image + text).
- [ ] **Press kit**: 6+ real screenshots, a 60–90 s gameplay trailer that hooks in the first 5 s, short clips for social.
- [ ] **Launch messages drafted** (WhatsApp, Instagram, the group invite) so the day is only "send".
- [ ] **Known issues** written down and visible, so players see it's being handled.
- [ ] **Week 1**: read every report and every real-game log; the most common complaint shapes the first update.

## 8. Voice (added 2026-10-14 — voice-app patterns)
- [ ] **Push-to-talk is the default**; open mic is a choice in ☰. Nobody's room is broadcast by surprise.
- [ ] Every seat shows its **mic state** (off / speaking) right on the seat; anyone can be muted for me only.
- [ ] Your own floor (an answer to an accusation) and last words open the mic by themselves.
- [ ] Text for everything said by voice that matters (claims are on the table as marks; captions when on).

---

## DOs
- **Do test on `preview` first**, then promote. `main` is the live site.
- **Do decide on 1,000 games**, and say the ± with every number.
- **Do measure people, not just bots**: run `learn-from-games` after every play session.
- **Do one thing at a time, finish it, show it** (a video or a screenshot) before starting the next.
- **Do keep voice king**: music at −26 LUFS, ducking ~18 dB, the speech band (1–4 kHz) carved out.
- **Do write every rule decision into the rulebook and the handover** the same day.
- **Do keep secrets out of git** (`.env.local`, `analysis/logs/` — real names and chats).

## DON'Ts
- **Don't change a rule on one noisy number** (5p read 44% and 56% on two runs of 250).
- **Don't push to `main` while the cloud tests are red.**
- **Don't ship a feature you haven't watched work** on the screen (the films sat frozen until a screen check).
- **Don't let bots see secrets**: they decide from their own view only (viewFor), and tests check it.
- **Don't add new rules during release week.** Balance fixes only, each measured.
- **Don't run heavy sims on the laptop**: it ran out of memory twice. Use the cloud (`sims.yml`).
- **Don't hide what the table needs**: every piece of real information reaches the centre (the Bhukamp passes
      didn't, until 2026-10-13).
