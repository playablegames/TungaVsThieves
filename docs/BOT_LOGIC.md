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
| "X is a thief" about me, and I'm a villager | the speaker is lying (+3 against them) |
| a Kundli was done between A and B, and A never spoke about B afterwards | **silence** is suspicious (+1 against A) — sharp only |
| every thief is accounted for | everyone else is a villager — sharp only |
| anything else | one voice = one point: "X is a thief" +1 against X, "X is a villager" −1 |

A Kundli claim and a plain suspicion weigh the same: one point each.

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
- in a Faisla, no case (nothing above 0) or a tie at the top means it doesn't vote
- in the mandatory vote, someone it believes holds a Stone goes out only on a strong case (2+), because their Stones
  would go to the thieves
- a mandatory-vote tie goes to the most accused

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

Playing a pair means passing **all** your other cards. If you hold a Stone, playing any pair sends the Stone on.

1. **Holding a Stone:** play a pair only if the next player is someone I know is on my side. Otherwise pass and keep
   the Stone.
2. **Thief with Dal Badal:** use it when exposed — 2+ points against me, or someone named my TRUE role (I know it's
   true, so the table may believe it) — with those accusers. In the last round, if no
   Stone has reached a thief, shuffle onto the players I believe hold the Stones (sharp only).
3. **Otherwise, the first pair that has a purpose:**

| Pair | Villager plays it when… / aims at | Thief plays it when… / aims at |
|---|---|---|
| Teer Kaman | a thief I know (my read), naming its role; or an **open-Kundli accusation** — a role named by someone the table saw do a Kundli with them, from a speaker I don't doubt, not answered by the target accusing them back (the designer's table plays it this way); or a strong case (3+ points, alone at the top) where a role was named for them | a villager I read who I believe holds a Stone, in the last round |
| Faisla | I know a thief, or someone has a case (2+, alone at the top) | the table already has a case against a villager, or a villager I know holds a Stone (the caller takes the cards) |
| Hera Pheri | a suspect (1+) I believe holds a Stone | someone I believe holds a Stone |
| Talashi | the suspect most likely to hold a Stone; otherwise the top suspect | where I think a Stone is; otherwise the most trusted player |
| Kundli | the living player I haven't read with the most talk about them | never (it shows my own role back). A casual thief plays it anyway |
| Bhukamp | a neighbour I suspect holds a Stone | a neighbour I believe is a villager holding a Stone |

4. **Nothing with a purpose:** pass. Keep a Stone first, then Dal Badal, then the cards that could make a pair.

**Teer Kaman roles:** the role I know or the role the table named for them (never a ruled-out one), then the other
team's remaining roles in printed order.

## 7. Bhukamp (everyone passes 1 left, 1 right)

A Stone goes to the neighbour I trust more. For a villager that's the lower score; for a thief it's a partner it
knows, otherwise the neighbour the table suspects more. Dal Badal follows the same rule. Other cards go either way.

## 8. Skill = how much a person notices

| | catches lies against its own facts | reads silence after a Kundli | counts thieves | quiet Stone tell | thief lies |
|---|---|---|---|---|---|
| casual | no (believes what it hears) | no | no | no | sometimes stays silent |
| average | yes | no | no | no | always |
| sharp | yes | yes | yes | yes | always |

No random noise anywhere. The only coin flip is between options that are truly equal.
