"""THE BOTS' VOICES (designer 2026-10-13: "realistic bot voices"; per CHARACTER, never per secret role — a voice that
followed the role would tell the table who the thieves are).

Kokoro (Apache-2.0 model and voices — free to ship) speaks Hindi in four voices: hm_omega, hm_psi (men), hf_alpha,
hf_beta (women). Every bot name and every ending a claim can have is rendered once per voice; the game joins them at
play time ("राजू" + "लुटेरा है।"). Each bot keeps one voice and its own slight pitch/pace (src/lib/botvoice.ts), so
Babu Rao always sounds like Babu Rao. A human player is never named — the bot says "यह" (this one) and the seat lights.
Clips are trimmed and levelled for speech (about -20 dBFS RMS), mono 24 kHz MP3.

  python scripts/voices/make_voices.py <dir with kokoro-v1.0.onnx + voices-v1.0.bin>
  (model files: github.com/thewh1teagle/kokoro-onnx releases "model-files-v1.0")
"""
import json, os, sys
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

MODEL = sys.argv[1] if len(sys.argv) > 1 else "."
OUT = os.path.join(os.path.dirname(__file__), "..", "..", "public", "audio", "voices")
VOICES = ["hm_omega", "hm_psi", "hf_alpha", "hf_beta"]

NAMES = {  # every bot name in src/server/game.ts BOT_NAMES
    "Raju": "राजू", "Shyam": "श्याम", "Babu Rao": "बाबूराव", "Pappu": "पप्पू", "Munna": "मुन्ना", "Circuit": "सर्किट",
    "Chintu": "चिंटू", "Bunty": "बंटी", "Golu": "गोलू", "Tinku": "टिंकू", "Gabbar": "गब्बर", "Basanti": "बसंती",
    "Mogambo": "मोगैम्बो", "Jhumru": "झुमरू", "Lallan": "ललन", "Kallu": "कल्लू", "Bholu": "भोलू", "Chhotu": "छोटू",
    "Guddu": "गुड्डू", "Sonu": "सोनू", "Monu": "मोनू", "Titu": "टीटू", "Bablu": "बबलू", "Pinky": "पिंकी", "Dolly": "डॉली",
    "Rinku": "रिंकू", "Mintu": "मिंटू", "Sweety": "स्वीटी", "Lucky": "लकी", "Happy": "हैप्पी",
}
ROLES = {  # every role in src/engine/setup.ts (villagers, then thieves)
    "Kisaan": "किसान", "Sarpanch": "सरपंच", "Baba": "बाबा", "Teacher": "टीचर", "Police": "पुलिस", "Doctor": "डॉक्टर",
    "NRI": "एनआरआई", "Deewani": "दीवानी", "Dafliwala": "डफलीवाला", "Lohar": "लोहार", "Sonar": "सुनार", "Mali": "माली",
    "Kumhar": "कुम्हार", "Pujari": "पुजारी", "Guruji": "गुरुजी", "Darzi": "दर्ज़ी", "Nai": "नाई", "Halwai": "हलवाई",
    "Dhobi": "धोबी", "Chaiwala": "चायवाला", "Mochi": "मोची", "Bunkar": "बुनकर", "Gwala": "ग्वाला", "Pehelwan": "पहलवान",
    "Chor": "चोर", "Lootera": "लुटेरा", "Gunda": "गुंडा", "Daku": "डाकू",
    "Taskar": "तस्कर", "Uchakka": "उचक्का", "Mastikhor": "मस्तीखोर", "Jebkatra": "जेबकतरा", "Thug": "ठग", "Dakait": "डकैत",
    "Lafanga": "लफंगा", "Chhota Chor": "छोटा चोर",
}
slug = lambda s: s.lower().replace(" ", "_")

def phrases():
    out = {"this": "यह,"}
    for en, hi in NAMES.items(): out[f"n_{slug(en)}"] = f"{hi},"
    for en, hi in ROLES.items():
        out[f"is_{slug(en)}"] = f"{hi} है।"
        out[f"was_{slug(en)}"] = f"{hi} था।"
        out[f"wasf_{slug(en)}"] = f"{hi} थी।"
    out.update({"stone_has": "के पास स्टोन है।", "stone_no": "के पास स्टोन नहीं है।",
                "me_has": "मेरे पास स्टोन है।", "me_no": "मेरे पास स्टोन नहीं है।"})
    return out

def tidy(x, sr):
    a = np.abs(x)
    on = np.where(a > 0.01)[0]
    if len(on): x = x[max(0, on[0] - int(0.02 * sr)): on[-1] + int(0.06 * sr)]
    rms = np.sqrt(np.mean(x ** 2)) or 1e-6
    x = x * (10 ** (-20 / 20) / rms)  # about -20 dBFS RMS: a voice on the table
    return np.clip(x, -0.98, 0.98)

if __name__ == "__main__":
    k = Kokoro(os.path.join(MODEL, "kokoro-v1.0.onnx"), os.path.join(MODEL, "voices-v1.0.bin"))
    ph = phrases()
    for v in VOICES:
        os.makedirs(os.path.join(OUT, v), exist_ok=True)
        for key, text in ph.items():
            path = os.path.join(OUT, v, f"{key}.mp3")
            if os.path.exists(path): continue
            s, sr = k.create(text, voice=v, speed=1.0, lang="hi")
            s = tidy(np.asarray(s, dtype=np.float32), sr)
            sf.write(path, s, sr, format="MP3")
        print(v, len(ph), "clips")
    json.dump({"voices": VOICES, "names": {en: f"n_{slug(en)}" for en in NAMES}, "roles": {en: slug(en) for en in ROLES},
               "female": ["Basanti", "Pinky", "Dolly", "Sweety"]},
              open(os.path.join(OUT, "manifest.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("manifest written")
