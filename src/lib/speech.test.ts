import { beforeEach, describe, expect, it, vi } from "vitest";

// a fake phone voice: records what is spoken; `end()` finishes the current line, cancel() interrupts it
type U = { text: string; onend?: () => void; onerror?: () => void };
let spoken: U[] = [];
let playing: U | null = null;
const end = () => { const u = playing; playing = null; u?.onend?.(); };
Object.assign(globalThis, {
  window: globalThis,
  SpeechSynthesisUtterance: class { onend?: () => void; onerror?: () => void; constructor(public text: string) {} },
  speechSynthesis: {
    getVoices: () => [],
    speak: (u: U) => { spoken.push(u); playing = u; },
    cancel: () => { const u = playing; playing = null; u?.onerror?.(); },
  },
});

describe("the read-aloud queue next to voice chat", () => {
  let m: typeof import("./speech");
  let talking = false;
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    spoken = []; playing = null; talking = false;
    m = await import("./speech");
    m.setQuiet(() => !talking);
  });

  it("an update speaks at once, even while someone is talking — the moment its line lands", () => {
    talking = true;
    m.say({ text: "फ़ैसला!", lang: "hi-IN", urgent: true });
    expect(spoken.map((u) => u.text)).toEqual(["फ़ैसला!"]);
  });

  it("talk waits for a gap, then speaks; after 8 s of talking it is forced through like an update", () => {
    talking = true;
    m.say({ text: "Raju: Asha is lying", lang: "en-IN" });
    vi.advanceTimersByTime(2000);
    expect(spoken).toHaveLength(0);
    talking = false;
    vi.advanceTimersByTime(300);
    expect(spoken.map((u) => u.text)).toEqual(["Raju: Asha is lying"]);

    end(); talking = true;
    m.say({ text: "Meera: I trust Raju", lang: "en-IN" });
    vi.advanceTimersByTime(7500);
    expect(spoken).toHaveLength(1);
    vi.advanceTimersByTime(800);
    expect(spoken.map((u) => u.text)).toEqual(["Raju: Asha is lying", "Meera: I trust Raju"]);
    expect(m.readingState()).toBe("update"); // forced: voices duck, mic held
  });

  it("an update cuts off a talk line mid-sentence; push-to-talk cuts talk but never an update", () => {
    m.say({ text: "Raju: long accusation", lang: "en-IN" });
    m.say({ text: "निशाना चूक गया!", lang: "hi-IN", urgent: true });
    expect(spoken.map((u) => u.text)).toEqual(["Raju: long accusation", "निशाना चूक गया!"]);
    m.cut(); // talk button pressed during the update
    expect(playing?.text).toBe("निशाना चूक गया!");
  });

  it("reports what it is reading, so the game can hold the mic and duck the table", () => {
    const seen: (string | null)[] = [];
    m.say({ text: "update", lang: "hi-IN", urgent: true });
    seen.push(readingNow(m));
    end();
    m.say({ text: "talk", lang: "en-IN" });
    seen.push(readingNow(m));
    end();
    seen.push(readingNow(m));
    expect(seen).toEqual(["update", "talk", null]);
  });
});

const readingNow = (m: typeof import("./speech")) => m.readingState();
