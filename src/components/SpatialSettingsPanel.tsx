import React, { useState, useEffect } from 'react';
import { Speaker, Settings2, Play, Info, Sliders, ShieldAlert } from 'lucide-react';
import { cn } from '../lib/utils';
import { SpatialMode } from '../hooks/useSoundboard';

interface SpeakerChannel {
  id: string;
  label: string;
  short: string;
  x: number;
  y: number;
}

const CHANNELS: SpeakerChannel[] = [
  { id: '0', label: 'Front Left',      short: 'FL',  x: 20, y: 15 },
  { id: '1', label: 'Front Right',     short: 'FR',  x: 80, y: 15 },
  { id: '2', label: 'Center',          short: 'C',   x: 50, y: 10 },
  { id: '3', label: 'Subwoofer (LFE)', short: 'LFE', x: 75, y: 35 },
  { id: '4', label: 'Surround Left',   short: 'SL',  x: 10, y: 70 },
  { id: '5', label: 'Surround Right',  short: 'SR',  x: 90, y: 70 },
];

interface SpatialSettingsPanelProps {
  audioCtx: AudioContext | null;
  spatialMode: SpatialMode;
}

export const SpatialSettingsPanel: React.FC<SpatialSettingsPanelProps> = ({ audioCtx, spatialMode }) => {
  const [channelCount, setChannelCount] = useState(() => parseInt(localStorage.getItem('spatial_channels') || '2'));
  const [testingId, setTestingId] = useState<string | null>(null);
  const [osWarning, setOsWarning] = useState(false);

  useEffect(() => {
    if (audioCtx && audioCtx.destination.maxChannelCount < 6 && channelCount > 2) {
      setOsWarning(true);
    } else {
      setOsWarning(false);
    }
  }, [audioCtx, channelCount]);

  const handleChannelCountChange = (count: number) => {
    setChannelCount(count);
    localStorage.setItem('spatial_channels', String(count));
    window.location.reload();
  };

  const testSpeaker = async (id: string) => {
    if (testingId === id || !audioCtx) return;
    setTestingId(id);

    try {
      await audioCtx.resume();

      const oscillator = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const merger = audioCtx.createChannelMerger(6);

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);

      gain.gain.setValueAtTime(0, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.1);
      gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 1.0);

      oscillator.connect(gain);
      gain.connect(merger, 0, parseInt(id));
      merger.connect(audioCtx.destination);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 1.0);

      setTimeout(() => setTestingId(null), 1000);
    } catch (e) {
      console.error(e);
      setTestingId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <Speaker className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-headline font-bold text-on-surface text-lg">Spatial Audio Configuration</h2>
            <p className="text-[11px] text-outline">Configure multi-channel output for 5.1/7.1 systems</p>
          </div>
        </div>
      </div>

      <section className="bg-surface-container-low border border-outline-variant/10 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-headline font-bold text-sm flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-primary" />
            Output Layout
          </h3>
          <div className="flex items-center gap-2">
            <div className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
              spatialMode === '5.1'
                ? 'bg-primary/20 text-primary'
                : 'bg-surface-container-high text-outline'
            }`}>
              {spatialMode === '5.1' ? '5.1 Active' : 'Stereo (HRTF)'}
            </div>
            <div className="flex bg-surface-container-high rounded-lg p-1 border border-white/5">
              {[2, 6].map(count => (
                <button
                  key={count}
                  onClick={() => handleChannelCountChange(count)}
                  className={cn(
                    "px-4 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all",
                    channelCount === count
                      ? "bg-primary text-on-primary shadow-lg"
                      : "text-outline hover:text-on-surface"
                  )}
                >
                  {count === 2 ? 'Stereo' : '5.1 Surround'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {osWarning && (
          <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-[11px] font-bold text-amber-200 uppercase tracking-tight">System Limitation Detected</p>
              <p className="text-[10px] text-amber-200/70 leading-relaxed">
                Your browser or OS reports a maximum of 2 output channels. 5.1 audio may be downmixed to stereo unless you enable "Surround Sound" in your OS sound settings.
              </p>
            </div>
          </div>
        )}

        <div className="relative aspect-video bg-black/40 rounded-2xl border border-white/5 overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-primary/10 border border-primary/30 rounded-full flex items-center justify-center">
            <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            <div className="absolute -top-6 text-[8px] font-black uppercase text-primary/60 tracking-widest">Listener</div>
          </div>

          {CHANNELS.map(ch => {
            const isEnabled = channelCount >= 6 || parseInt(ch.id) < 2;
            const isTesting = testingId === ch.id;
            return (
              <div
                key={ch.id}
                className="absolute transition-all duration-500"
                style={{ left: `${ch.x}%`, top: `${ch.y}%` }}
              >
                <button
                  disabled={!isEnabled}
                  onClick={() => testSpeaker(ch.id)}
                  className={cn(
                    "relative w-10 h-10 rounded-lg border-2 flex flex-col items-center justify-center transition-all group/spk",
                    !isEnabled ? "opacity-20 grayscale scale-90 border-transparent" :
                    isTesting ? "bg-primary border-primary scale-110 shadow-lg shadow-primary/40" :
                    "bg-surface-container-high border-white/10 hover:border-primary/50 hover:bg-surface-container-highest"
                  )}
                >
                  <span className={cn(
                    "text-[10px] font-black leading-none",
                    isTesting ? "text-on-primary" : "text-outline group-hover/spk:text-primary"
                  )}>
                    {ch.short}
                  </span>
                  <div className={cn(
                    "absolute -bottom-5 whitespace-nowrap text-[8px] font-bold uppercase tracking-wider transition-opacity",
                    isTesting ? "opacity-100 text-primary" : "opacity-0 group-hover/spk:opacity-100 text-outline"
                  )}>
                    {ch.label}
                  </div>
                  {isTesting && (
                    <div className="absolute inset-0 rounded-lg border-2 border-primary animate-ping opacity-50" />
                  )}
                </button>
              </div>
            );
          })}

          <div className="absolute bottom-4 left-4 flex items-center gap-2">
            <Info className="w-3.5 h-3.5 text-outline/40" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-outline/40">Click speakers to test output</span>
          </div>
        </div>
      </section>

    </div>
  );
};
