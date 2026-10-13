# SUPERSEDED (2026-10-13) — see docs/HANDOVER_2026-10-13.md: the online game now uses the printed box art, not hooded figures.

# Tunga vs Thieves — DESIGN.md · "Lantern Haveli"

*Design system for the online game. 2026-10-12. Supersedes the unwritten "Shadows of the Haveli" notes the code refers
to. Dark always. One idea per screen. Nothing on screen that the player doesn't need right now.*

---

## 1. Where this comes from

### Ian O'Toole's principles (graphic designer of Red Scare, Lisboa, The Gallerist)
From his interviews ([More Games Please](https://www.moregamesplease.com/art-in-boardgames/2018/7/1/ian-otoole-art-in-board-games-40),
[Greenhook Games](https://www.greenhookgames.com/ian-o-toole/)):

| His words | What it means for Tunga |
|---|---|
| "Clarity, first and foremost" — design is "an exercise in ergonomics and information conveyance" | Every screen answers one question: *whose turn, what happened, what can I do.* Mood never beats readability |
| Graphic design "trumps illustration" | Seats, cards and buttons must read at a glance on a 360 px phone before any art is added |
| "Is there a clearer way to present the information?" — he replaced counters with tracks and tables | Information lives in **structures** (seat chips, seat history, My secrets, the Stone path), not in long text |
| He builds "boxes and circles with no artwork" first, then prototypes for ergonomics | Layout first, art last. A screen that fails as grey boxes fails with art too |
| Commit to one direction instead of offering style options | One look, everywhere. No per-screen styles |
| Balance colour **late**, with everything in place; harmony vs readability is the hard part | Tokens below are a start; tune contrast with real game screens side by side |
| Art "rooted in the time period" (Lisboa) | Rooted in a **village haveli at night during the Tunga festival**: lanterns, carved wood, brass, cloth |
| Mismatched art and gameplay is "jarring" | Hidden-role game = hidden faces. Nothing on screen may hint at a role |

### The reference games (designer's picks, 2026-10-12)
| Game | What we take | What we leave |
|---|---|---|
| **Mindnight** (No Moon) | Dark, minimal, **one glowing accent** on black; players as figures round one table; atmosphere carried by sound | Pixel art; neon/cyberpunk |
| **Red Scare** (O'Toole) | Bold **few-colour** print look; "information only you hold" made visible | Glasses gimmick |
| **Suspects: Mystery Mansion** | **A figure on every seat** instead of a coloured circle; a results screen that feels like a reward | Bright cartoon palette |
| **diffiCULT** | Dark medieval mood, lantern-lit night | 3D / first-person |
| **The Grip of Madness** | Horror mood: dread, smoke, the unknown | Shooter UI |

---

## 2. The idea in one line

**A dark courtyard at night. Each player is a hooded figure lit by their own lantern. The only bright things are
lanterns, Stones and the cards in your hand.**

---

## 3. Colour — three colours and one light

Few colours, like a two-ink print. Everything else is a tint of these.

| Token | Hex (start) | Use |
|---|---|---|
| `--night` | `#0f0906` | Background. Near-black warm brown — never pure black, never blue |
| `--night-2` | `#1f1007` | Raised surfaces: tray, sheets, centre panel (existing `--color-ember`) |
| `--cream` | `#f5e6ca` | Text, card stock (existing `--color-stock`) |
| `--ember` | `#e0a24a` | **The one light**: whose turn, your lantern, primary buttons, focus (existing `--color-brass`) |
| `--blood` | `#c0392b` | Thieves, lethal plays (Teer Kaman, out), errors (existing `--color-crimson`) |

Special, used only where the meaning is the colour itself:
| Token | Hex | Only for |
|---|---|---|
| `--tunga` | `#e8b923` | The Tunga Stone |
| `--bhadra` | `#3b6fd8` | The Bhadra Stone |
| `--yours` | `#f3c66b` | **Something only you know** (your Kundli read 🔮 in the Teer Kaman list, your seat ring). Gold = private truth |
| `--ash` | `#6b625a` | Out players, disabled, smoke |

Rules
- **One glowing thing at a time** (Mindnight). If two things glow, one is wrong.
- Jade green (`--color-jade`) and indigo (`--color-paper-2`) are **retired** from the table: green no longer means
  "selected" — selection is the ember ring. Keep green only for "you won" and the voice "speaking" ring.
- Seat colours (the 12 `SEAT_COLOURS`) stay, but **muted ~30%** so they tint the lantern and name, never shout.
- Contrast: body text ≥ 4.5:1 on `--night`; chips and icons ≥ 3:1. Check `--ember` on `--night-2` and `--ash` text.
- Never colour alone: every colour meaning also has a word or icon (colour-blind players).

---

## 4. Type — two faces

| Role | Face | Where |
|---|---|---|
| **Display** | Playfair Display (roman only, 700–900) | Screen titles, beats ("Raju is out"), role names, the end screen |
| **Text** | Plus Jakarta Sans (500–800) | Everything you tap or read fast: names, buttons, the centre line, card text |

- **Cinzel is retired** — three faces is one too many (O'Toole: commit to one direction). Small-caps labels
  ("ROUND 2 OF 3", section heads) use Plus Jakarta 700, uppercase, letter-spacing 0.18em.
- Sizes on a 360 px phone: centre line 18–20 px · names 14–15 px · body 15–16 px · never below 11 px.
- Lines: short plain English, 4–5 words in the centre. No Hinglish flavour text.

---

## 5. The table

### Seats — a hooded figure with a lantern
```
      (  )        ← lantern glow: seat colour, low
     /▓▓▓\        ← hooded silhouette — THE SAME SHAPE FOR EVERYONE (roles stay hidden)
     \___/
    [ Raju ]      ← name tag: cream on --night-2
    🫵1 🔮Chor    ← what the table said (chips), muted
```
| State | Treatment |
|---|---|
| Waiting | Figure in shadow, lantern low (seat colour at 25%) |
| **Their turn** | Lantern flares `--ember`, soft glow; a small ▲ under the seat. The only glow on the table |
| You | Same figure, name tag ringed `--yours` |
| Speaking (voice) | Lantern flickers (opacity pulse, 120 ms) — no green ring |
| Out | Figure turns to `--ash` smoke, lantern out, ✕; name stays readable |
| Target / Played | Small tag above the head: `TARGET` in `--blood`, `PLAYED` in `--ember` |
| Away (stand-in) | 💤 on the lantern |

- Hand count: a tiny cream badge at the lantern's foot. Votes > 1: small ember dots under the name.
- Hit area ≥ 48 px even when the figure is drawn smaller (top-of-ring seats especially).

### The centre — one line
A dark panel (`--night-2`, hairline `--ember` at 30%). Top: whose turn ("Raju's turn") in small caps. Below: **one**
update, 4–5 words, in the display face. Tap → everything that happened.

### The tray — your hand
- Cards are the brightest objects on screen: **cream stock, one ink colour, bold icon** (Red Scare's print look).
  The card's own colour appears only as the icon disc.
- On your turn the tray rises; the heading "Your move" is not shown (the centre already says "Your turn").
- Buttons: pill, ≥ 48 px, one line. Primary = `--ember` fill, dark text. Secondary = outline. Lethal = `--blood`.
- Nothing is sent on a tap — every move ends with one button ("Pass these 3", "Shoot").

---

## 6. Big moments (beats)

Full-screen, dark, one sentence, tap to continue. Each has **one** visual:

| Beat | Visual |
|---|---|
| Faisla | Every lantern turns toward the centre |
| Teer Kaman hit / miss | An arrow streak in `--blood`; the out figure turns to smoke |
| Bhukamp ↺ | The lanterns slide one seat anticlockwise |
| Dal Badal | Three hoods blur together, then separate |
| Last words | The figure alone in a pool of light, the mic count, **Done — skip** |
| Game over | Hoods drop one by one round the ring: each role shown (gold villager / red thief) |

Under reduced motion: crossfades only.

---

## 7. Out players — silent spectators

Out players see everything (every role, every hand) and may not speak. Their screen says so plainly. Their panel
("You're out — you see everything now") uses the same cream-on-night rows; roles as small gold/red tags; Stones as 💎.
Their lantern is out on everyone's table.

---

## 8. End screen

Three parts, one idea each, top to bottom:
1. **Who won** — one big line, why in one small line.
2. **The ring, hoods down** — every role revealed round the same table.
3. **How the Stones moved** — each Stone's journey as a chain of names (gold villager / red thief), 👁 where someone
   saw it. Then Share · Play again.

---

## 9. Sound (Mindnight: atmosphere is carried by sound)

Low tanpura drone and night crickets; tension pulse during votes; one sound per big moment. One switch: All /
Voices only / Off. Music sleeps when the app is in the background.

---

## 10. Do / Don't

| Do | Don't |
|---|---|
| One glowing thing at a time | Two glows, gradients everywhere, neon |
| Same hooded figure for every player | Any art that could hint at a role |
| Cream cards with one ink | Full-colour card faces competing with the table |
| Two typefaces | A third face "just for this" |
| Structures you can open (seat history, My secrets) | Long text on the table |
| Plain English, 4–5 words | Hinglish flavour text, jokes in system lines |
| Test at 360 × 800 with 12 seats | Designing only at 390 px |
| Grey boxes first, art last (O'Toole) | Polishing art on a layout that doesn't read |

---

## 11. Build order

1. **Tokens** — add `--night`, `--yours`, `--ash`; retire jade/indigo from the table; drop Cinzel.
2. **Seats** — the hooded figure + lantern states (one SVG, tinted per seat).
3. **Cards** — cream stock, one ink, icon disc.
4. **Beats** — one visual each, as in §6.
5. **End screen** — hoods dropping, then the Stone path.
6. **Contrast pass** — all screens side by side at 360 px, tune colour last (O'Toole).
