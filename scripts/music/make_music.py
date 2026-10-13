"""THE SCORE OF TUNGA (designer 2026-10-13: "super fun background music with python" — then: "this is not Tunga
music, it needs to be music from the village Tunga").

Tunga is a Malnad village in Karnataka where the Tunga and the Bhadra meet (the Tungabhadra, at Koodli); the Serpent
Stones are its nagakallu, the snake stones under the sacred trees, and the festival is the Naga's. So the score is that
country's sound, all synthesised here (no samples, no licences): the NADASWARAM (temple double reed, with gamaka
ornaments), THAVIL, the big DOLLU (Dollu Kunitha), the Yakshagana CHANDE, TAALA cymbals, the PUNGI (the snake-charmer's
pipe — the Serpent's voice), a SHRUTI drone, temple BELLS and the KOMBU horn. No chords — a drone, as temple music has.
  village.mp3  — the turns: Raag Mohanam (bright, five notes, the folk raga), 120 BPM, thavil + taala, nadaswaram hook,
                 pungi answers, chande and kombu on the last phrase (16 bars, a seamless loop)
  faisla.mp3   — a Faisla / the last vote: Raag Punnagavarali (the snake raga) on the pungi over a heartbeat thavil and
                 the drone, 92 BPM (8 bars, a seamless loop)
  win.mp3      — the village wins: kombu, a dollu roll, the nadaswaram climbing Mohanam, temple bells
  lose.mp3     — the thieves win: the pungi falling through Punnagavarali, the dollu, one bell

A VOICE GAME'S SCORE (research 2026-10-13, designer: "it's too loud for a voice talking game"): talk is the game, so the
music is a BED, not a feature —
  · LOUDNESS: loops mastered to -26 LUFS (the first cut was -10.7, louder than a pop record); the app plays them lower
    still and ducks them ~18 dB the moment anyone talks (music.ts)
  · THE SPEECH BAND: consonants live at 1-4 kHz (intelligibility peaks near 2 kHz) — carved out of the music by ~10 dB,
    and the cymbals' hiss tamed above it, so a voice always sits in a clear hole
  · SPARSE: drone + a soft groove most of the time; the melody comes in for a phrase and leaves; the kombu and the
    chande rolls are kept for the stings
  python scripts/music/make_music.py          (needs numpy, scipy, soundfile, pyloudnorm)
"""
import os
import numpy as np
import soundfile as sf
import pyloudnorm as pyln
from scipy.signal import butter, sosfilt

SR = 44100
rng = np.random.default_rng(7)
D4 = 293.66
OUT = os.path.join(os.path.dirname(__file__), "..", "..", "public", "audio", "music")


def hz(semi, base=D4):
    return base * 2 ** (semi / 12)


def env(n, a=0.01, r=0.1, sustain=1.0):
    """attack / release envelope over n samples"""
    e = np.full(n, sustain)
    na, nr = max(1, int(a * SR)), max(1, int(r * SR))
    e[:na] = np.linspace(0, sustain, na)
    if nr < n:
        e[-nr:] *= np.linspace(1, 0, nr)
    return e


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], btype="band", fs=SR, output="sos"), x)


def lp(x, f, order=2):
    return sosfilt(butter(order, f, btype="low", fs=SR, output="sos"), x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, btype="high", fs=SR, output="sos"), x)


def phase_of(freq):
    return 2 * np.pi * np.cumsum(freq) / SR


def glide_in(n, f, prev, secs):
    g = np.ones(n)
    if prev:
        k = min(n, int(secs * SR))
        g[:k] = np.linspace(prev / f, 1, k)
    return g


# ------------------------------------------------------------------ Malnad instruments
def nadaswaram(f, dur, prev=None):
    """the temple double reed: louder and darker than a shehnai (a big conical bore), with the Carnatic kampita
    gamaka — a held note shakes up toward the next, about six times a second"""
    n = int(dur * SR)
    t = np.arange(n) / SR
    shake = 1 + (0.035 if dur > 0.5 else 0) * 0.5 * (1 - np.cos(2 * np.pi * 6.2 * t)) * np.clip((t - 0.18) / 0.15, 0, 1)
    ph = phase_of(f * shake * glide_in(n, f, prev, 0.05))
    x = sum(np.sin(k * ph) / k ** 0.45 for k in range(1, 16) if f * k < 9500)
    x = bp(x, 500, 1200, 1) * 1.8 + bp(x, 1800, 3000, 1) * 1.0 + x * 0.1
    return x * env(n, 0.025, min(0.07, dur / 3))


def pungi(f, dur, prev=None):
    """the snake-charmer's pipe: two reeds in a gourd — nasal, buzzing, with quick trills on long notes"""
    n = int(dur * SR)
    t = np.arange(n) / SR
    trill = 1 + 0.03 * (np.sin(2 * np.pi * 11 * t) > 0.6) * np.clip((t - 0.25) / 0.1, 0, 1) if dur > 0.6 else 1
    ph = phase_of(f * trill * glide_in(n, f, prev, 0.03))
    x = sum(np.sin(k * ph) / k for k in range(1, 20, 2) if f * k < 9000)  # odd harmonics: a square-ish reed
    x = bp(x, 1200, 2200, 1) * 2.0 + lp(x, 900) * 0.6
    return x * env(n, 0.012, min(0.05, dur / 3))


def pungi_drone(dur, semi=-12):
    n = int(dur * SR)
    t = np.arange(n) / SR
    ph = 2 * np.pi * hz(semi) * t
    x = sum(np.sin(k * ph) / k for k in range(1, 16, 2))
    return (bp(x, 900, 1800, 1) * 1.2 + lp(x, 600) * 0.6) * env(n, 0.2, 0.2)


def shruti(dur, semis=(-12, -5, 0)):
    """the drone box: Sa, Pa, upper Sa — reedy, breathing slowly"""
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for s_ in semis:
        for det in (0.999, 1.001):
            ph = 2 * np.pi * hz(s_) * det * t
            x += sum(np.sin(k * ph) / k for k in (1, 2, 3, 5))
    x *= 1 + 0.06 * np.sin(2 * np.pi * 0.25 * t)
    return lp(x, 1800) * env(n, 0.3, 0.3) / len(semis)


def thavil_valam(level=1.0):
    """the thavil's right head, struck with thimbled fingers: a hard crack and a short ring"""
    n = int(0.18 * SR)
    t = np.arange(n) / SR
    crack = bp(rng.standard_normal(n), 2500, 7000) * np.exp(-t / 0.006)
    ring = np.sin(2 * np.pi * 410 * t) * np.exp(-t / 0.05) * 0.6 + np.sin(2 * np.pi * 760 * t) * np.exp(-t / 0.03) * 0.3
    return (crack + ring) * level * 0.8


def thavil_thoppi(level=1.0):
    """the left head, a stick: a deep boom with a slap"""
    n = int(0.5 * SR)
    t = np.arange(n) / SR
    f = 62 + 45 * np.exp(-t / 0.03)
    return (np.sin(phase_of(f)) * np.exp(-t / 0.2) + bp(rng.standard_normal(n), 300, 1200) * np.exp(-t / 0.01) * 0.4) * level


def dollu(level=1.0):
    """the Dollu Kunitha drum: huge and low"""
    n = int(0.9 * SR)
    t = np.arange(n) / SR
    f = 42 + 50 * np.exp(-t / 0.05)
    return (np.sin(phase_of(f)) * np.exp(-t / 0.35) + lp(rng.standard_normal(n), 400) * np.exp(-t / 0.02) * 0.5) * level


def chande(level=1.0):
    """the Yakshagana chande: a tight, cutting stick stroke"""
    n = int(0.15 * SR)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * 290 * t) * np.exp(-t / 0.04) + bp(rng.standard_normal(n), 1500, 5000) * np.exp(-t / 0.015) * 0.7
    return x * level * 0.7


def taala(level=1.0, open_=True):
    """small hand cymbals: "ching" (open) or "chak" (closed)"""
    n = int((0.6 if open_ else 0.08) * SR)
    t = np.arange(n) / SR
    x = sum(np.sin(2 * np.pi * f * t + rng.uniform(0, 6)) for f in (3150, 4420, 5870, 7310, 8890))
    return x / 5 * np.exp(-t / (0.22 if open_ else 0.02)) * level * 0.35


def kombu(dur=1.6):
    """the long brass horn of the procession: a rising, opening blast"""
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = hz(-12) * (0.94 + 0.06 * np.clip(t / 0.25, 0, 1))
    ph = phase_of(f)
    x = sum(np.sin(k * ph) / k for k in range(1, 18) if hz(-12) * k < 9000)
    y = np.zeros(n)
    for i in range(0, n, 2048):  # the bell of the horn opens: a brightening filter, block by block
        y[i:i + 2048] = lp(x[i:i + 2048], 400 + 2600 * min(1.0, i / SR / 0.4), 1)
    return y * env(n, 0.06, 0.4)


def bell(f, level=1.0):
    """a temple bell"""
    n = int(2.4 * SR)
    t = np.arange(n) / SR
    x = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t / d) for a, r, d in ((1, 1, 1.1), (0.6, 2.76, 0.5), (0.4, 5.4, 0.25), (0.2, 8.9, 0.12)))
    return x * level * 0.3


# ------------------------------------------------------------------ the mix
class Track:
    def __init__(self, seconds):
        self.n = int(seconds * SR)
        self.buf = np.zeros((self.n + 6 * SR, 2))

    def add(self, x, at, gain=1.0, pan=0.0):
        i = int(at * SR)
        if i >= self.buf.shape[0]:
            return
        x = x[: self.buf.shape[0] - i]
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        self.buf[i:i + len(x), 0] += x * gain * l
        self.buf[i:i + len(x), 1] += x * gain * r

    def loop(self):
        """fold the tail past the loop point back onto the start: a seamless loop"""
        out = self.buf[: self.n].copy()
        tail = self.buf[self.n:]
        k = min(len(tail), self.n)
        out[:k] += tail[:k]
        return out

    def once(self, tail=2.0):
        return self.buf[: self.n + int(tail * SR)]


def master(x, lufs=-26.0):
    # a courtyard: short early reflections
    room = np.zeros_like(x)
    for d, g in ((0.023, 0.18), (0.041, 0.12), (0.067, 0.08)):
        k = int(d * SR)
        room[k:] += x[:-k] * g
    x = x + room[:, ::-1]
    # the speech band carved out (~ -10 dB at 1-4 kHz), the hiss above it softened
    for ch in range(2):
        x[:, ch] = x[:, ch] - 0.68 * bp(x[:, ch], 1000, 4000, 2)
        x[:, ch] = x[:, ch] - 0.5 * hp(x[:, ch], 6000, 2)
    x = np.tanh(x / np.max(np.abs(x)) * 1.2)
    # loudness: a bed, not a feature
    meter = pyln.Meter(SR)
    x = pyln.normalize.loudness(x, meter.integrated_loudness(x), lufs)
    return np.clip(x, -0.98, 0.98)


def play_line(tr, voice, notes, t0, beat, gain, pan):
    prev = None
    for semi, start, dur in notes:
        f = hz(semi)
        tr.add(voice(f, dur * beat * 0.98, prev), t0 + start * beat, gain, pan)
        prev = f


# Raag Mohanam on D: S=0 R=2 G=4 P=7 D=9 S'=12 R'=14 G'=16 (bright, five notes, the folk raga)
HOOK = [
    [(7, 0, .5), (9, .5, .5), (12, 1, 1), (9, 2, .5), (7, 2.5, .5), (4, 3, 1)],
    [(7, 0, .5), (4, .5, .5), (2, 1, .5), (4, 1.5, .5), (0, 2, 2)],
    [(9, 0, .5), (12, .5, .5), (14, 1, 1), (12, 2, .5), (9, 2.5, .5), (7, 3, 1)],
    [(4, 0, .5), (7, .5, .5), (9, 1, .5), (7, 1.5, .5), (4, 2, .5), (2, 2.5, .5), (0, 3, 1)],
]
SNAKE = [  # the pungi answers: quick, coiling turns
    [(12, 0, .25), (14, .25, .25), (12, .5, .25), (9, .75, .25), (12, 1, 1), (9, 2, .5), (7, 2.5, .5), (9, 3, 1)],
    [(7, 0, .25), (9, .25, .25), (7, .5, .25), (4, .75, .25), (7, 1, 1), (4, 2, 1), (2, 3, 1)],
    [(16, 0, .25), (14, .25, .25), (12, .5, .25), (14, .75, .25), (16, 1, 1), (14, 2, .5), (12, 2.5, .5), (9, 3, 1)],
    [(7, 0, .5), (9, .5, .5), (7, 1, .5), (4, 1.5, .5), (2, 2, 1), (0, 3, 1)],
]
# the thavil over 16 sixteenths: V = valam crack (accent), v = soft valam · T = thoppi boom
VALAM = "V.vV.v..V.v..vV."
THOPPI = "T.....T...T.T..."


def groove(tr, t, beat, gain=0.6):
    step = beat / 4
    for i in range(16):
        at = t + i * step + (0.008 if i % 2 else 0)
        if VALAM[i] in "Vv":
            tr.add(thavil_valam(1.0 if VALAM[i] == "V" else 0.5), at, 0.45 * gain, 0.25)
        if THOPPI[i] == "T":
            tr.add(thavil_thoppi(1.0), at, 0.55 * gain, -0.15)
    for b in range(4):
        if b % 2 == 0:
            tr.add(taala(0.6, open_=True), t + b * beat, 0.3, -0.45)


def village():
    beat = 60 / 120
    bars = 16
    tr = Track(bars * 4 * beat)
    for b in range(bars):
        t = b * 4 * beat
        tr.add(shruti(4 * beat + 0.3), t, 0.2, 0)
        groove(tr, t, beat)
        if b % 2 == 0:
            tr.add(dollu(1.0), t, 0.55, 0)
        # SPARSE: the nadaswaram says its phrase once, the pungi answers once — the other 8 bars are drone and groove
        section, k = divmod(b, 4)
        if section == 0:
            play_line(tr, nadaswaram, [(s_ - 12, a, d) for s_, a, d in HOOK[k]], t, beat, 0.24, 0.12)
        elif section == 2:
            play_line(tr, pungi, [(s_ - 12, a, d) for s_, a, d in SNAKE[k]], t, beat, 0.16, -0.2)
    return master(tr.loop())


# Raag Punnagavarali on D (the snake raga): n(-2) S=0 r=1 g=3 M=5 P=7 d=8
SERPENT = [
    [(-2, 0, .5), (0, .5, .5), (1, 1, .5), (3, 1.5, .5), (5, 2, 1), (3, 3, .5), (1, 3.5, .5)],
    [(0, 0, 2), (-2, 2, 1), (0, 3, 1)],
    [(3, 0, .5), (5, .5, .5), (7, 1, 1), (8, 2, .5), (7, 2.5, .5), (5, 3, 1)],
    [(3, 0, .5), (1, .5, .5), (0, 1, 3)],
]


def faisla():
    beat = 60 / 92
    bars = 8
    tr = Track(bars * 4 * beat)
    for b in range(bars):
        t = b * 4 * beat
        tr.add(pungi_drone(4 * beat + 0.2), t, 0.1, 0.2)
        tr.add(shruti(4 * beat + 0.3, (-12, -5)), t, 0.1, -0.2)
        for at in (0, 2):  # the heartbeat
            tr.add(thavil_thoppi(1.0), t + at * beat, 0.6, 0)
            tr.add(thavil_thoppi(0.6), t + (at + 0.3) * beat, 0.5, 0)
        for at in (1, 3):
            tr.add(thavil_valam(0.4), t + at * beat, 0.3, 0.3)
            tr.add(taala(0.5, open_=False), t + (at + 0.5) * beat, 0.4, -0.4)
        if b in (2, 3, 6, 7):
            play_line(tr, pungi, [(s_ - 12, a, d) for s_, a, d in SERPENT[(b - 2) % 4]], t, beat, 0.18, 0.1)
    return master(tr.loop(), -27)


def win():
    beat = 60 / 132
    tr = Track(5.0)
    tr.add(kombu(1.4), 0, 0.35, 0)
    for i in range(16):
        tr.add(dollu(0.35 + i * 0.03), 0.4 + i * beat / 4, 0.5, 0)
        tr.add(chande(0.3 + i * 0.04), 0.4 + i * beat / 4 + beat / 8, 0.4, 0.3)
    play_line(tr, nadaswaram, [(0, 0, .5), (2, .5, .5), (4, 1, .5), (7, 1.5, .5), (9, 2, .5), (12, 2.5, .5), (14, 3, .5), (16, 3.5, 3)], 0.4, beat, 0.32, 0)
    land = 0.4 + 3.5 * beat
    tr.add(shruti(3.5), land, 0.16, 0)
    for k, s_ in enumerate((12, 16, 19, 24)):
        tr.add(bell(hz(s_)), land + k * 0.1, 0.6, (-1) ** k * 0.4)
    tr.add(dollu(1.3), land, 0.7, 0)
    tr.add(taala(1.3), land, 0.6, -0.3)
    return master(tr.once(1.5), -20)


def lose():
    beat = 60 / 72
    tr = Track(4.8)
    play_line(tr, pungi, [(7, 0, 1), (5, 1, .5), (3, 1.5, .5), (1, 2, 1), (0, 3, .5), (-2, 3.5, 2.5)], 0, beat, 0.3, 0)
    tr.add(pungi_drone(5), 0, 0.08, 0)
    tr.add(dollu(1.0), 0, 0.6, 0)
    tr.add(dollu(1.0), 3.5 * beat, 0.6, 0)
    tr.add(bell(hz(-2)), 3.5 * beat, 0.5, 0)
    return master(tr.once(1.5), -21)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for name, make in (("village", village), ("faisla", faisla), ("win", win), ("lose", lose)):
        x = make()
        path = os.path.join(OUT, f"{name}.mp3")
        sf.write(path, x, SR, format="MP3")
        print(f"{name}: {len(x) / SR:.1f}s -> {os.path.relpath(path)}")
