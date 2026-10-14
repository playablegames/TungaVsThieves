# How the bots think — the bot rulebook

Approved by the designer on 2026-10-14. The bots must behave like real players reasoning about the table. Nothing in
here exists to balance the game. If the game is unbalanced, the fix is a game rule (for example, the thief count),
never a change to the bots. The code is `src/server/reason.ts`, and every rule below is written there in the same
words. Every vote and claim a bot makes is saved in the game log as a `bot_why` event (only the server sees it).

## 1. What a bot knows

**Facts** (certain):
- my own role
- my Kundli reads, in both directions
- the role of a player I put out
- a role shown to everyone (a Teer Kaman hit, the thief's own card in a Dal Badal)
- a Teer Kaman miss means that player is none of the roles it named
- cards I saw: Talashi, Hera Pheri, Bhukamp, a hand-off, my own hand

A Dal Badal wipes every fact about the seats in its shuffle.

**Words** (could be lies): every claim, and every whisper to me.

## 2. Judging a word

| Situation | Conclusion |
|---|---|
| a word contradicts a fact I hold (wrong side, a role I know is someone else's, a ruled-out role) | the speaker **lied** → I ignore their words from then on, and I suspect them |
| a **role** named for me that's wrong ("you're Chor"), and I'm a villager | the speaker **lied** (+3 against them) |
| a plain suspicion of me, and I'm a villager | a wrong guess, not a lie: +1, like any accusation (real games: bots were hunting honest villagers) |
| a Kundli was done between A and B, and A never spoke about B afterwards | **silence** is suspicious (+1 against A) — sharp only |
| every thief is accounted for | everyone else is a villager — sharp only |
| anything else | one voice = one point: "X is a thief" +1 against X, "X is a villager" −1 |

A Kundli claim and a plain suspicion weigh the same: one point each.

**What the table saw also counts** (designer 2026-10-14, "bots are stupid": games 9KXLW, QJW9J and Z76KH):
- a **known thief's** words point the other way: whom it accuses −1 (likely a villager), whom it vouches for +1
- the dying vote of a known thief goes to a partner: +2 on whoever got it (a thief bot gives its dying vote only to a partner it knows, otherwise
  to nobody)
- a Teer Kaman that hit a thief was a villager's shot: −2 on the shooter (+2 if it hit a villager)
- a speaker proven right about someone is more believable: −1 (average and sharp)
- an accused player's answer "X is lying" counts as an accusation back

## 3. Talking (in each debate, one new thing)

**Villager:** says only what it saw: who it put out ("X was Police"), who it read ("X is Chor", thieves first), what
it found in a search ("X has a Stone" / "no Stone"), and who took its Stone with Hera Pheri. If
someone accused it, it answers by naming the accuser. Otherwise, if one player clearly has the strongest case (2+
points, alone at the top), it says "I suspect X" without naming a role. Otherwise it says nothing.

**Thief:** lies, but only lies that fit the facts on the table (after a search it says "no Stone" either way — it wants
the Stone for itself; a casual thief just says what it saw):
- a villager it read → "X is <a thief role>", never a role ruled out for X
- a partner it read → "X is <a village role>" (cover)
- whoever accused it → accuse them back (naming a role only if there was a Kundli between them)
- otherwise → join the table's top suspect (someone at least one other player has accused)

A casual thief sometimes says nothing where a skilled one would lie.

**Roles named are only ever the roles dealt in this game.** A thief's lie picks, in printed order, a role that is not
ruled out for that player, not known to be someone else's, and not already pinned on someone else. A role is never
added to a claim the speaker didn't make: a human's spoken "X is a thief" stays a plain accusation.

## 4. Voting

**Villager:**
- a thief it knows, always
- never a villager it knows
- otherwise the strongest case
- in a Faisla, no case (nothing above 0) means it doesn't vote. A **tie** with a case goes to the ballot the table is
  gathering on, then the most accused (real games: bots sat out half the Faisla ballots, so the thieves' votes decided)
- in the mandatory vote the Stones decide. A Stone holder I have any case against (1+) comes first: if they're a thief,
  the Stone comes to the village. One I have nothing against is left alone, because their Stone would go to the thieves.
- a mandatory-vote tie goes to the ballot the table is already gathering on, then to the most accused (a split vote
  puts nobody out)

**Thief:**
- never a partner it knows
- otherwise the table's case, plus its own accusers (+2) and any villager it knows (+1)
- in the mandatory vote, also a villager it believes holds a Stone (+3: those Stones come to the thieves)
- with no case against anyone in a Faisla, it doesn't vote (a ballot from nowhere is a tell)

## 5. Where the Stones are

A bot remembers the last place it saw each Stone: its own hand, a Talashi, a Hera Pheri it made or suffered, a
Bhukamp pass, a hand-off, or a Stone claim from someone it doesn't take for a liar. A sighting holds until a newer one
replaces it.

**The quiet Stone tell (sharp only, designer 2026-10-14):** a player who passed on each of their last 3 turns without
playing a pair is probably sitting on a Stone. When a sharp bot has no idea where a Stone is, it puts it with them. This
says nothing about their side (villagers sit on Stones too). A search that shows their hand without a Stone clears it.

## 6. Your turn

(2026-10-14, PLAY THEN PASS) A pair resolves first, then you pass 3 and draw back to 2. After a pair you hold exactly 3,
so any pair still sends a held Stone on — **except Hera Pheri**: the steal leaves 5 cards, so the Stone can stay. A bot
holding a Stone plays Hera Pheri when it can (on its top suspect / a likely Stone holder).

1. **Holding a Stone** (a pair sends it to the next player): a **thief** plays only if the next player is a partner it
   knows. A **villager** never sends it to someone it suspects (score above 0) or knows is a thief. To someone it has
   nothing against, it plays only a pair that does something (from the table below), not a filler. Real games
   (2026-10-14): villagers holding a Stone still played their pair 46% of the time, against bots' 5%, so the Stones froze.
2. **Thief with Dal Badal:** use it when exposed — 2+ points against me, or someone named my TRUE role (I know it's
   true, so the table may believe it) — with those accusers. In the last round, if no
   Stone has reached a thief, shuffle onto the players I believe hold the Stones (sharp only).
3. **Otherwise, the first pair that has a purpose:**

| Pair | Villager plays it when… / aims at | Thief plays it when… / aims at |
|---|---|---|
| Teer Kaman | a thief I know (my read), naming its role; or an **open-Kundli accusation** — a role named by someone the table saw do a Kundli with them, from a speaker I don't doubt, **not contested** (nobody else has called the speaker a thief, and the target hasn't accused the speaker back or said "you're lying"). The designer's table plays it this way; or a strong case (3+ points, alone at the top) where a role was named for them | a villager I read who I believe holds a Stone, in the last round |
| Faisla | I know a thief, or someone has a case (2+, alone at the top) | the table already has a case against a villager, or a villager I know holds a Stone (the caller takes the cards) |
| Hera Pheri | a suspect (1+) I believe holds a Stone | someone I believe holds a Stone |
| Talashi | the suspect most likely to hold a Stone; otherwise the top suspect | where I think a Stone is; otherwise the most trusted player |
| Kundli | the living player I haven't read with the most talk about them | never (it shows my own role back). A casual thief plays it anyway |
| Bhukamp | a neighbour I suspect holds a Stone | a neighbour I believe is a villager holding a Stone |

4. **No pair with a clear purpose: play the pair you hold anyway** (designer 2026-10-14, from 39 human games: without
   a Stone people played their pair about 88% of the time). The reasoning picks the target, not whether to play:
   - **Villager:** Hera Pheri on my top suspect, Faisla (let the table talk), or Bhukamp. **Never a blind Teer Kaman.**
     A miss puts me out, so I hold that pair until there's a case.
   - **Thief:** blends in with Hera Pheri on the table's suspect, Faisla or Bhukamp. Never Kundli (it shows my role
     back) and never Teer Kaman (naming village roles out loud gives me away) without a reason from the table above.
5. **No pair at all:** pass. Keep a Stone first, then Dal Badal, then the cards that could make a pair.

**Teer Kaman roles** (2026-10-14: any role may be named): the role I know or the table named for them (never a
ruled-out one), then the remaining roles of the side I believe they're on.

**A thief's Teer Kaman** (designer 2026-10-14, "a thief can try to eliminate another thief"):
- **bus a partner** — a partner I know whom 2+ players have called a thief goes out anyway; my arrow takes their cards
  and makes me look like a villager (average and sharp thieves)
- in the last round, a villager whose role I know — my read, **or what they told me** — holding a Stone

## 7. Bhukamp (everyone passes 1 left, 1 right)

A Stone goes to the neighbour I trust more. For a villager that's the lower score; for a thief it's a partner it
knows, otherwise the neighbour the table suspects more. Dal Badal follows the same rule. Other cards go either way.

## 8. Skill = how much a person notices

| | catches lies against its own facts | reads silence after a Kundli | counts thieves | quiet Stone tell | thief lies |
|---|---|---|---|---|---|
| casual | no (believes what it hears) | no | no | no | sometimes stays silent |
| average | yes | no | no | no | always |
| sharp | yes | yes | yes | yes | always |

No random noise anywhere — bots decide by logic; wrong calls come from too little information. The only coin flip is
between options that are truly equal (designer 2026-10-14: "depend on code only, make it logical").

## 9. Sharing information (designer 2026-10-14: "share info like real players")

**Whom a bot trusts:** players it knows are on its side (its Kundli reads, either way). A villager also trusts players
with something in their favour (vouched for, or proven right: a score below 0). That's at most 2 friends. With nobody
like that, the secret stays with the bot. A thief trusts only partners it knows.

**Privately, to those friends** (the table sees "A → B, privately", the friend sees the words):
- every Kundli read (a villager's truth, a thief's lie)
- where a Stone went when it left the bot's hand: "I passed the Tunga Stone to Raju", "In the Bhukamp I gave the Bhadra
  Stone to Adi", "My cards went with Munna"

**Publicly:** a villager whose Stone went to someone it suspects (or knows is a thief) tells the whole table
("Raju has the Tunga Stone"), because the village needs that for the vote.

**Answering:** a bot called a thief answers at once by naming the accuser. A villager who read the accuser and saw a
thief names the role; otherwise it says "X is lying".

**Listening:** bots read claims in public chat lines and in private lines sent to them. A friend's private word about a
Stone puts that Stone where the friend said, unless the friend is a known liar or a known thief.

## 10. Bot talk, lies, handshakes and double agents (designer 2026-10-14)

*"Without information transfer how will you solve a hidden role card game?" · "Villagers will lie to protect their role,
but within their own village roles — and thieves too." · "Bots should behave logically — no patching."*

**A THIEF PLAYS EXACTLY LIKE A VILLAGER.** Same talk, same votes, same plays. Its partners — known (a Kundli read) or
**believed** (after a handshake) — stand where a villager's known villagers stand; it knows no "thief" to hunt, so it
hunts whoever the evidence points at. Its own goals only: keep the Stone, Dal Badal, bus an exposed partner, shoot a
Stone-holding villager whose role it knows. (A sharp thief still won't play Kundli: it shows its own role back.)

**What bots hear** (plain word rules, `hear.ts listen()`): a question ("what are u", "kaun ho", "your role?"), a word
about yourself ("I'm Teacher", "main Kisaan hoon"), "Stone with Adi", and the old claims ("X is Chor").

**Role talk — everyone may lie, always inside the village roles.** Each bot has ONE cover story, kept all game: the
role it told before, else a role it knows belongs to a player who's out, else one nobody has claimed (a coin flip among
equals).

| asked by… | Open Book / Hothead | Detective | Quiet One |
|---|---|---|---|
| someone it's sure of (a read villager; a thief's partner) | truth | truth | truth |
| a player it knows is a thief | cover | cover | cover |
| anyone else | truth | truth if nothing against them, else cover | cover |

"Truth" for a thief is its cover story. Tell a bot your role and it tells you its own. Each round (and each debate) every
bot tells one player it doesn't suspect its role and asks theirs. Pressed (called a thief by 2, or at once for the Open
Book and the Hothead), a bot claims a role out loud. A villager whose role someone claims within its hearing says so at
once: "X is lying — I'm Kisaan".

**The handshake.** A player is OUTED when someone the table saw do a Kundli with them names them with a thief role.
Then every thief bot privately tells them "I'm also <my real thief role>. Where's the Stone?"
- the outed player is a thief: it believes them (the role fits) and tells what it knows about the Stones — partners
  from then on. A sharp thief trusts only a messenger who never accused or voted against it.
- the outed player is a villager: the messenger just gave itself away — it says so out loud ("Y told me they're Chor")

**Double agents** — only a SHARP bot can, and its personality decides whether it wants to: the Quiet One always, the
Detective only about its top suspect, the Hothead and the Open Book never.
- a double-agent villager poses as a thief to an outed player ("I'm also Lootera…") and, approached by a thief, plays
  along ("I'm Lootera, no Stone here — where's yours?") to learn where the Stone is
- a double-agent thief who doesn't trust a messenger feeds it a false Stone location

**The tie moment.** A vote tied as the clock ends — Faisla or mandatory — is when secrets are spent:
- a villager a tied player confided in reads it out: "X told me they're Chor" (and where X said the Stone was)
- anyone a double agent posed to can read the pose back at them — the poser is punished as a thief
- a sharp thief whose partner is in the tie frames the other tied player ("Y told me they're Lootera") — Y knows it's a
  lie and says so
- then every bot re-weighs and breaks the tie. A revealed Stone is fine: voting out a villager sends their Stone to the
  thieves, and a thief's to the village — the question is whom to trust.

**Weighing words** (facts still beat words):
- a word naming a role ("I read X: Chor", "X told me they're Lootera") 1.5; a plain "I suspect X" 1
- someone claims MY role → a certain lie; a claim against my facts → a lie (average, sharp)
- a counterclaim (two claim one role): one of them lies — the LATER claimer +1, the earlier +0.5 (bot games: the later
  claimer lied 64% of the time)
- "Y is Teacher" (A) and "I'm Teacher" (Z) → A or Z lies, +1 each
- "I'm also <thief role>" said to a villager +3 (a sharp villager may be posing, so not a fact)
- someone who told me their role privately, uncontested −0.5
