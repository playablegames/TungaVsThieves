# Tunga vs Thieves online — illustration brief

*For the illustrator. 2026-10-12. Read DESIGN.md ("Lantern Haveli") first — this is the shopping list.*

## The look in one line
A haveli courtyard at night during the Tunga festival. Every player is the same hooded figure lit by their own
lantern. Dark, warm, mysterious — the only bright things are lanterns, the two Stones and the cards in your hand.
References: Mindnight (dark, one glowing accent), Red Scare / Ian O'Toole (bold, few colours, print feel), Suspects:
Mystery Mansion (a character on every seat). NOT bright or cartoon-cute.

## Hard rules
1. **Nothing may hint at a role.** Every player figure is identical; only the lantern colour differs (set in code).
2. **Readable small.** The game is played on a 360 px-wide phone. A card tile is ~66 px wide, a seat ~56 px. If it
   doesn't read at that size, it doesn't work.
3. **No text baked into art** (names, card titles, numbers) — the code writes all text.
4. **Palette:** near-black warm brown `#0f0906`, cream `#f5e6ca`, lantern amber `#e0a24a`, blood red `#c0392b`.
   Tunga Stone gold `#e8b923`, Bhadra Stone blue `#3b6fd8`. Anything else only as a tint of these.
5. **Files light** (players in India on capped data): first-load art under ~1.5 MB total.

## Formats
| Kind | Format | Size |
|---|---|---|
| Flat art (figure, icons, logo, card frames) | **SVG**, layers named, no embedded bitmaps, outlines not live text | — |
| Painted art (backgrounds, big moments) | **WebP** (PNG if needed), sRGB, transparent where noted | 2× the display size |
| Source | Figma / AI / PSD with layers | — |
Naming: `kebab-case`, e.g. `figure-cloak.svg`, `card-icon-kundli.svg`, `beat-teer-kaman-hit.webp`.

---

## 1. The hooded figure — FIRST, most important
One front-facing hooded, cloaked villager (head and shoulders to mid-chest), standing, face hidden in shadow,
two faint eyes. Delivered as **separate SVG layers** so the code can tint and animate:

| Layer | Notes |
|---|---|
| `figure-cloak.svg` | The cloak/hood shape **in flat white** — code tints it with the seat colour |
| `figure-shade.svg` | Shading/folds in black at partial opacity, sits on the cloak |
| `figure-face.svg` | The dark face opening |
| `figure-eyes.svg` | Two eyes (code makes them glow on the player's turn) |
| `figure-lantern.svg` | A small hand-held lantern (or a glow source) at chest/hand height |
| `figure-out.svg` | The "out" version: the same figure dissolving into smoke, greyscale |

Square artboard 128 × 128, figure centred, ~10% margin. Must read at 40 px.

## 2. Cards
| Asset | Count | Format |
|---|---|---|
| Card action **icons** — Faisla, Talashi, Kundli, Hera Pheri, Bhukamp, Teer Kaman, Dal Badal | 7 | SVG, 64 × 64, single colour + one accent; must read at 28 px |
| Stone icons — Tunga, Bhadra | 2 | SVG, gem shapes in their colours |
| Card **frame** — cream stock, one-ink border ornament, empty centre (code puts icon + name in) | 1 | SVG, 5:7 ratio |
| Card **back** | 1 | SVG or WebP 500 × 700 |
| Optional: full card illustrations for a zoomed card view | 9 | WebP 750 × 1050 |

## 3. The table
| Asset | Format | Size |
|---|---|---|
| `table-bg.webp` — the courtyard at night seen from above-ish: floor, a ring of lamp light, dark edges. **The centre and the ring must be calm** (seats and text sit on top) | WebP | 1080 × 2340 (portrait), ≤ 250 KB |
| `table-ring.svg` — optional decorative ring/rangoli the seats sit on | SVG | — |

## 4. Big moments (full-screen "beats") — one image each
Faisla called · Teer Kaman hit · Teer Kaman miss · Bhukamp ↺ (hands moving round the ring) · Dal Badal (three hoods
shuffling) · Kundli (two figures seeing each other) · Talashi (a search) · Hera Pheri (a theft) · Last words (one
figure alone in light) · **Tunga wins** · **Thieves win**.
WebP 1080 × 1080, dark edges so they blend into the night, ≤ 120 KB each. Layered sources welcome (we may animate
a glow or a slide).

## 5. Home screen and identity
| Asset | Format | Size |
|---|---|---|
| Logo / wordmark "Tunga vs Thieves" | SVG | — |
| Home key art (the courtyard, figures, the two Stones) | WebP | 1080 × 1920, ≤ 300 KB |
| App icon | PNG 512 × 512 + a **maskable** version (art inside the centre 80%) | — |
| Share preview image (WhatsApp/Instagram link card) | JPG/WebP | 1200 × 630, ≤ 300 KB |

## 6. UI icons (single colour, `currentColor`, 24 × 24 grid)
Menu · History · Mic · Mic off · Speed (1×/2×) · Share · Alerts bell · Back · Close · Seat marks: villager, thief,
role, Stone (to replace 🌾 🫵 🔮 💎) · Private marks: ✓ ! ? · Reactions (3, to replace 🍅 😂 🔥).

## 7. Buttons — style reference only
One frame showing the three button looks — primary (lantern amber), secondary (outline), lethal (red) — chunky,
tactile, readable on dark. I build them in code from the reference; no files needed unless they have texture.

---

## Order of delivery
1. Hooded figure (section 1) — I can wire it in the same day
2. Card icons + frame + back (2)
3. Table background (3)
4. Big moments (4)
5. Logo, home art, app icon, share image (5)
6. UI icons (6) and the button reference (7)

Send work-in-progress early (a rough figure at 40 px on a dark phone screen) — readability small is the hard part.
