import React, { useState, useEffect } from 'react';
import { Save, Zap, Loader2 } from 'lucide-react';
import { Modal } from './Modal';
import { Sound } from '../types';

interface SaveEncounterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, folder: string, backgroundImage?: string, youtubeUrl?: string, soundIds?: string[]) => void;
  isSaving?: boolean;
  initialName?: string;
  initialFolder?: string;
  initialBackgroundImage?: string;
  initialYoutubeUrl?: string;
  initialSoundIds?: string[];
  existingFolders?: string[];
  sounds?: Sound[];
  title?: string;
}

export const SaveEncounterModal: React.FC<SaveEncounterModalProps> = ({
  isOpen,
  onClose,
  onSave,
  isSaving = false,
  initialName = '',
  initialFolder = '',
  initialBackgroundImage = '',
  initialYoutubeUrl = '',
  initialSoundIds = [],
  existingFolders = [],
  sounds = [],
  title = 'Save Encounter',
}) => {
  const [name, setName] = useState(initialName);
  const [folder, setFolder] = useState(initialFolder);
  const [backgroundImage, setBackgroundImage] = useState(initialBackgroundImage);
  const [youtubeUrl, setYoutubeUrl] = useState(initialYoutubeUrl);
  const [selectedSoundIds, setSelectedSoundIds] = useState<string[]>(initialSoundIds);

  useEffect(() => {
    setName(initialName);
    setFolder(initialFolder);
    setBackgroundImage(initialBackgroundImage);
    setYoutubeUrl(initialYoutubeUrl);
    setSelectedSoundIds(initialSoundIds);
  }, [initialName, initialFolder, initialBackgroundImage, initialYoutubeUrl, isOpen]);

  const uniqueFolders = Array.from(new Set(existingFolders.filter(Boolean))).sort();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-outline">Encounter Name</label>
          <input
            className="w-full bg-surface-container-high border-none rounded-lg px-4 py-2 text-sm focus:ring-1 focus:ring-primary"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Enter encounter name..."
            autoFocus
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-outline">Location / Group <span className="text-outline/40 normal-case font-normal">optional</span></label>
          <input
            className="w-full bg-surface-container-high border-none rounded-lg px-4 py-2 text-sm focus:ring-1 focus:ring-primary"
            value={folder}
            onChange={e => setFolder(e.target.value)}
            placeholder="e.g. Undermountain, Act 1, Session 3..."
            list="folder-suggestions"
          />
          {uniqueFolders.length > 0 && (
            <datalist id="folder-suggestions">
              {uniqueFolders.map(f => <option key={f} value={f} />)}
            </datalist>
          )}
          {uniqueFolders.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {uniqueFolders.map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFolder(f)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${
                    folder === f
                      ? 'bg-primary/15 border-primary/30 text-primary'
                      : 'bg-surface-container-highest border-outline-variant/20 text-outline hover:text-on-surface'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-outline">Background Image URL</label>
          <input
            className="w-full bg-surface-container-high border-none rounded-lg px-4 py-2 text-sm focus:ring-1 focus:ring-primary"
            value={backgroundImage}
            onChange={e => setBackgroundImage(e.target.value)}
            placeholder="https://..."
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-outline">Ambient Music URL (YouTube)</label>
          <input
            className="w-full bg-surface-container-high border-none rounded-lg px-4 py-2 text-sm focus:ring-1 focus:ring-primary"
            value={youtubeUrl}
            onChange={e => setYoutubeUrl(e.target.value)}
            placeholder="https://youtube.com/..."
          />
        </div>

        {sounds.length > 0 && (
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-bold text-outline flex items-center gap-1.5">
              <Zap className="w-3 h-3" /> Auto-play Sounds <span className="text-outline/40 normal-case font-normal">optional</span>
            </label>
            <div className="flex flex-col gap-1 max-h-36 overflow-y-auto pr-1">
              {sounds.map(s => {
                const selected = selectedSoundIds.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedSoundIds(prev => selected ? prev.filter(id => id !== s.id) : [...prev, s.id])}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs transition-all border ${selected ? 'bg-primary/15 border-primary/30 text-primary' : 'bg-surface-container-highest border-outline/10 text-outline hover:text-on-surface hover:bg-white/5'}`}
                  >
                    <span className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center ${selected ? 'bg-primary border-primary' : 'border-outline/40'}`}>
                      {selected && <span className="text-[7px] font-black text-on-primary leading-none">✓</span>}
                    </span>
                    <span className="truncate font-medium">{s.name}</span>
                    <span className="ml-auto text-[9px] opacity-50 capitalize flex-shrink-0">{s.category}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <button
          onClick={() => { if (!isSaving) { onSave(name, folder, backgroundImage, youtubeUrl, selectedSoundIds); onClose(); } }}
          disabled={isSaving}
          className="w-full bg-primary text-on-primary py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {isSaving ? 'Saving…' : title}
        </button>
      </div>
    </Modal>
  );
};
