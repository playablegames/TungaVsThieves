"""import_logs.py - read exported Tunga game logs (the host's "Download game log") and report what the simulation
could not measure. Usage:  python analysis/import_logs.py path/to/logs/  (or one or more .json files)

The number that matters most is the UNPLAYED-PAIR RATE: of the turns where a player could have played a pair,
how often did they play nothing? The sim says an ACTIVE table (~0% skipped) is a ~50% game for the village and a
PATIENT table (~40%+ skipped) is a ~30-40% game, decided by the deal. Compare with
OneDrive/Desktop/Tunga/Tunga_vs_Thieves_BALANCE_REPORT_v15.md.
"""
import json, sys, collections
from pathlib import Path

STONES = {"STONE_1", "STONE_2"}


def load(paths):
    files = []
    for p in map(Path, paths):
        files += sorted(p.glob("*.json")) if p.is_dir() else [p]
    for f in files:
        with open(f, encoding="utf-8") as fh:
            yield f.name, json.load(fh)


def analyse(log):
    st = log["state"]
    ev = st["events"]
    by = collections.defaultdict(list)
    for e in ev:
        by[e["type"]].append(e)
    deal = by["analytics_deal"][0]["data"]
    side = {p["seat"]: p["side"] for p in deal["players"]}
    # Stones at the deal: in hands, or in the first pile (seat 1 picks it up)
    dealt_v = sum(1 for p in deal["players"] for c in p["hand"] if c in STONES and p["side"] == "V")
    dealt_v += sum(1 for c in deal["pile"] if c in STONES and side[0] == "V")
    turns = [e["data"] for e in by["analytics_turn"]]
    could = [t for t in turns if t["playable"]]
    skipped = [t for t in could if t["played"] is None]
    over = by["over"][-1]["data"] if by["over"] else {}
    tk = [e["data"] for e in by["teer_kaman"]]
    shots = [e["data"] for e in by["last_shot"] if e["data"].get("target") is not None]
    return {
        "n": len(deal["players"]),
        "split": "%d/%d" % (sum(1 for s in side.values() if s == "V"), sum(1 for s in side.values() if s == "T")),
        "rounds": deal["rounds"],
        "winner": over.get("winner"),
        "reason": over.get("reason"),
        "dealt_to_villagers": dealt_v,
        "turns": len(turns),
        "could_play": len(could),
        "skipped": len(skipped),
        "skipped_V": sum(1 for t in skipped if t["side"] == "V"),
        "could_V": sum(1 for t in could if t["side"] == "V"),
        "skipped_T": sum(1 for t in skipped if t["side"] == "T"),
        "could_T": sum(1 for t in could if t["side"] == "T"),
        "played": collections.Counter(t["played"] for t in turns if t["played"]),
        "tk_shots": len(tk), "tk_hits": sum(1 for t in tk if t["hit"]),
        "last_shots": len(shots), "last_hits": sum(1 for t in shots if t["hit"]),
        "kundli": len(by["kundli"]),
        "dal_badal": len(by["dal_badal"]),
        "gifts": sum(1 for e in by["gift"] if e["data"].get("target") is not None),
        "claims": len(by["claim"]),  # (2026-10-09) Mayajaal is gone; claims out loud are the new thing to watch
        "eliminated": len(by["eliminated"]),
        "timeouts": len(by["timeout"]),
        "chat": len(log.get("messages", [])),
    }


def pct(a, b):
    return "%3.0f%%" % (100 * a / b) if b else "  - "


def main(paths):
    games = [(name, analyse(log)) for name, log in load(paths)]
    if not games:
        print("no logs found"); return
    print("%-22s %4s %6s %3s %8s %6s %10s %8s %6s %5s" % ("game", "n", "split", "rd", "winner", "deal", "skipped", "TK hit", "elims", "chat"))
    for name, g in games:
        print("%-22s %4d %6s %3d %8s %4d/2 %10s %8s %6d %5d" % (
            name[:22], g["n"], g["split"], g["rounds"], {"V": "TUNGA", "T": "THIEVES"}.get(g["winner"], "?"),
            g["dealt_to_villagers"], "%d/%d" % (g["skipped"], g["could_play"]), "%d/%d" % (g["tk_hits"], g["tk_shots"]),
            g["eliminated"], g["chat"]))
    tot = collections.Counter()
    for _, g in games:
        for k, v in g.items():
            if isinstance(v, int): tot[k] += v
    wins = collections.Counter(g["winner"] for _, g in games)
    print("\nACROSS %d GAMES" % len(games))
    print("  Tunga won %d, Thieves won %d  (village %s)" % (wins["V"], wins["T"], pct(wins["V"], len(games))))
    print("  UNPLAYED PAIRS: %s of playable turns skipped (villagers %s, thieves %s)" % (
        pct(tot["skipped"], tot["could_play"]), pct(tot["skipped_V"], tot["could_V"]), pct(tot["skipped_T"], tot["could_T"])))
    s = tot["skipped"] / tot["could_play"] if tot["could_play"] else 0
    print("    -> %s" % ("ACTIVE table (sim: ~50% village)" if s < 0.15 else
                         "PATIENT table (sim: ~30-40% village, the deal decides)" if s > 0.35 else
                         "in between active and patient"))
    by_deal = collections.defaultdict(lambda: [0, 0])
    for _, g in games:
        by_deal[g["dealt_to_villagers"]][0] += 1
        by_deal[g["dealt_to_villagers"]][1] += g["winner"] == "V"
    print("  DEAL: village win when villagers were dealt 0/1/2 Stones: " +
          "  ".join("%d -> %s (%d games)" % (k, pct(v[1], v[0]), v[0]) for k, v in sorted(by_deal.items())))
    print("  Teer Kaman: %d shots, %d hits (%s) · last shots: %d, %d hits · Kundli reads: %d" % (
        tot["tk_shots"], tot["tk_hits"], pct(tot["tk_hits"], tot["tk_shots"]), tot["last_shots"], tot["last_hits"], tot["kundli"]))
    print("  Dal Badal used %d · dying vote gifts %d · claims out loud %d · timeouts %d · chat messages %d" % (
        tot["dal_badal"], tot["gifts"], tot["claims"], tot["timeouts"], tot["chat"]))
    played = collections.Counter()
    for _, g in games: played.update(g["played"])
    print("  Pairs played: " + ", ".join("%s %d" % (k, v) for k, v in played.most_common()))


if __name__ == "__main__":
    main(sys.argv[1:] or ["."])
