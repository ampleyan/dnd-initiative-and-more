import React, { useState, useCallback } from 'react';
import { UploadCloud } from 'lucide-react';
import { cn } from '../../lib/utils';
import { MappedEntity, processJson } from './helpers';
import { parseFoundryJournal } from '../../lib/adventureParser';

interface FileDropZoneProps {
  onEntitiesParsed: (entities: MappedEntity[]) => void;
}

export const FileDropZone = React.memo<FileDropZoneProps>(({ onEntitiesParsed }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isJournalFile, setIsJournalFile] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/json') {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const content = event.target?.result as string;
          const json = JSON.parse(content);

          if (isJournalFile) {
            const encounters = parseFoundryJournal(content);
            if (encounters.length > 0) {
              const mapped = encounters.map(enc => ({
                id: enc.id || Math.random().toString(36).substr(2, 9),
                name: enc.name,
                type: 'Encounter',
                format: 'Foundry Journal',
                status: 'detected' as const,
                data: enc,
              }));
              onEntitiesParsed(mapped);
            }
          } else {
            const entities = await processJson(json);
            onEntitiesParsed(entities);
          }
        } catch (err) {
          console.error("Failed to parse JSON", err);
        }
      };
      reader.readAsText(file);
    }
  }, [isJournalFile, onEntitiesParsed]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 bg-surface-container-low p-2.5 rounded-xl border border-white/5">
        <label className="flex items-center gap-2 cursor-pointer group">
          <div
            onClick={() => setIsJournalFile(!isJournalFile)}
            className={`relative w-8 h-4 rounded-full transition-colors ${isJournalFile ? 'bg-primary' : 'bg-surface-container-highest border border-outline/30'}`}
          >
            <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${isJournalFile ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-outline group-hover:text-on-surface">Foundry Journal Mode</span>
        </label>
        <p className="text-[9px] text-outline italic">Enables parsing of Foundry VTT Journal JSON exports</p>
      </div>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative h-36 rounded-2xl border-2 border-dashed transition-all flex items-center justify-center gap-4 cursor-pointer",
          isDragging ? "border-primary bg-primary/5" : "border-white/10 bg-surface-container-low hover:border-white/20"
        )}
      >
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-all", isDragging ? "bg-primary text-on-primary" : "bg-white/5 text-outline")}>
          <UploadCloud className="w-5 h-5" />
        </div>
        <div>
          <p className="text-sm font-bold">{isDragging ? 'Drop to import' : 'Drop JSON file here'}</p>
          <p className="text-[11px] text-outline opacity-60">
            {isJournalFile ? 'Foundry VTT Journal JSON' : 'Improved Initiative, 5etools, generic JSON'}
          </p>
        </div>
      </div>
    </div>
  );
});
FileDropZone.displayName = 'FileDropZone';
