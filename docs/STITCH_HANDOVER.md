# Tunga vs Thieves — game & screen requirements

## 1. The game

**Genre:** social deduction / hidden-role game with **pass-the-pile card drafting** and a **keep-away**
objective, plus **set collection** (pairs), **bluffing**, **voting** and **player elimination**.

**Theme:** a village in India during the Tunga festival. Two sacred Serpent Stones — the **Bhadra Stone** and the
**Tunga Stone** — travel through the village in a procession, passed from household to household. A gang of
thieves has slipped in among the villagers to steal one. Nobody knows who the thieves are — not even the thieves
themselves know each other.

**Players:** 4–30, each on their own phone, usually talking on a voice/phone call or sitting together.
**Length:** 10–15 minutes at 5–8 players; 2–3 rounds.

### Mechanics

| Mechanic | How it works in Tunga |
|---|---|
| **Hidden roles / hidden teams** | Each player secretly gets a role card: villager (Tunga) or thief. Roles: Kisaan, Sarpanch, Baba, Teacher, Police (villagers); Chor, Lootera, Mastikhor (thieves); more in packs. Roles have no powers — the name matters only for Kundli and Teer Kaman. |
| **Keep-away** | Villagers win only if **both** Stones end in villager hands; thieves need **any one** Stone in a thief's hand (or left in the pile). Everyone tries to keep the Stones away from the other team without revealing which team they're on. |
| **Pass-the-pile drafting** | A 3-card Procession Pile goes round the table. On your turn you pick it up (now 5 cards), keep what you want and pass 3 face down to the next player. Stones travel this way (they can be passed, never discarded). |
| **Set collection (pairs)** | Two identical action cards = a playable pair. Playing one costs a turn's tempo: pass 3 other cards first, then use the power, then draw 2. One pair per turn. |
| **Power OR Stone tension** | Holding a Stone limits what you can pass; if a pair can only be played by passing a Stone away, you choose: the power or the Stone. The table notices who stops playing. |
| **Information powers** | Kundli (secretly see one role), Talashi (one hand shown to everyone). |
| **Take-that** | Hera Pheri (steal 2 face down), Bhukamp (everyone else passes 1 left, 1 right). |
| **Elimination** | Teer Kaman (name two roles; right = they're out, wrong = you lose a vote for good), Faisla vote, mandatory vote. Mayajaal revives. |
| **Bluffing & table talk** | Kundli readers may tell the truth, lie or stay silent; claims are free. Faisla opens a timed open-floor debate before voting. |
| **Votes as a resource** | Each player starts with 1 vote; a missed Teer Kaman loses it forever; a dying villager can gift one. |
| **Dying powers** | Eliminated villager: give 1 vote. Eliminated thief: one last two-role shot. A thief eliminated holding Dal Badal swaps two living players' roles. The eliminated player hands all their cards (Stones too) to anyone, then stays silent. |

### Cards

| Card | Printed subtitle | Effect |
|---|---|---|
| Faisla | Voting begins | Timed open floor, then everyone votes; most votes is out, tie = nobody |
| Talashi | See action cards | Target's whole hand shown to everyone (never the role) |
| Kundli | See role | You secretly see target's role |
| Hera Pheri | Swap action cards | Steal 2 face down from a player; they draw 2 |
| Bhukamp | Split your cards | Draw 2; every other living player passes 1 card left, 1 right |
| Mayajaal | Turn back time | Revive any eliminated player (they draw 2) |
| Teer Kaman | Eliminate a player | One player + two role names: hit = out, miss = lose a vote forever |
| Dal Badal | Villagers pass · Thieves hold | Never played; matters when a thief is eliminated holding it |
| Bhadra Stone, Tunga Stone | Villagers need both · Thieves need one | The objective; same back as action cards |

### How a game ends
- All thieves out → villagers win at once; all villagers out → thieves win at once.
- After the last round: a last open-floor debate, a mandatory vote, then every hand and role is revealed and the
  Stones decide it.

### Information rules (who sees what)
- **Public to everyone, as it happens:** who is acting, every pair played and its target, every pass (as "3 cards
  face down to X" — never the cards), Talashi hands, Teer Kaman roles named and the result, votes cast (who has
  voted, not for whom, until the reveal), eliminations with role and hand, Dal Badal swaps (who, not the new roles),
  hand sizes and votes of every player.
- **Private to one player:** their role, their hand, what they picked up, a Kundli result (reader only), what Hera
  Pheri took (thief and victim only), what Bhukamp passed to them, their new role after Dal Badal.
- **At the end:** everything is revealed to everyone, including every private moment in order.

### Core experience requirements
- **Spotlight:** at every moment it must be obvious to every player who the table is waiting for and what they are
  deciding. Every action is shown to all phones at the same moment and held long enough to be read before the game
  moves on.
- **Phone-first, portrait, one hand**; usable while on a phone call (no reliance on sound; vibration on your turn;
  works after switching apps and coming back).
- **Timers** on every decision; the server moves the game on when time runs out (safe default: pass / abstain).
- A player who goes quiet twice is covered by a stand-in that only plays safe, until they come back.
- **Bots** can fill seats so one person can learn or play alone.
- No undo once anything is revealed; risky actions get a short cancellable confirm.
- Languages: English with Hinglish table talk ("Mere paas Stone hai", "Jhooth!").

---

## 2. Screens

Flow: **Home → Lobby → Role reveal → Table (turns, plays, debates, votes, eliminations) × rounds → Last debate →
Mandatory vote → Game end → Story.** Overlays available during play: Talk, Story, Rules, Player detail, Role peek.

### 2.1 Entry
| Screen | Purpose | Shows | Actions | States |
|---|---|---|---|---|
| Home | Start or join a table | Game name, one-line premise | Enter name; Create a table; enter 5-letter code + Join; How to play; Learn with bots | Name missing; joining; error (no such table / already started / full) |
| Join from invite | Arrive from a shared link | The table code already filled | Enter name; Join; or create own | Same errors |
| How to play | Teach in under a minute | Teams & Stones; a turn; the cards; talk & vote | Next / Skip / Start a table | — |

### 2.2 Lobby
| Screen | Purpose | Shows | Actions | States |
|---|---|---|---|---|
| Lobby (host) | Gather players | Table code; join link; players (host, bots); count of villagers/thieves/rounds for this size | Invite via WhatsApp; copy link; add/remove bots; settings; Deal the roles (needs 4+) | Under 4; full (30) |
| Lobby (guest) | Wait to start | Same, no controls | Leave | Waiting for host |
| Table settings (host) | Tune the table | Turn, debate and vote timers; streamer mode; bots fill empty seats | Change, save | — |

### 2.3 Start
| Screen | Purpose | Shows | Actions |
|---|---|---|---|
| Role reveal | Learn your secret | Your role, your team, your goal, your starting 2 cards | Reveal privately; continue |

### 2.4 The table (always on during play)
Every table screen shows: round x/y; whose turn / what's happening, worded for the viewer; time left; every
player with hand size, votes, alive/out (and revealed role if out), who the table is waiting for; the Procession
Pile (count face down); the last play; your hand; your role kept hidden until you ask for it.

| Screen | Purpose | Shows | Actions |
|---|---|---|---|
| Waiting | Someone else is deciding | Who and what they must decide | Peek role; Talk; Story; Rules; tap a player for detail |
| Your move — choose | Your turn starts | Your 5 cards, which pairs are playable | Play a pair; or play nothing and pass 3 |
| Pass 3 | Draft the pile on | Your cards, who receives them | Pick exactly 3 (a Stone only if needed); back; pass |
| Play a pair | Use a power | The pair, cards to pass, target choice, role choice (Teer Kaman) | Pick 3 to pass; pick target (living / eliminated for Mayajaal / with cards for Hera Pheri); name two roles; play |
| Confirm | Last chance before a play/vote/shot goes out | What will happen, seconds left | Cancel; send now |
| You're out | Eliminated, silent spectator | The table as normal | Watch; no talk |
| Stand-in active | You timed out twice | Notice that a stand-in plays safe | "I'm back" |
| Reconnecting | Connection dropped | Notice | — |

### 2.5 Moments everyone watches (shown to all phones at once, then the game continues)
| Moment | Everyone sees | Only some see |
|---|---|---|
| Plays nothing | X passes 3 face down to Y | — |
| Kundli | X reads Y's role | Reader: Y's role and team; option to claim it to the table or keep quiet |
| Talashi | Y's whole hand face up | — |
| Hera Pheri | X steals 2 from Y face down; Y draws 2 | X and Y: which cards moved |
| Bhukamp | X splits the table; everyone else passes left & right | Each giver/receiver: the cards they gave/got |
| Mayajaal | X revives Y | — |
| Teer Kaman | X shoots Y, naming two roles; HIT or MISS; on miss X loses a vote | — |
| Faisla called | X opens the floor | — |
| Vote result | Each voter's choice revealed, tally, who is out or tie | — |
| Elimination | Y's role, team and hand revealed | — |
| Dal Badal | Two players swapped roles | The two: their new role |
| Dying gift / last shot / hand-off | What the eliminated player did | — |
| Stand-in / back | X has gone quiet / X is back | — |
| Time ran out | Defaults were played | — |

### 2.6 Bhukamp (when you must give)
Shows your hand and your left/right neighbours. Action: choose 1 card for each side; pass.

### 2.7 Faisla & votes
| Screen | Purpose | Shows | Actions |
|---|---|---|---|
| Open floor (debate) | Talk before voting | Time left (scales with living players, 45–90s); who is ready; recent table talk | Quick claims; type a claim; Ready to vote; host: +30s once |
| Ballot | Vote | Living players | Vote for one; abstain |
| Waiting for votes | Others still voting | Who has voted (not whom) | — |
| Result | See the outcome | Every vote, tally, who is out / tie | — |

### 2.8 Elimination (the eliminated player decides)
| Screen | Who | Actions |
|---|---|---|
| Dal Badal swap | Eliminated thief holding Dal Badal | Pick two living players to swap roles |
| Give a vote | Eliminated villager | Pick a player or nobody |
| Last shot | Eliminated thief | Pick a player + two roles, or no shot |
| Hand over cards | Any eliminated player with cards | Pick who receives all cards (Stones included) |

### 2.9 The end
| Screen | Purpose | Shows | Actions |
|---|---|---|---|
| Last debate + mandatory vote | Final chance | As 2.7 | As 2.7 |
| Game end | Who won and why | Winning team, reason, every player's role and team, where the Stones ended | Play again (same table); share; get the box; host: download log |
| The whole story | Relive it | Every event in order, private moments now unlocked | Filter |
| Share | Brag | Your role, outcome, a line about your game | Share to WhatsApp / stories |
| Get the box | Sell the physical game | The physical edition | Buy |

### 2.10 Overlays during play
| Overlay | Shows | Actions |
|---|---|---|
| Role peek | Your role, team, votes left — only while held | Hold / release |
| Talk | Table messages | Quick claims; type; (silent if eliminated) |
| Story | Public events so far + your private ones | Scroll |
| Rules | All cards, how a turn works, how to win | — |
| Player detail | A player's hand size, votes, what's publicly known about them, their votes so far | — |

### 2.11 System states
Table not found · game already started (watch / start your own) · table full · not at this table on this phone
(join) · connection lost.

### 2.12 Later
Quick Play with strangers (matchmaking, bots fill seats after ~20s) · streamer mode (table code hidden, delayed
spectator view with all roles).

---

## 3. Sample content
Players: Riya (host), Bilal, Chitra, Dev, Esha, Raju (bot). Table code K7MPQ. 6 players · 4 villagers · 2 thieves ·
2 rounds. Roles in play: Kisaan, Sarpanch, Baba, Teacher, Chor, Lootera.
