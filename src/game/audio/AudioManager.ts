import { Howl, Howler } from 'howler';
import type { SoundKey } from '@/game/types';
import { useAudioStore } from '@/store/audioStore';

const SOUND_SOURCES: Record<SoundKey, string> = {
  pickup: '/assets/audio/pickup.wav',
  drag: '/assets/audio/drag.wav',
  snap: '/assets/audio/snap.wav',
  wrong: '/assets/audio/wrong.wav',
  complete: '/assets/audio/complete.wav',
  ambient: '/assets/audio/ambient.wav',
};

class AudioManager {
  private sounds: Partial<Record<SoundKey, Howl>> = {};
  private ambientId: number | null = null;

  preload(): void {
    for (const [key, src] of Object.entries(SOUND_SOURCES) as [SoundKey, string][]) {
      this.sounds[key] = new Howl({
        src: [src],
        loop: key === 'ambient',
        volume: key === 'ambient'
          ? useAudioStore.getState().ambientVolume
          : useAudioStore.getState().sfxVolume,
        preload: true,
      });
    }
  }

  play(key: SoundKey): void {
    if (useAudioStore.getState().muted) return;
    const sound = this.sounds[key];
    if (!sound) return;

    if (key === 'ambient') {
      if (this.ambientId !== null) return;
      this.ambientId = sound.play() as number;
      useAudioStore.getState().setAmbientPlaying(true);
    } else {
      sound.play();
    }
  }

  stopAmbient(): void {
    const sound = this.sounds['ambient'];
    if (sound && this.ambientId !== null) {
      sound.stop(this.ambientId);
      this.ambientId = null;
      useAudioStore.getState().setAmbientPlaying(false);
    }
  }

  setMuted(muted: boolean): void {
    Howler.mute(muted);
  }

  setSfxVolume(volume: number): void {
    for (const [key, sound] of Object.entries(this.sounds) as [SoundKey, Howl][]) {
      if (key !== 'ambient') sound.volume(volume);
    }
  }

  setAmbientVolume(volume: number): void {
    this.sounds['ambient']?.volume(volume);
  }

  destroy(): void {
    for (const sound of Object.values(this.sounds)) {
      sound?.unload();
    }
    this.sounds = {};
    this.ambientId = null;
  }
}

export const audioManager = new AudioManager();
