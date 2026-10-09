import { describe, expect, it } from "vitest";
import type { ChatMessage } from "@/server/store";
import type { Beat } from "./beats";
import { CAPTION_PREFIX, FeedLog, QUICK_PREFIX, type FeedItem } from "./feed";
import { reactionText } from "./reactions";

const names = ["Asha", "Raju 🤖", "Vik"];
const beat = (n: number, type: string, title: string, extra: Partial<Beat> = {}): Beat =>
  ({ n, type, title, tone: "neutral", big: false, hold: 0, private: false, ...extra });
const msg = (id: number, seat: number, text: string): ChatMessage => ({ id, seat, name: names[seat], text, at: "", phase: "turn" });

describe("the centre feed", () => {
  it("shows plays, claims, talk, captions, quick lines, reactions and every ballot — in arrival order", () => {
    const log = new FeedLog();
    log.ingest([], [], null, names); // the table opens
    log.ingest([beat(0, "kundli", "Vik read a Kundli", { actor: 2 })], [], null, names);
    log.ingest([beat(1, "claim", 'Raju: "Asha is a thief."', { actor: 1, target: 0, tone: "lethal" })], [msg(1, 1, "Asha is lying")], null, names);
    log.ingest([], [msg(2, 0, CAPTION_PREFIX + "no way"), msg(3, 2, QUICK_PREFIX + "Not me!"), msg(4, 0, reactionText("🍅", 1))], null, names);
    log.ingest([], [], { 0: 1 }, names);
    log.ingest([], [], { 0: 2, 2: null }, names);
    const t = log.items.map((i) => [i.kind, i.text]);
    expect(t).toEqual([
      ["event", "Vik read a Kundli"],
      ["claim", 'Raju: "Asha is a thief."'],
      ["talk", "Asha is lying"],
      ["caption", "no way"],
      ["talk", "Not me!"],
      ["react", "Asha threw 🍅 at Raju"],
      ["vote", "Asha voted for Raju"],
      ["vote", "Asha switched to Vik"],
      ["vote", "Vik skips the vote"],
    ]);
  });

  it("never repeats an item, and keeps your private beats marked as yours", () => {
    const log = new FeedLog();
    const b = [beat(0, "kundli_private", "You read Raju: Lootera", { private: true })];
    log.ingest(b, [msg(1, 1, "hi")], null, names);
    log.ingest(b, [msg(1, 1, "hi")], null, names);
    expect(log.items).toHaveLength(2);
    expect(log.items[0].mine).toBe(true);
  });

  it("hands only NEW items to the read-aloud — never the history a phone finds when it opens the table", () => {
    const log = new FeedLog();
    const heard: FeedItem[] = [];
    log.listen((it) => heard.push(it));
    log.ingest([beat(0, "pass", "Vik plays nothing")], [msg(1, 1, "old line")], null, names);
    expect(heard).toHaveLength(0);
    expect(log.items.every((i) => i.old)).toBe(true);
    log.ingest([], [msg(2, 1, "new line")], null, names);
    expect(heard.map((i) => i.text)).toEqual(["new line"]);
    expect(heard[0].old).toBe(false);
  });

  it("drops system traffic it cannot show (whispers come as game events instead)", () => {
    const log = new FeedLog();
    log.ingest([], [msg(1, 0, "\u0001w|2|t|secret")], null, names);
    expect(log.items).toHaveLength(0);
  });

  it("holds talk until the stage has shown the play it answers", () => {
    const log = new FeedLog();
    log.ingest([], [], null, names);
    // the bot's reply arrives while this phone is still showing an older beat
    log.ingest([], [msg(1, 1, "Asha, why Faisla?")], null, names, false);
    expect(log.items).toHaveLength(0);
    log.ingest([beat(0, "faisla", "Asha calls a Faisla")], [msg(1, 1, "Asha, why Faisla?")], null, names, true);
    expect(log.items.map((i) => i.text)).toEqual(["Asha calls a Faisla", "Asha, why Faisla?"]);
  });
});
