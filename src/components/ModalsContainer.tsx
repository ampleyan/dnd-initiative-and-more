import React from 'react';
import { Combatant, Encounter, MonsterTemplate, Player, Sound, Spell } from '../types';
import { EditCombatantModal } from './EditCombatantModal';
import { StatusManagerModal } from './StatusManagerModal';
import { InitiativeModal } from './InitiativeModal';
import { QuickActionModal } from './QuickActionModal';
import { SaveEncounterModal } from './SaveEncounterModal';
import { EditMonsterModal } from './EditMonsterModal';

interface ModalsContainerProps {
  isEditModalOpen: boolean;
  setIsEditModalOpen: (open: boolean) => void;
  editingCombatant: Combatant | undefined;
  editingCombatantDisplayName?: string;
  handleUpdateCombatant: (updated: Combatant) => void;
  handleDeleteCombatant: (id: string) => void;

  isStatusModalOpen: boolean;
  setIsStatusModalOpen: (open: boolean) => void;

  isInitiativeModalOpen: boolean;
  setIsInitiativeModalOpen: (open: boolean) => void;
  combatants: Combatant[];
  handleFinishInitiative: (updatedCombatants: Combatant[]) => void;
  players?: Player[];
  handleAddPlayerToEncounter?: (player: Player) => void;

  isQuickActionModalOpen: boolean;
  setIsQuickActionModalOpen: (open: boolean) => void;
  quickActionCombatant: Combatant | undefined;
  quickActionDisplayName?: string;
  quickActionCombatantId?: string | null;
  quickActionMode?: 'damage' | 'heal' | 'tempHp' | null;
  triggerConCheck?: (combatantId: string, dc: number) => void;

  isSaveEncounterModalOpen: boolean;
  setIsSaveEncounterModalOpen: (open: boolean) => void;
  handleSaveEncounter: (name: string, overrideCombatants?: Combatant[], backgroundImage?: string, youtubeUrl?: string, folder?: string, difficulty?: string, backgroundOpacity?: number, panelOpacity?: number, soundIds?: string[]) => void;
  isSaving?: boolean;
  encounterName: string;
  currentEncounterId: string | null;
  savedEncounters: Encounter[];
  sounds?: Sound[];

  isMonsterEditModalOpen: boolean;
  setIsMonsterEditModalOpen: (open: boolean) => void;
  editingMonster: MonsterTemplate | undefined;
  handleUpdateMonster: (updated: MonsterTemplate) => void;
  spells?: Spell[];
}

export const ModalsContainer: React.FC<ModalsContainerProps> = ({
  isEditModalOpen,
  setIsEditModalOpen,
  editingCombatant,
  editingCombatantDisplayName,
  handleUpdateCombatant,
  handleDeleteCombatant,

  isStatusModalOpen,
  setIsStatusModalOpen,

  isInitiativeModalOpen,
  setIsInitiativeModalOpen,
  combatants,
  handleFinishInitiative,
  players,
  handleAddPlayerToEncounter,

  isQuickActionModalOpen,
  setIsQuickActionModalOpen,
  quickActionCombatant,
  quickActionDisplayName,
  quickActionCombatantId,
  quickActionMode,
  triggerConCheck,

  isSaveEncounterModalOpen,
  setIsSaveEncounterModalOpen,
  handleSaveEncounter,
  isSaving,
  encounterName,
  currentEncounterId,
  savedEncounters,
  sounds = [],

  isMonsterEditModalOpen,
  setIsMonsterEditModalOpen,
  editingMonster,
  handleUpdateMonster,
  spells,
}) => {
  return (
    <>
      <EditCombatantModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        combatant={editingCombatant || null}
        displayName={editingCombatantDisplayName}
        onSave={handleUpdateCombatant}
        onDelete={handleDeleteCombatant}
      />
      <StatusManagerModal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        combatant={editingCombatant || null}
        onUpdate={handleUpdateCombatant}
        spells={spells}
        onBreakConcentration={(actor) => {
          if (!actor.concentrationTargets) return;
          for (const [targetId, appliedConditions] of Object.entries(actor.concentrationTargets)) {
            const target = combatants.find(c => c.id === targetId);
            if (!target || appliedConditions.length === 0) continue;
            handleUpdateCombatant({ ...target, conditions: target.conditions.filter(c => !appliedConditions.includes(c)) });
          }
        }}
      />
      <InitiativeModal
        isOpen={isInitiativeModalOpen}
        onClose={() => setIsInitiativeModalOpen(false)}
        combatants={combatants}
        onFinish={handleFinishInitiative}
        players={players}
        onAddPlayer={handleAddPlayerToEncounter}
      />
      <QuickActionModal
        isOpen={isQuickActionModalOpen}
        onClose={() => setIsQuickActionModalOpen(false)}
        combatant={quickActionCombatant || null}
        displayName={quickActionDisplayName}
        initialMode={quickActionMode ?? undefined}
        onUpdate={handleUpdateCombatant}
        onConcentrationCheck={(dc) => { if (quickActionCombatantId) triggerConCheck?.(quickActionCombatantId, dc); }}
      />
      <SaveEncounterModal
        isOpen={isSaveEncounterModalOpen}
        onClose={() => setIsSaveEncounterModalOpen(false)}
        onSave={(name, folder, bg, yt, soundIds) => handleSaveEncounter(name, undefined, bg, yt, folder, undefined, undefined, undefined, soundIds)}
        isSaving={isSaving}
        initialName={encounterName}
        initialFolder={savedEncounters.find(e => e.id === currentEncounterId)?.folder ?? ''}
        initialBackgroundImage={savedEncounters.find(e => e.id === currentEncounterId)?.backgroundImage ?? ''}
        initialYoutubeUrl={savedEncounters.find(e => e.id === currentEncounterId)?.youtubeUrl ?? ''}
        initialSoundIds={savedEncounters.find(e => e.id === currentEncounterId)?.soundIds ?? []}
        existingFolders={savedEncounters.map(e => e.folder ?? '').filter(Boolean)}
        sounds={sounds}
        title={currentEncounterId ? "Save Encounter" : "New Encounter"}
      />
      <EditMonsterModal
        isOpen={isMonsterEditModalOpen}
        onClose={() => setIsMonsterEditModalOpen(false)}
        monster={editingMonster || null}
        onSave={handleUpdateMonster}
        spellLibrary={spells}
      />
    </>
  );
};
