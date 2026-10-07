"use client";
// Table voice over LiveKit (2026-10-07). Same store shape as the mesh (voice.ts), so the screens don't change.
// Each phone sends its voice ONCE to LiveKit's server, which passes it on — 12 phones no longer send 11 copies each.
// Who hears whom is decided by the passes our server hands out (server/livekit.ts):
//   alive → the table room (speak + listen) · out → the table room listen-only + the Gone room (speak + listen)
// so the living can't hear the gone even if a phone misbehaves.
import { Room, RoomEvent, Track, type Participant, type RemoteParticipant } from "livekit-client";
import { loadToken } from "./client";
import type { VoicePeer, VoiceSnap } from "./voice";

const PREF = "tunga:voice";
interface Passes { url: string; table: string; gone: string | null; alive: boolean }

const seatOf = (p: Participant) => { const m = /^s(\d+)-/.exec(p.identity); return m ? Number(m[1]) : -1; };

export class LiveKitVoice {
  private rooms: Room[] = [];
  private listeners = new Set<() => void>();
  private hushed = new Set<number>();
  private gen = 0;
  private alive = true;
  private me = { seat: -1, name: "" };
  private amGone = false;
  private snap: VoiceSnap = { status: "off", micOn: true, micBlocked: false, speaking: false, peers: {} };

  constructor(private code: string) {}

  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  getSnapshot = () => this.snap;
  private set(patch: Partial<VoiceSnap>) { this.snap = { ...this.snap, ...patch }; this.listeners.forEach((f) => f()); }

  get wanted() { try { return localStorage.getItem(PREF) !== "off"; } catch { return true; } }

  /** the table moved on: if I went out (or came back), my passes change — reconnect with the new ones */
  setTable(seat: number, name: string, open: boolean, gone: number[]) {
    const moved = seat !== this.me.seat;
    this.me = { seat, name };
    const amGone = !open && gone.includes(seat);
    // my seat changed (the deal re-shuffles seats) or I went out / came back: my passes change — reconnect
    if (amGone !== this.amGone || moved) {
      this.amGone = amGone;
      if (this.rooms.length) { this.stop(); void this.start(); }
    }
  }

  async start() {
    if (this.rooms.length) return;
    const gen = ++this.gen;
    try { localStorage.setItem(PREF, "on"); } catch {}
    this.set({ status: "connecting" });
    const token = loadToken(this.code);
    let passes: Passes;
    try {
      const r = await fetch(`/api/games/${this.code}/voice`, { headers: { "x-player-token": token ?? "" }, cache: "no-store" });
      passes = (await r.json()) as Passes;
      if (!passes.url) throw new Error("LiveKit is off");
    } catch { this.set({ status: "unavailable" }); return; }
    if (gen !== this.gen) return;
    this.alive = passes.alive;

    const join = async (pass: string, speak: boolean) => {
      const room = new Room({ audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      const refresh = () => this.refresh();
      room
        .on(RoomEvent.ParticipantConnected, refresh).on(RoomEvent.ParticipantDisconnected, refresh)
        .on(RoomEvent.ActiveSpeakersChanged, refresh).on(RoomEvent.TrackMuted, refresh).on(RoomEvent.TrackUnmuted, refresh)
        .on(RoomEvent.TrackSubscribed, (track, _pub, p) => {
          if (track.kind === Track.Kind.Audio) {
            const el = track.attach();
            el.style.display = "none";
            document.body.appendChild(el);
            if (this.hushed.has(seatOf(p))) (p as RemoteParticipant).setVolume(0);
          }
          refresh();
        })
        .on(RoomEvent.TrackUnsubscribed, (track) => { track.detach().forEach((e) => e.remove()); refresh(); })
        .on(RoomEvent.AudioPlaybackStatusChanged, () => this.set({ status: this.rooms.every((r) => r.canPlaybackAudio) ? "on" : "needs-tap" }))
        .on(RoomEvent.Disconnected, refresh);
      await room.connect(passes.url, pass, { autoSubscribe: true });
      this.rooms.push(room);
      if (speak) {
        try { await room.localParticipant.setMicrophoneEnabled(this.snap.micOn); this.set({ micBlocked: false }); }
        catch { this.set({ micBlocked: true }); }
      }
    };
    try {
      await join(passes.table, passes.alive);
      if (passes.gone) await join(passes.gone, true);
    } catch { this.stop(); this.set({ status: "unavailable" }); return; }
    if (gen !== this.gen) { this.stop(); return; }
    this.set({ status: this.rooms.every((r) => r.canPlaybackAudio) ? "on" : "needs-tap" });
    this.refresh();
  }

  /** who's at the table, who's talking, who muted themselves — from every room this phone is in */
  private refresh() {
    const peers: Record<number, VoicePeer> = {};
    let speaking = false;
    for (const room of this.rooms) {
      speaking ||= room.localParticipant.isSpeaking;
      for (const p of room.remoteParticipants.values()) {
        const seat = seatOf(p);
        if (seat < 0) continue;
        const prev = peers[seat];
        const talking = p.isSpeaking && p.isMicrophoneEnabled;
        peers[seat] = {
          seat, name: p.name ?? "", connected: true, hushed: this.hushed.has(seat),
          muted: prev ? prev.muted && !p.isMicrophoneEnabled : !p.isMicrophoneEnabled,
          speaking: (prev?.speaking ?? false) || talking,
        };
      }
    }
    this.set({ peers, speaking });
  }

  /** browsers won't play sound until the page is touched; one tap unlocks every voice */
  async unlock() {
    await Promise.all(this.rooms.map((r) => r.startAudio().catch(() => {})));
    if (this.rooms.length) this.set({ status: this.rooms.every((r) => r.canPlaybackAudio) ? "on" : "needs-tap" });
  }

  stop(remember = false) {
    this.gen++;
    if (remember) try { localStorage.setItem(PREF, "off"); } catch {}
    for (const r of this.rooms) void r.disconnect();
    this.rooms = [];
    this.set({ status: "off", speaking: false, peers: {} });
  }

  async toggleMic() {
    const on = !this.snap.micOn || this.snap.micBlocked;
    const speakIn = this.rooms.filter((r) => r.localParticipant.permissions?.canPublish !== false);
    try {
      await Promise.all(speakIn.map((r) => r.localParticipant.setMicrophoneEnabled(on)));
      this.set({ micOn: on, micBlocked: false });
    } catch { this.set({ micBlocked: true }); }
  }

  /** mute one player for you only */
  hush(seat: number) {
    if (this.hushed.has(seat)) this.hushed.delete(seat); else this.hushed.add(seat);
    for (const room of this.rooms) for (const p of room.remoteParticipants.values()) if (seatOf(p) === seat) p.setVolume(this.hushed.has(seat) ? 0 : 1);
    this.refresh();
  }
}

const lk = new Map<string, LiveKitVoice>();
export const liveKitVoiceFor = (code: string) => {
  const key = code.toUpperCase();
  if (!lk.has(key)) lk.set(key, new LiveKitVoice(key));
  return lk.get(key)!;
};
