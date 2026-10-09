import { describe, expect, it } from "vitest";
import { createTutorial, getState } from "./game";

describe("learn by playing", () => {
  it("starts at once: you, 5 bots, a villager in the first seat to act, holding a Kundli pair", async () => {
    const t = await createTutorial("Asha");
    const s = await getState(t.code, t.token, 0);
    expect(s.status).toBe("playing");
    const v = s.view!;
    expect(v.tutorial).toBe(true);
    expect(v.players).toHaveLength(6);
    expect(v.me.side).toBe("V");
    expect(v.me.hand.filter((c) => c === "KUNDLI").length).toBeGreaterThanOrEqual(2);
    expect(v.decision?.kind).toBe("turn");
    expect(s.deadline! - s.serverNow).toBeGreaterThan(150_000); // a long first clock
  });
});
