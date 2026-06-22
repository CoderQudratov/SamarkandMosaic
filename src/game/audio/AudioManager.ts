import { Howl, Howler } from 'howler';
import { useAudioStore } from '@/store/audioStore';
import type { SfxKey, MusicKey } from '@/game/types';

const BASE = '/assets/audio';

const MUSIC_FILES: Record<MusicKey, string> = {
  bg: `${BASE}/bg.mp3`,
};

const SFX_FILES: Record<SfxKey, string> = {
  snap:      `${BASE}/snap.mp3`,
  wrong:     `${BASE}/wrong.mp3`,
  win:       `${BASE}/win.mp3`,
  click:     `${BASE}/click.mp3`,
  hint:      `${BASE}/hint.mp3`,
  loseHeart: `${BASE}/lose-heart.mp3`,
};

function makeHowl(src: string, opts: { loop: boolean; volume: number }): Howl {
  return new Howl({
    src: [src],
    loop: opts.loop,
    volume: opts.volume,
    preload: true,
    html5: false,
    onloaderror: () => { /* file missing — silent no-op */ },
  });
}

class AudioManagerClass {
  private music: Partial<Record<MusicKey, Howl>> = {};
  private sfx: Partial<Record<SfxKey, Howl>> = {};
  private bgId: number | null = null;
  private initialized = false;

  // ── Lifecycle ────────────────────────────────────────────────────────────

  init(): void {
    if (this.initialized) return;
    this.initialized = true;

    const { musicVolume, sfxVolume } = useAudioStore.getState();

    for (const [k, src] of Object.entries(MUSIC_FILES) as [MusicKey, string][]) {
      this.music[k] = makeHowl(src, { loop: true, volume: musicVolume });
    }

    for (const [k, src] of Object.entries(SFX_FILES) as [SfxKey, string][]) {
      this.sfx[k] = makeHowl(src, { loop: false, volume: sfxVolume });
    }

    // Telegram WebApp mobile: audio context may be suspended until first gesture.
    // Howler has autoUnlock but we nudge it explicitly on first pointer contact.
    const unlock = () => {
      try {
        const ctx = (Howler as unknown as { ctx?: AudioContext }).ctx;
        if (ctx?.state === 'suspended') ctx.resume().catch(() => { /* noop */ });
      } catch { /* noop */ }
    };
    window.addEventListener('pointerdown', unlock, { once: true, capture: true });
    window.addEventListener('touchstart', unlock, { once: true, capture: true, passive: true });
  }

  // ── Music (looping bg) ───────────────────────────────────────────────────

  playBg(): void {
    const sound = this.music['bg'];
    if (!sound || this.bgId !== null) return;
    this.bgId = sound.play() as number;
    // Apply persisted mute without stopping playback — mute keeps position
    if (useAudioStore.getState().musicMuted) {
      sound.mute(true, this.bgId);
    }
  }

  stopBg(fadeDuration = 600): void {
    const sound = this.music['bg'];
    if (!sound || this.bgId === null) return;
    const id = this.bgId;
    this.bgId = null;
    try {
      sound.fade(sound.volume() as number, 0, fadeDuration, id);
      setTimeout(() => { try { sound.stop(id); } catch { /* noop */ } }, fadeDuration + 80);
    } catch {
      sound.stop(id);
    }
  }

  // ── SFX (one-shot) ───────────────────────────────────────────────────────

  play(key: SfxKey): void {
    if (useAudioStore.getState().sfxMuted) return;
    try {
      this.sfx[key]?.play();
    } catch { /* noop */ }
  }

  // ── Volume & mute controls (called by useAudioSync) ──────────────────────

  setMusicMuted(muted: boolean): void {
    const sound = this.music['bg'];
    if (!sound || this.bgId === null) return;
    sound.mute(muted, this.bgId);
  }

  /** SFX mute is checked at play() time — no need to stop in-flight one-shots. */
  setSfxMuted(_muted: boolean): void { /* intentional no-op */ }

  setMusicVolume(volume: number): void {
    const sound = this.music['bg'];
    if (!sound) return;
    sound.volume(volume);
    if (this.bgId !== null) sound.volume(volume, this.bgId);
  }

  setSfxVolume(volume: number): void {
    for (const sound of Object.values(this.sfx)) {
      sound?.volume(volume);
    }
  }
}

export const audioManager = new AudioManagerClass();
