import React, { useState, useEffect, useMemo } from 'react';
import { TrendingUp, AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';
import {
  scaleToHard, parseLevel, THRESHOLDS, monsterMultiplier, parseCR, crToXP,
} from '../lib/encounterScaling';
import type { Combatant, Player } from '../types';

interface ScaleEncounterModalProps {
  isOpen: boolean;
  onClose: () => void;
  combatants: Combatant[];
  players: Player[];
  onApply: (changes: { id: string; hp: number; ac: number }[], difficultyLabel: string) => void;
}

type Difficulty = 'easy' | 'medium' | 'hard' | 'deadly' | 'beyond';

const DIFFICULTY_INDEX: Record<Exclude<Difficulty, 'beyond'>, 0 | 1 | 2 | 3> = {
  easy: 0, medium: 1, hard: 2, deadly: 3,
};

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'Easy', medium: 'Medium', hard: 'Hard', deadly: 'Deadly', beyond: 'Beyond Deadly',
};

const difficultyColor: Record<string, string> = {
  Trivial: 'text-outline', Easy: 'text-green-400', Medium: 'text-yellow-400',
  Hard: 'text-orange-400', Deadly: 'text-red-400', 'Beyond Deadly': 'text-purple-400',
};

const BEYOND_PRESETS = [1.5, 2, 3];

function detectPartyLevel(players: Player[]): number {
  if (players.length === 0) return 1;
  return Math.max(1, Math.round(
    players.reduce((s, p) => s + Math.max(p.level ?? 0, parseLevel(p.subtitle)), 0) / players.length,
  ));
}

function currentDifficultyLabel(combatants: Combatant[], players: Player[]): string {
  const monsters = combatants.filter(c => c.type !== 'player');
  if (monsters.length === 0 || players.length === 0) return '—';
  const level = Math.min(20, detectPartyLevel(players));
  const partySize = players.length;
  const thresholds = THRESHOLDS[level] ?? THRESHOLDS[1];
  const rawXP = monsters.reduce((s, m) => {
    const cr = parseCR(m.subtitle);
    return s + (cr ? crToXP(cr) : 0);
  }, 0);
  const adj = rawXP * monsterMultiplier(monsters.length);
  const [easy, medium, hard, deadly] = thresholds.map(t => t * partySize);
  if (adj >= deadly) return 'Deadly';
  if (adj >= hard) return 'Hard';
  if (adj >= medium) return 'Medium';
  if (adj >= easy) return 'Easy';
  return 'Trivial';
}

export const ScaleEncounterModal: React.FC<ScaleEncounterModalProps> = ({
  isOpen, onClose, combatants, players, onApply,
}) => {
  const detectedLevel = useMemo(() => detectPartyLevel(players), [players]);
  const [overrideLevel, setOverrideLevel] = useState(detectedLevel);
  const [difficulty, setDifficulty] = useState<Difficulty>('hard');
  const [deadlyMultiplier, setDeadlyMultiplier] = useState(1.5);
  const [edits, setEdits] = useState<Record<string, { hp: number; ac: number }>>({});

  useEffect(() => {
    if (isOpen) {
      setOverrideLevel(detectPartyLevel(players));
      setDifficulty('hard');
      setDeadlyMultiplier(1.5);
      setEdits({});
    }
  }, [isOpen, players]);

  useEffect(() => { setEdits({}); }, [overrideLevel, difficulty, deadlyMultiplier]);

  const diffIdx = difficulty === 'beyond' ? 3 : DIFFICULTY_INDEX[difficulty];
  const multiplier = difficulty === 'beyond' ? deadlyMultiplier : 1;

  const rows = useMemo(
    () => scaleToHard(combatants, players, overrideLevel, diffIdx, multiplier),
    [combatants, players, overrideLevel, diffIdx, multiplier],
  );

  const getHP = (id: string, proposed: number) => edits[id]?.hp ?? proposed;
  const getAC = (id: string, proposed: number) => edits[id]?.ac ?? proposed;

  const targetLabel = difficulty === 'beyond'
    ? `Beyond Deadly ×${deadlyMultiplier}`
    : DIFFICULTY_LABEL[difficulty];

  const handleApply = () => {
    onApply(rows.map(r => ({ id: r.id, hp: getHP(r.id, r.proposedHP), ac: getAC(r.id, r.proposedAC) })), targetLabel);
    onClose();
  };

  const currentLabel = useMemo(
    () => currentDifficultyLabel(combatants, players),
    [combatants, players],
  );

  const targetColor = difficulty === 'beyond' ? 'text-purple-400'
    : difficulty === 'deadly' ? 'text-red-400'
    : difficulty === 'hard' ? 'text-orange-400'
    : difficulty === 'medium' ? 'text-yellow-400'
    : 'text-green-400';

  const DIFFICULTY_BUTTON_STYLE: Record<Difficulty, string> = {
    easy:   'data-[active=true]:bg-green-600  data-[active=true]:text-white',
    medium: 'data-[active=true]:bg-yellow-600 data-[active=true]:text-white',
    hard:   'data-[active=true]:bg-orange-600 data-[active=true]:text-white',
    deadly: 'data-[active=true]:bg-red-700    data-[active=true]:text-white',
    beyond: 'data-[active=true]:bg-purple-700 data-[active=true]:text-white',
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Scale Difficulty" size="lg">
      <div className="space-y-5">
        {/* Party controls */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-xs text-outline uppercase tracking-wider font-bold">Party level</label>
            <input
              type="number"
              min={1}
              max={20}
              value={overrideLevel}
              onChange={e => setOverrideLevel(Math.min(20, Math.max(1, parseInt(e.target.value, 10) || 1)))}
              className="w-14 text-center bg-surface-container border border-white/10 rounded-lg text-on-surface text-sm py-1 outline-none focus:border-primary/60"
            />
          </div>
          <div className="text-xs text-outline">
            {players.length} player{players.length !== 1 ? 's' : ''}
            {detectedLevel !== overrideLevel && (
              <span className="ml-1 text-primary/70">(auto: {detectedLevel})</span>
            )}
          </div>
          <div className="ml-auto text-xs font-bold">
            <span className={difficultyColor[currentLabel] ?? 'text-outline'}>
              Now: {currentLabel}
            </span>
            <span className="text-outline mx-2">→</span>
            <span className={targetColor}>Target: {targetLabel}</span>
          </div>
        </div>

        {/* Difficulty selector */}
        <div className="flex gap-1 flex-wrap">
          {(['easy', 'medium', 'hard', 'deadly', 'beyond'] as Difficulty[]).map(d => (
            <button
              key={d}
              data-active={difficulty === d}
              onClick={() => setDifficulty(d)}
              className={`px-3 py-1 text-xs rounded-lg border border-white/10 text-outline hover:text-on-surface transition-colors ${DIFFICULTY_BUTTON_STYLE[d]}`}
            >
              {DIFFICULTY_LABEL[d]}
            </button>
          ))}
        </div>

        {/* Beyond Deadly multiplier controls */}
        {difficulty === 'beyond' && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-outline">Multiplier:</span>
            {BEYOND_PRESETS.map(p => (
              <button
                key={p}
                data-active={deadlyMultiplier === p}
                onClick={() => setDeadlyMultiplier(p)}
                className="px-2 py-0.5 text-xs rounded border border-white/10 text-outline hover:text-on-surface transition-colors data-[active=true]:bg-purple-700 data-[active=true]:text-white"
              >
                ×{p}
              </button>
            ))}
            <input
              type="number"
              min={1.1}
              max={10}
              step={0.1}
              value={deadlyMultiplier}
              onChange={e => setDeadlyMultiplier(Math.max(1.1, Math.min(10, parseFloat(e.target.value) || 1.5)))}
              className="w-16 text-center bg-surface-container border border-white/10 rounded text-on-surface text-xs py-0.5 outline-none focus:border-primary/60"
            />
          </div>
        )}

        {/* Proposal table */}
        {rows.length === 0 ? (
          <p className="text-sm text-outline text-center py-8">No monster combatants to scale.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-outline border-b border-white/10">
                  <th className="text-left pb-2 font-bold">Monster</th>
                  <th className="text-center pb-2 font-bold">CR</th>
                  <th className="text-center pb-2 font-bold">→ CR</th>
                  <th className="text-center pb-2 font-bold">HP</th>
                  <th className="text-center pb-2 font-bold">→ HP</th>
                  <th className="text-center pb-2 font-bold">AC</th>
                  <th className="text-center pb-2 font-bold">→ AC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.map(r => (
                  <tr key={r.id} className="group">
                    <td className="py-2 pr-3 font-medium text-on-surface truncate max-w-[140px]">
                      {r.currentCR === null && (
                        <AlertTriangle className="inline w-3 h-3 text-yellow-500 mr-1 shrink-0" />
                      )}
                      {r.name}
                    </td>
                    <td className="text-center py-2 text-outline">{r.currentCR ?? '?'}</td>
                    <td className={`text-center py-2 font-bold ${targetColor}`}>{r.targetCR}</td>
                    <td className="text-center py-2 text-outline">{r.currentHP}</td>
                    <td className="text-center py-2">
                      <input
                        type="number"
                        min={1}
                        value={getHP(r.id, r.proposedHP)}
                        onChange={e => setEdits(prev => ({
                          ...prev,
                          [r.id]: { ac: getAC(r.id, r.proposedAC), hp: Math.max(1, parseInt(e.target.value, 10) || 1) },
                        }))}
                        className="w-16 text-center bg-surface-container border border-white/10 rounded text-on-surface text-sm py-0.5 outline-none focus:border-primary/60"
                      />
                    </td>
                    <td className="text-center py-2 text-outline">{r.currentAC}</td>
                    <td className="text-center py-2">
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={getAC(r.id, r.proposedAC)}
                        onChange={e => setEdits(prev => ({
                          ...prev,
                          [r.id]: { hp: getHP(r.id, r.proposedHP), ac: Math.min(30, Math.max(1, parseInt(e.target.value, 10) || 1)) },
                        }))}
                        className="w-14 text-center bg-surface-container border border-white/10 rounded text-on-surface text-sm py-0.5 outline-none focus:border-primary/60"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-outline hover:text-on-surface transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={rows.length === 0}
            className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-40 ${
              difficulty === 'beyond' ? 'bg-purple-700 hover:bg-purple-600'
              : difficulty === 'deadly' ? 'bg-red-700 hover:bg-red-600'
              : 'bg-orange-600 hover:bg-orange-500'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Apply Changes
          </button>
        </div>
      </div>
    </Modal>
  );
};
