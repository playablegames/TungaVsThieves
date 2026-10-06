# Tunga vs Thieves — Online

Play Tunga vs Thieves v15 with 4–30 people, each on their own phone, from one link. Built for **playtesting**:
every game is recorded so the simulation's predictions can be checked against real play.
Rules source of truth: `OneDrive/Desktop/Tunga/Tunga_vs_Thieves_Rulebook_v15.md`.

## Run it locally

```bash
npm install
npm run dev            # http://localhost:3000
```

Without Supabase settings the server keeps games **in memory** and phones poll once a second — fine for trying
it out. To be several players on one computer, open several **tabs**: each tab remembers its own seat.
Phones on the same Wi-Fi can join via your computer's IP, e.g. `http://192.168.1.20:3000`.

## How it works

- `src/engine/` — the rules as a pure reducer (`start`, `apply`, `waitingOn`), the timeout defaults
  (`decisions.ts`) and per-player redaction (`view.ts`). No I/O; seeded, so every game replays exactly.
- `src/server/` — rooms (`game.ts`) and storage (`store.ts`: memory or Supabase). The server runs every move;
  a phone only ever receives **its own** redacted view, fetched with a secret per-player token.
- `src/app/api/games/**` — `POST /api/games` create · `/[code]/join` · `/start` · `/act` · `/tick` ·
  `GET /state` · `POST /chat` · `GET /log` (host, after the game).
- Live updates: with Supabase, the server broadcasts a content-free `{version}` ping on channel `game:<code>`
  and phones refetch. Clients never read the database (RLS on, no policies).
- Timers: 60 s per turn, 45 s for votes / Batwara / eliminations. When the clock runs out any phone nudges
  `/tick`; the server plays a harmless default (pass, abstain, …) only if the deadline has really passed.

## Tests

```bash
npm test                                   # rules (26), room service (6), fuzz
FUZZ_GAMES=400 npm run fuzz                # 10,800 random games, every count 4–30, invariants + redaction
npx tsx scripts/e2e.mts                    # a 5-player game over real HTTP against a running dev server (port 3210)
```

Fuzz invariants (ported from `tunga-playtest/suite_v15.py`): exactly 2 Stones, never in the deck/discard or the
pile after seat 1's pickup, 66 cards, thief count and role set constant through Dal Badal, dead players hold
nothing, no negative votes, the game always ends, no view carries another player's secret.

## Playtest analysis

After a game the host taps **Download game log**. Put the files in a folder and run:

```bash
python analysis/import_logs.py path/to/logs/
```

It reports wins by side, the deal, Teer Kaman / last-shot hits, Kundli reads, Dal Badal, gifts, revives — and the
**unplayed-pair rate** (how often a player could play a pair and didn't), which tells you whether your table is
"active" (sim: ~50% village) or "patient" (sim: ~30–40%, decided by the deal).

## Deploy (Supabase + Vercel)

1. Create a **new** Supabase project (not Bale's). Run `supabase/migrations/0001_games.sql` in the SQL editor.
2. On Vercel, import this repo and set:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Realtime pings to phones)
   - `SUPABASE_SERVICE_ROLE_KEY` (server only — never expose)
3. Deploy, open the URL on a phone, create a room, share the code.

## Voice on mobile data (free TURN relay)

Table voice goes phone to phone. On mobile data, carrier NAT often blocks that, so a TURN relay carries
the audio. Vercel/Hostinger web hosting can't relay (no long-lived UDP), so we use free managed relays.
Phones fetch the relay list from `/api/games/[code]/turn` (seated players only). Set any mix; phones get
all of them and use whichever connects.

**ExpressTURN — 1,000 GB/month free, no card (main relay).** Sign up at expressturn.com, copy the server,
username and password from the dashboard, then set on the host (Vercel → Settings → Environment Variables):
`TURN_URLS` = e.g. `turn:relay1.expressturn.com:3478,turn:relay1.expressturn.com:443?transport=tcp`
(use the hostname your dashboard shows), `TURN_USERNAME`, `TURN_CREDENTIAL`. Redeploy.

**metered.ca Open Relay — 20 GB/month free, no card (backup).** Sign up, create an app (gives
`<app>.metered.live`), copy the API key: `METERED_TURN_APP` = `<app>`, `METERED_TURN_API_KEY`.

Cloudflare Realtime TURN (1,000 GB free, needs a card): `CLOUDFLARE_TURN_KEY_ID` + `CLOUDFLARE_TURN_API_TOKEN`.
Your own coturn on a VPS: use the `TURN_*` variables.

Check: `curl https://<your-app>/api/games/<CODE>/turn -H "x-player-token: <token>"` returns `"relay": true`.
With nothing set, voice uses STUN only (works on shared Wi-Fi and most home networks).
