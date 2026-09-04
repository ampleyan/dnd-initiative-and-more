import React, { useState, useCallback } from 'react';
import { Upload, CheckSquare, Square } from 'lucide-react';
import { Modal } from './Modal';
import { parseSessionBoard } from '../lib/adventureParser';
import { cn } from '../lib/utils';
import type { SessionBoardProposal } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onStart: (name: string, proposal: SessionBoardProposal) => void;
}

type SourceType = 'upload-md' | 'upload-foundry' | 'paste';
type Step = 'source' | 'review';

export const SessionBoardConfigModal: React.FC<Props> = ({ isOpen, onClose, onStart }) => {
  const [step, setStep] = useState<Step>('source');
  const [sourceType, setSourceType] = useState<SourceType>('upload-md');
  const [pasteText, setPasteText] = useState('');
  const [boardName, setBoardName] = useState('');
  const [proposal, setProposal] = useState<SessionBoardProposal>({});
  const [error, setError] = useState('');

  const [includeEntityList, setIncludeEntityList] = useState(true);
  const [includeStateMachine, setIncludeStateMachine] = useState(true);
  const [includeToggle, setIncludeToggle] = useState(true);

  const runParser = useCallback((text: string, name: string) => {
    const parsed = parseSessionBoard(text);
    setProposal(parsed);
    setBoardName(name || 'Session Board');
    setIncludeEntityList(!!parsed.entityList);
    setIncludeStateMachine(!!parsed.stateMachine);
    setIncludeToggle(!!parsed.toggle);
    setStep('review');
    setError('');
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'md' | 'foundry') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      if (type === 'foundry') {
        try {
          JSON.parse(text);
          runParser(text, file.name.replace(/\.[^.]+$/, ''));
        } catch {
          setError('Invalid Foundry JSON file.');
        }
      } else {
        runParser(text, file.name.replace(/\.[^.]+$/, ''));
      }
    };
    reader.readAsText(file);
  };

  const handlePasteParse = () => {
    if (!pasteText.trim()) { setError('Paste some text first.'); return; }
    runParser(pasteText, 'Pasted Session');
  };

  const handleStart = () => {
    const filtered: SessionBoardProposal = {
      entityList: includeEntityList ? proposal.entityList : undefined,
      stateMachine: includeStateMachine ? proposal.stateMachine : undefined,
      toggle: includeToggle ? proposal.toggle : undefined,
    };
    onStart(boardName, filtered);
    setStep('source');
    setPasteText('');
    setError('');
  };

  const hasAnything = proposal.entityList || proposal.stateMachine || proposal.toggle;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Configure Session Board" size="lg">
      {step === 'source' && (
        <div className="space-y-4">
          {error && <p className="text-sm text-error">{error}</p>}
          <div className="flex gap-2">
            {(['upload-md', 'upload-foundry', 'paste'] as SourceType[]).map(t => (
              <button key={t}
                onClick={() => { setSourceType(t); setError(''); }}
                className={cn(
                  'flex-1 py-2 rounded-xl border text-sm transition-colors',
                  sourceType === t
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-outline-variant/30 text-outline hover:border-outline'
                )}>
                {t === 'upload-md' && 'Markdown file'}
                {t === 'upload-foundry' && 'Foundry JSON'}
                {t === 'paste' && 'Paste text'}
              </button>
            ))}
          </div>

          {(sourceType === 'upload-md' || sourceType === 'upload-foundry') && (
            <label className="flex flex-col items-center gap-3 border-2 border-dashed border-outline-variant/30 rounded-2xl p-8 cursor-pointer hover:border-primary/50 transition-colors">
              <Upload className="w-8 h-8 text-outline" />
              <span className="text-sm text-outline">
                {sourceType === 'upload-md' ? 'Click to upload .md file' : 'Click to upload Foundry .json file'}
              </span>
              <input
                type="file"
                className="hidden"
                accept={sourceType === 'upload-md' ? '.md,.txt' : '.json'}
                onChange={e => handleFileUpload(e, sourceType === 'upload-md' ? 'md' : 'foundry')}
              />
            </label>
          )}

          {sourceType === 'paste' && (
            <div className="space-y-2">
              <textarea
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                placeholder="Paste chapter text here…"
                rows={8}
                className="w-full bg-surface-container px-3 py-2 rounded-xl border border-outline-variant/30 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-primary resize-none custom-scrollbar"
              />
              <button onClick={handlePasteParse}
                className="w-full py-2 bg-primary text-on-primary rounded-xl text-sm hover:bg-primary/90 transition-colors">
                Parse
              </button>
            </div>
          )}
        </div>
      )}

      {step === 'review' && (
        <div className="space-y-4">
          <div>
            <label className="text-xs text-outline uppercase tracking-wider">Board name</label>
            <input
              value={boardName}
              onChange={e => setBoardName(e.target.value)}
              className="w-full mt-1 bg-surface-container px-3 py-2 rounded-xl border border-outline-variant/30 text-sm text-on-surface focus:outline-none focus:border-primary"
            />
          </div>

          {!hasAnything && (
            <p className="text-sm text-outline">
              No patterns detected in the text. You can start with an empty board and add widgets manually.
            </p>
          )}

          {proposal.entityList && (
            <div className="border border-outline-variant/20 rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2">
                <button onClick={() => setIncludeEntityList(v => !v)}>
                  {includeEntityList ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4 text-outline" />}
                </button>
                <span className="text-sm font-semibold">{proposal.entityList.title}</span>
                <span className="text-xs text-outline ml-auto">{proposal.entityList.entries.length} entries detected</span>
              </div>
              {includeEntityList && (
                <ul className="text-xs text-outline space-y-1 pl-6 max-h-32 overflow-y-auto custom-scrollbar">
                  {proposal.entityList.entries.map((e, i) => (
                    <li key={i} className="flex gap-2">
                      <span>{e.displayName}</span>
                      {e.trueName && <span className="text-amber-400">→ "{e.trueName}"</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {proposal.stateMachine && (
            <div className="border border-outline-variant/20 rounded-xl p-3">
              <div className="flex items-center gap-2">
                <button onClick={() => setIncludeStateMachine(v => !v)}>
                  {includeStateMachine ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4 text-outline" />}
                </button>
                <span className="text-sm font-semibold">{proposal.stateMachine.title}</span>
                <span className="text-xs text-outline ml-auto">
                  {proposal.stateMachine.states.map(s => s.label).join(' → ')}
                </span>
              </div>
            </div>
          )}

          {proposal.toggle && (
            <div className="border border-outline-variant/20 rounded-xl p-3">
              <div className="flex items-center gap-2">
                <button onClick={() => setIncludeToggle(v => !v)}>
                  {includeToggle ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4 text-outline" />}
                </button>
                <span className="text-sm font-semibold">{proposal.toggle.title}</span>
                <span className="text-xs text-outline ml-auto">
                  {proposal.toggle.values.map(v => v.label).join(' / ')}
                </span>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button onClick={() => setStep('source')}
              className="flex-1 py-2 rounded-xl border border-outline-variant/30 text-sm text-outline hover:border-outline transition-colors">
              Back
            </button>
            <button onClick={handleStart}
              className="flex-1 py-2 bg-primary text-on-primary rounded-xl text-sm hover:bg-primary/90 transition-colors">
              Start Session Board
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};
