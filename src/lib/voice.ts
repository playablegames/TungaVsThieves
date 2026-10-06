"use client";
// Table voice — open mic from every seat, like a Discord voice channel, at zero cost.
// Supabase Realtime only introduces the phones (presence = who's in voice; broadcast = offer/answer/ICE);
// the audio itself flows phone to phone (WebRTC mesh). Audio-only mesh holds up at a 12-seat table:
// each phone sends ~24 kbps to each other phone.
// The Gone room: an eliminated player hears the table, but only other eliminated players hear them.
// Both ends enforce it — the speaker stops sending, the listener stops playing.
import { useEffect, useSyncExternalStore } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { realtime } from "./client";

export interface VoicePeer {
  seat: number;
  name: string;
  /** they muted their own mic */
  muted: boolean;
  speaking: boolean;
  connected: boolean;
  /** you muted them on your phone */
  hushed: boolean;
}

export interface VoiceSnap {
  status: "unavailable" | "off" | "connecting" | "on" | "needs-tap";
  micOn: boolean;
  /** no microphone permission — listening only */
  micBlocked: boolean;
  speaking: boolean;
  /** by seat; only peers you can hear */
  peers: Record<number, VoicePeer>;
}

interface Meta { seat: number; name: string; muted: boolean }

interface Peer extends Meta {
  id: string;
  pc: RTCPeerConnection;
  polite: boolean;
  making: boolean;
  ignoreOffer: boolean;
  audio: HTMLAudioElement;
  analyser: AnalyserNode | null;
  sender: RTCRtpSender | null;
  speaking: boolean;
  quietSince: number;
  connected: boolean;
}

type Signal = { from: string; to: string; description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };

const PREF = "tunga:voice";
const SPEAK_RMS = 0.025;
const HOLD_MS = 350;
const MAX_KBPS = 24;

function iceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];
  // Phones on mobile data behind carrier NAT often need a relay. Any free TURN service works (metered.ca Open Relay, Cloudflare).
  const urls = process.env.NEXT_PUBLIC_TURN_URLS;
  if (urls) servers.push({ urls: urls.split(","), username: process.env.NEXT_PUBLIC_TURN_USERNAME, credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL });
  return servers;
}

class Voice {
  private id = crypto.randomUUID();
  private channel: RealtimeChannel | null = null;
  private peers = new Map<string, Peer>();
  private local: MediaStream | null = null;
  private localAnalyser: AnalyserNode | null = null;
  private ctx: AudioContext | null = null;
  private meter: ReturnType<typeof setInterval> | null = null;
  private gen = 0;
  private me: Meta = { seat: -1, name: "", muted: false };
  private open = true;
  private gone = new Set<number>();
  private hushed = new Set<number>();
  private listeners = new Set<() => void>();
  private snap: VoiceSnap;

  constructor(private code: string) {
    this.snap = { status: realtime ? "off" : "unavailable", micOn: true, micBlocked: false, speaking: false, peers: {} };
  }

  // ------------------------------------------------------------ store
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  getSnapshot = () => this.snap;
  private set(patch: Partial<VoiceSnap>) { this.snap = { ...this.snap, ...patch }; this.listeners.forEach((f) => f()); }
  private publishPeers() {
    const peers: Record<number, VoicePeer> = {};
    for (const p of this.peers.values()) {
      if (p.seat < 0 || !this.canHear(this.me.seat, p.seat)) continue;
      peers[p.seat] = { seat: p.seat, name: p.name, muted: p.muted, speaking: p.speaking && !p.muted, connected: p.connected, hushed: this.hushed.has(p.seat) };
    }
    this.set({ peers });
  }

  // ------------------------------------------------------------ rules
  private canHear(listener: number, speaker: number) {
    return this.open || !this.gone.has(speaker) || this.gone.has(listener);
  }

  setTable(seat: number, name: string, open: boolean, gone: number[]) {
    const moved = seat !== this.me.seat || name !== this.me.name;
    this.me = { ...this.me, seat, name };
    this.open = open;
    this.gone = new Set(gone);
    if (moved) this.track();
    this.applyRules();
  }

  private applyRules() {
    const track = this.local?.getAudioTracks()[0] ?? null;
    for (const p of this.peers.values()) {
      const send = p.seat >= 0 && this.canHear(p.seat, this.me.seat);
      if (p.sender && p.sender.track !== (send ? track : null)) p.sender.replaceTrack(send ? track : null).catch(() => {});
      p.audio.muted = p.seat < 0 || !this.canHear(this.me.seat, p.seat) || this.hushed.has(p.seat);
    }
    this.publishPeers();
  }

  hush(seat: number) {
    if (this.hushed.has(seat)) this.hushed.delete(seat); else this.hushed.add(seat);
    this.applyRules();
  }

  // ------------------------------------------------------------ lifecycle
  get wanted() {
    try { return localStorage.getItem(PREF) !== "off"; } catch { return true; }
  }

  async start() {
    if (!realtime || this.channel) return;
    const gen = ++this.gen;
    try { localStorage.setItem(PREF, "on"); } catch {}
    this.set({ status: "connecting" });

    try {
      this.local = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
      this.local.getAudioTracks().forEach((t) => (t.enabled = this.snap.micOn));
      this.set({ micBlocked: false });
    } catch {
      this.set({ micBlocked: true });
    }
    if (gen !== this.gen) { this.local?.getTracks().forEach((t) => t.stop()); this.local = null; return; }

    this.ctx = new AudioContext();
    if (this.local) {
      this.localAnalyser = this.ctx.createAnalyser();
      this.ctx.createMediaStreamSource(this.local).connect(this.localAnalyser);
    }
    this.meter = setInterval(this.measure, 120);

    const ch = realtime.channel(`voice:${this.code.toUpperCase()}`, { config: { broadcast: { self: false }, presence: { key: this.id } } });
    this.channel = ch;
    ch.on("presence", { event: "sync" }, () => this.syncPresence())
      .on("broadcast", { event: "sig" }, ({ payload }) => { void this.onSignal(payload as Signal); })
      .subscribe((status) => {
        if (status !== "SUBSCRIBED" || gen !== this.gen) return;
        this.track();
        this.set({ status: this.ctx?.state === "running" ? "on" : "needs-tap" });
      });
  }

  /** Browsers won't play sound until the page is touched; one tap unlocks every voice. */
  async unlock() {
    await this.ctx?.resume().catch(() => {});
    await Promise.all([...this.peers.values()].map((p) => p.audio.play().catch(() => {})));
    if (this.channel) this.set({ status: this.ctx?.state === "running" ? "on" : "needs-tap" });
  }

  stop(remember = false) {
    this.gen++;
    if (remember) try { localStorage.setItem(PREF, "off"); } catch {}
    for (const id of [...this.peers.keys()]) this.drop(id);
    if (this.channel) realtime?.removeChannel(this.channel);
    this.channel = null;
    this.local?.getTracks().forEach((t) => t.stop());
    this.local = null;
    this.localAnalyser = null;
    if (this.meter) clearInterval(this.meter);
    this.meter = null;
    this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.set({ status: realtime ? "off" : "unavailable", speaking: false, peers: {} });
  }

  async toggleMic() {
    if (this.snap.micBlocked && this.channel) {
      // try again — the player may have just allowed the mic in browser settings
      try {
        this.local = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
        if (this.ctx) { this.localAnalyser = this.ctx.createAnalyser(); this.ctx.createMediaStreamSource(this.local).connect(this.localAnalyser); }
        for (const p of this.peers.values()) p.sender = p.pc.addTrack(this.local.getAudioTracks()[0], this.local);
        this.set({ micBlocked: false, micOn: true });
        this.me.muted = false;
        this.applyRules();
        this.track();
      } catch { /* still blocked */ }
      return;
    }
    const on = !this.snap.micOn;
    this.local?.getAudioTracks().forEach((t) => (t.enabled = on));
    this.me.muted = !on;
    this.set({ micOn: on, speaking: on && this.snap.speaking });
    this.track();
  }

  private track() {
    if (this.channel && this.me.seat >= 0) void this.channel.track({ seat: this.me.seat, name: this.me.name, muted: this.me.muted || this.snap.micBlocked } satisfies Meta);
  }

  // ------------------------------------------------------------ peers
  private syncPresence() {
    if (!this.channel) return;
    const state = this.channel.presenceState<Meta>();
    for (const [id, metas] of Object.entries(state)) {
      if (id === this.id || !metas[0]) continue;
      const p = this.peers.get(id) ?? this.connect(id);
      p.seat = metas[0].seat;
      p.name = metas[0].name;
      p.muted = metas[0].muted;
    }
    for (const id of [...this.peers.keys()]) if (!state[id]) this.drop(id);
    this.applyRules();
  }

  private connect(id: string): Peer {
    const pc = new RTCPeerConnection({ iceServers: iceServers() });
    const audio = document.createElement("audio");
    audio.autoplay = true;
    audio.setAttribute("playsinline", "");
    audio.style.display = "none";
    document.body.appendChild(audio);
    const p: Peer = {
      id, seat: -1, name: "", muted: false, pc, audio, polite: this.id < id, making: false, ignoreOffer: false,
      analyser: null, sender: null, speaking: false, quietSince: 0, connected: false,
    };
    this.peers.set(id, p);

    const track = this.local?.getAudioTracks()[0];
    if (track && this.local) p.sender = pc.addTrack(track, this.local);

    pc.onnegotiationneeded = async () => {
      try {
        p.making = true;
        await pc.setLocalDescription();
        this.send({ to: id, description: pc.localDescription!.toJSON() });
      } catch { /* superseded */ } finally { p.making = false; }
    };
    pc.onicecandidate = ({ candidate }) => { if (candidate) this.send({ to: id, candidate: candidate.toJSON() }); };
    pc.ontrack = ({ streams, track: t }) => {
      const stream = streams[0] ?? new MediaStream([t]);
      audio.srcObject = stream;
      audio.play().catch(() => this.set({ status: "needs-tap" }));
      if (this.ctx) {
        p.analyser = this.ctx.createAnalyser();
        this.ctx.createMediaStreamSource(stream).connect(p.analyser);
      }
    };
    pc.onconnectionstatechange = () => {
      p.connected = pc.connectionState === "connected";
      if (p.connected) this.capBitrate(p);
      if (pc.connectionState === "failed") pc.restartIce();
      this.publishPeers();
    };
    return p;
  }

  private capBitrate(p: Peer) {
    if (!p.sender) return;
    const params = p.sender.getParameters();
    if (!params.encodings?.length) return;
    params.encodings[0].maxBitrate = MAX_KBPS * 1000;
    p.sender.setParameters(params).catch(() => {});
  }

  private drop(id: string) {
    const p = this.peers.get(id);
    if (!p) return;
    p.pc.close();
    p.audio.srcObject = null;
    p.audio.remove();
    this.peers.delete(id);
  }

  private send(s: Omit<Signal, "from">) {
    void this.channel?.send({ type: "broadcast", event: "sig", payload: { ...s, from: this.id } });
  }

  /** "Perfect negotiation" (W3C/MDN pattern): either side may offer; the polite side yields on a collision. */
  private async onSignal(s: Signal) {
    if (s.to !== this.id || !this.channel) return;
    const p = this.peers.get(s.from) ?? this.connect(s.from);
    try {
      if (s.description) {
        const collision = s.description.type === "offer" && (p.making || p.pc.signalingState !== "stable");
        p.ignoreOffer = !p.polite && collision;
        if (p.ignoreOffer) return;
        await p.pc.setRemoteDescription(s.description);
        if (s.description.type === "offer") {
          await p.pc.setLocalDescription();
          this.send({ to: s.from, description: p.pc.localDescription!.toJSON() });
        }
      } else if (s.candidate) {
        await p.pc.addIceCandidate(s.candidate).catch((e) => { if (!p.ignoreOffer) throw e; });
      }
    } catch { /* a stale offer or candidate — the next negotiation recovers */ }
  }

  // ------------------------------------------------------------ who's talking
  private buf = new Float32Array(512);
  private loud(a: AnalyserNode | null) {
    if (!a) return false;
    a.getFloatTimeDomainData(this.buf);
    let sum = 0;
    for (let i = 0; i < this.buf.length; i++) sum += this.buf[i] * this.buf[i];
    return Math.sqrt(sum / this.buf.length) > SPEAK_RMS;
  }

  private measure = () => {
    const now = Date.now();
    let changed = false;
    for (const p of this.peers.values()) {
      const loud = this.loud(p.analyser);
      if (loud) p.quietSince = now;
      const speaking = loud || now - p.quietSince < HOLD_MS;
      if (speaking !== p.speaking) { p.speaking = speaking; changed = true; }
    }
    const meLoud = this.snap.micOn && this.loud(this.localAnalyser);
    if (changed) this.publishPeers();
    if (meLoud !== this.snap.speaking) this.set({ speaking: meLoud });
  };
}

const voices = new Map<string, Voice>();
const voiceFor = (code: string) => {
  const key = code.toUpperCase();
  if (!voices.has(key)) voices.set(key, new Voice(key));
  return voices.get(key)!;
};

const OFF: VoiceSnap = { status: "unavailable", micOn: false, micBlocked: false, speaking: false, peers: {} };

/**
 * Voice for one table. On by default: it joins as soon as the player is seated (a first visit asks for the mic).
 * `gone` = eliminated seats; `open` = lobby or game over, when everyone hears everyone.
 */
export function useVoice(code: string, me: { seat: number; name: string } | null, open: boolean, gone: number[]) {
  const v = voiceFor(code);
  const snap = useSyncExternalStore(v.subscribe, v.getSnapshot, () => OFF);
  const seated = me !== null;

  useEffect(() => {
    if (!seated || !v.wanted) return;
    void v.start();
    return () => v.stop();
  }, [v, seated]);

  const goneKey = gone.join(",");
  useEffect(() => {
    if (me) v.setTable(me.seat, me.name, open, goneKey ? goneKey.split(",").map(Number) : []);
  }, [v, me?.seat, me?.name, open, goneKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    ...snap,
    join: () => { void v.start().then(() => v.unlock()); },
    leave: () => v.stop(true),
    unlock: () => { void v.unlock(); },
    toggleMic: () => { void v.toggleMic(); },
    hush: (seat: number) => v.hush(seat),
  };
}
