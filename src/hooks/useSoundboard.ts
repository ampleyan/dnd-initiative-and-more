import { useRef, useCallback, useEffect, useState } from 'react';
import { Sound } from '../types';

export interface LiveSettings {
  loop: boolean;
  panX: number; // -1 to 1
  panZ: number; // -1 to 1
  repeatSecs: number; // 0 = no repeat timer, >0 = delay between plays
}

export const DEFAULT_LIVE: LiveSettings = { loop: false, panX: 0, panZ: 0, repeatSecs: 0 };

export type SpatialMode = '5.1' | 'stereo';

/**
 * Maps a pan position to 5.1 output channels.
 * Channel layout: 0=FL, 1=FR, 2=C, 3=LFE (unused), 4=SL, 5=SR
 */
export function resolveChannels(panX: number, panZ: number): number[] {
  if (Math.abs(panX) <= 0.5 && Math.abs(panZ) <= 0.5) return [0, 1]; // center → FL+FR
  if (panX < -0.5 && panZ >= 0) return [0];  // front left
  if (panX < -0.5 && panZ < 0) return [4];   // surround left
  if (panX > 0.5 && panZ >= 0) return [1];   // front right
  if (panX > 0.5 && panZ < 0) return [5];    // surround right
  if (panZ < -0.3) return [2];               // center front
  return [0, 1];
}

export function useSoundboard(masterVolume: number, isMuted: boolean) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const channelMergerRef = useRef<ChannelMergerNode | null>(null);
  const pannerNodesRef = useRef<Map<string, PannerNode>>(new Map());
  const routingNodesRef = useRef<Map<string, GainNode[]>>(new Map());
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const repeatTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const [playingIds, setPlayingIds] = useState<Set<string>>(new Set());
  const [liveSettings, setLiveSettings] = useState<Record<string, LiveSettings>>({});
  const [spatialMode, setSpatialMode] = useState<SpatialMode>('stereo');
  const liveSettingsRef = useRef<Record<string, LiveSettings>>({});

  const getCtx = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
      const ctx = audioContextRef.current;
      const masterGain = ctx.createGain();
      masterGainRef.current = masterGain;

      const storedChannels = parseInt(localStorage.getItem('spatial_channels') || '2');
      if (ctx.destination.maxChannelCount >= 6 && storedChannels === 6) {
        ctx.destination.channelCount = 6;
        ctx.destination.channelCountMode = 'explicit';
        const merger = ctx.createChannelMerger(6);
        merger.connect(masterGain);
        masterGain.connect(ctx.destination);
        channelMergerRef.current = merger;
        setSpatialMode('5.1');
      } else {
        const l = ctx.listener;
        l.forwardX?.setValueAtTime(0, 0);
        l.forwardY?.setValueAtTime(0, 0);
        l.forwardZ?.setValueAtTime(-1, 0);
        l.upX?.setValueAtTime(0, 0);
        l.upY?.setValueAtTime(1, 0);
        l.upZ?.setValueAtTime(0, 0);
        masterGain.connect(ctx.destination);
        setSpatialMode('stereo');
      }
    }
    return audioContextRef.current;
  }, []);

  useEffect(() => {
    if (masterGainRef.current && audioContextRef.current) {
      const t = audioContextRef.current.currentTime;
      masterGainRef.current.gain.setTargetAtTime(isMuted ? 0 : masterVolume, t, 0.05);
    }
  }, [masterVolume, isMuted]);

  const makePanner = useCallback((ctx: AudioContext, panX: number, panZ: number): PannerNode => {
    const p = ctx.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'inverse';
    p.refDistance = 1;
    p.rolloffFactor = 0.4;
    p.positionX.setValueAtTime(panX * 6, ctx.currentTime);
    p.positionY.setValueAtTime(0, ctx.currentTime);
    p.positionZ.setValueAtTime(panZ * 6, ctx.currentTime);
    return p;
  }, []);

  const getLive = (id: string): LiveSettings => liveSettingsRef.current[id] ?? DEFAULT_LIVE;

  const patchLive = useCallback((id: string, patch: Partial<LiveSettings>) => {
    const next = { ...getLive(id), ...patch };
    liveSettingsRef.current = { ...liveSettingsRef.current, [id]: next };
    setLiveSettings(prev => ({ ...prev, [id]: next }));

    const audio = audioRefs.current.get(id);
    if (audio) audio.loop = next.loop && next.repeatSecs === 0;

    if (channelMergerRef.current && (patch.panX !== undefined || patch.panZ !== undefined)) {
      // 5.1 mode: pan change requires restart (MediaElementSourceNode can't be reconnected)
      const existingAudio = audioRefs.current.get(id);
      if (existingAudio) {
        const oldGains = routingNodesRef.current.get(id);
        if (oldGains) { oldGains.forEach(n => n.disconnect()); routingNodesRef.current.delete(id); }
        existingAudio.pause();
        existingAudio.currentTime = 0;
        audioRefs.current.delete(id);
        setPlayingIds(prev => { const s = new Set(prev); s.delete(id); return s; });
      }
    } else {
      const panner = pannerNodesRef.current.get(id);
      if (panner && audioContextRef.current) {
        const t = audioContextRef.current.currentTime;
        panner.positionX.setValueAtTime(next.panX * 6, t);
        panner.positionZ.setValueAtTime(next.panZ * 6, t);
      }
    }
  }, []);

  const setVolume = useCallback((id: string, volume: number) => {
    const audio = audioRefs.current.get(id);
    if (audio) audio.volume = Math.min(1, Math.max(0, volume));
  }, []);

  const getAudioCtx = useCallback((): AudioContext => {
    return getCtx();
  }, [getCtx]);

  const playAudio = useCallback((sound: Sound, onEnded: () => void): HTMLAudioElement => {
    const settings = getLive(sound.id);
    const ctx = getCtx();
    ctx.resume();

    const audio = new Audio(sound.url);
    audio.volume = Math.min(1, Math.max(0, sound.volume));
    audio.loop = settings.loop && settings.repeatSecs === 0;

    const source = ctx.createMediaElementSource(audio);

    if (channelMergerRef.current) {
      const channels = resolveChannels(settings.panX, settings.panZ);
      const gains = channels.map(ch => {
        const g = ctx.createGain();
        g.gain.setValueAtTime(1 / channels.length, ctx.currentTime);
        source.connect(g);
        g.connect(channelMergerRef.current!, 0, ch);
        return g;
      });
      routingNodesRef.current.set(sound.id, gains);
    } else {
      let panner = pannerNodesRef.current.get(sound.id);
      if (!panner) {
        panner = makePanner(ctx, settings.panX, settings.panZ);
        pannerNodesRef.current.set(sound.id, panner);
      }
      source.connect(panner);
      if (masterGainRef.current) {
        panner.connect(masterGainRef.current);
      } else {
        panner.connect(ctx.destination);
      }
    }

    audio.play().catch(console.error);
    audio.onended = onEnded;
    return audio;
  }, [getCtx, makePanner]);

  const togglePlay = useCallback((sound: Sound) => {
    const existing = audioRefs.current.get(sound.id);
    if (existing) {
      existing.pause();
      existing.currentTime = 0;
      audioRefs.current.delete(sound.id);
      pannerNodesRef.current.delete(sound.id);
      const rn = routingNodesRef.current.get(sound.id);
      if (rn) { rn.forEach(n => n.disconnect()); routingNodesRef.current.delete(sound.id); }
      const t = repeatTimers.current.get(sound.id);
      if (t) { clearTimeout(t); repeatTimers.current.delete(sound.id); }
      setPlayingIds(prev => { const s = new Set(prev); s.delete(sound.id); return s; });
      return;
    }

    const scheduleNext = () => {
      const s = getLive(sound.id);
      if (s.repeatSecs > 0) {
        const timer = setTimeout(() => {
          const newAudio = playAudio(sound, scheduleNext);
          audioRefs.current.set(sound.id, newAudio);
        }, s.repeatSecs * 1000);
        repeatTimers.current.set(sound.id, timer);
      } else {
        audioRefs.current.delete(sound.id);
        pannerNodesRef.current.delete(sound.id);
        routingNodesRef.current.delete(sound.id);
        setPlayingIds(prev => { const s = new Set(prev); s.delete(sound.id); return s; });
      }
    };

    const audio = playAudio(sound, scheduleNext);
    audioRefs.current.set(sound.id, audio);
    setPlayingIds(prev => new Set(prev).add(sound.id));
  }, [playAudio]);

  const stopAll = useCallback(() => {
    audioRefs.current.forEach(a => { a.pause(); a.currentTime = 0; });
    audioRefs.current.clear();
    pannerNodesRef.current.clear();
    routingNodesRef.current.forEach(gains => gains.forEach(n => n.disconnect()));
    routingNodesRef.current.clear();
    repeatTimers.current.forEach(t => clearTimeout(t));
    repeatTimers.current.clear();
    setPlayingIds(new Set());
  }, []);

  useEffect(() => {
    return () => {
      stopAll();
      audioContextRef.current?.close();
    };
  }, [stopAll]);

  return {
    playingIds,
    liveSettings,
    spatialMode,
    togglePlay,
    stopAll,
    patchLive,
    setVolume,
    getAudioCtx,
    audioRefs,
  };
}
