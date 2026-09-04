export type CombatantType = 'player' | 'monster' | 'npc';

export type SpellSlots = Partial<Record<number, { total: number; used: number }>>;
// level keys 1-9, e.g. { 1: { total: 4, used: 1 }, 2: { total: 3, used: 0 } }

export type FeatureUses = Record<string, {  // key = featureId
  name: string;
  total: number;
  used: number;
  restType: 'short' | 'long';
}>;

export type AnimationLevel = 'none' | 'minimal' | 'typed' | 'full';

export interface Condition {
  id: string;
  name: string;
  icon: string;
  description: string;
  color: string;
}

export interface PolymorphForm {
  originalHp: { current: number; max: number };
  originalAc: number;
  originalStats: { str: number; dex: number; con: number; int: number; wis: number; cha: number };
  originalName: string;
  originalSubtitle?: string;
  originalAvatar?: string;
  originalSpeed?: string;
}

export interface Combatant {
  id: string;
  encounterId?: string;
  name: string;
  type: CombatantType;
  initiative: number;
  hp: {
    current: number;
    max: number;
  };
  ac: number;
  speed: string;
  subtitle: string;
  avatar: string;
  tempHp?: number;
  conditions: string[]; // IDs of conditions
  tags: string[]; // Custom tags
  customTagDescriptions?: Record<string, string>;
  stats: {
    str: number;
    dex: number;
    con: number;
    int: number;
    wis: number;
    cha: number;
  };
  vulnerabilities?: string[];
  resistances?: string[];
  damageImmunities?: string[];
  conditionImmunities?: string[];
  actions?: MonsterAction[];
  abilities?: MonsterAction[];
  spells?: MonsterAction[];
  spellIds?: string[]; // IDs of matched spells from the Spell library
  featureIds?: string[];
  deathSaves?: { successes: number; failures: number; stable: boolean };
  legendaryActions?: { max: number; remaining: number };
  reactionUsed?: boolean;
  conditionTimers?: Record<string, number>;
  concentratingOn?: string;
  concentrationTargets?: Record<string, string[]>;
  isCurrentTurn?: boolean;
  ownerId?: string;
  playerId?: string;
  isFriendly?: boolean;
  spellSlots?: SpellSlots;
  featureUses?: FeatureUses;
  polymorphForm?: PolymorphForm;
}

export interface MonsterAction {
  name: string;
  description: string;
  category?: 'attack' | 'spell' | 'ability' | 'custom';
}

export interface MonsterTemplate {
  id: string;
  name: string;
  cr: string;
  type: string;
  description: string;
  image: string;
  avatar?: string;
  rarity?: 'Common' | 'Legendary' | 'Fey' | 'Undead' | 'Celestial' | 'Construct' | 'Swarm';
  hp: number;
  maxHp?: number;
  ac: number;
  speed: string;
  stats: {
    str: number;
    dex: number;
    con: number;
    int: number;
    wis: number;
    cha: number;
  };
  vulnerabilities?: string[];
  resistances?: string[];
  damageImmunities?: string[];
  conditionImmunities?: string[];
  xp?: number;
  skills?: string;
  actions?: MonsterAction[];
  abilities?: MonsterAction[];
  spells?: MonsterAction[];
  source?: string;
  tags?: string[];
  legendaryActions?: { max: number };
}

export interface Player {
  id: string;
  name: string;
  dndBeyondId?: string;
  level?: number;
  class?: string;
  source?: 'ddb' | 'manual';
  hp_max: number;
  hp_current?: number | null;
  ac: number;
  speed: string;
  subtitle: string;
  avatar: string;
  passivePerception?: number;
  stats: {
    str: number;
    dex: number;
    con: number;
    int: number;
    wis: number;
    cha: number;
  };
  lastImported?: string;
  actions?: MonsterAction[];
  abilities?: MonsterAction[];
  spells?: MonsterAction[];
  spellIds?: string[]; // IDs of matched spells from the Spell library
  featureIds?: string[];
  spellSlots?: SpellSlots;
  featureUses?: FeatureUses;
}

export interface Spell {
  id: string;
  name: string;
  level: number;
  school: string;
  time: string;
  range: string;
  components: string;
  duration: string;
  description: string;
  higherLevels?: string;
  classes?: string[];
  source?: string;
}

export interface ClassFeature {
  id: string;
  name: string;
  className: string;
  classSource: string;
  level: number;
  source: string;
  description: string;
  subclassName?: string;
  isSubclass: boolean;
}

export interface EncounterHighlight {
  icon: string;
  label: string;
  value: string;
}

export interface EncounterStats {
  totalRounds: number;
  playersAlive: number;
  playersFallen: number;
  enemiesDefeated: number;
  enemiesEscaped: number;
  roundDurations?: number[];
  highlights: EncounterHighlight[];
  combatantStats?: Record<string, {
    name: string;
    type: string;
    damageTaken: number;
    healingReceived: number;
    damageDone: number;
    healingDone?: number;
    kills: number;
    timesTargeted?: number;
  }>;
  actionStats?: Record<string, {
    name: string;
    category: string;
    actorName: string;
    totalDamage: number;
    totalHealing: number;
    count: number;
  }>;
  damageByType?: Record<string, number>;
}

export interface AudioScene {
  id: string;
  name: string;
  category: 'combat' | 'exploration' | 'dungeon' | 'city' | 'other';
  sounds: Array<{
    soundId: string;
    volume: number;
    panX: number;
    panZ: number;
    loop: boolean;
  }>;
}

export interface EncounterRoundNote {
  round: number;
  text: string;
}

export interface EncounterNotes {
  general: string;
  rounds: EncounterRoundNote[];
}

export interface Encounter {
  id: string;
  name: string;
  combatants?: Combatant[];
  lastModified: string;
  currentRound?: number;
  currentTurnIndex?: number;
  isEncounterActive?: boolean;
  showSummary?: boolean;
  description?: string;
  players?: number;
  time?: string;
  difficulty?: string;
  cr?: number;
  image?: string;
  backgroundImage?: string;
  youtubeUrl?: string;
  musicUrl?: string;
  folder?: string;
  sessionId?: string | null;
  sessionName?: string;
  campaignId?: string;
  campaignName?: string;
  encounterStats?: EncounterStats;
  trackingData?: Record<string, { damageTaken: number; healingReceived: number; damageDone: number; kills: number; name: string; type: string }>;
  completedAt?: string;
  backgroundOpacity?: number;
  panelOpacity?: number;
  animationLevel?: AnimationLevel;
  soundIds?: string[];
  notes?: EncounterNotes;
  favorite?: boolean;
}

export interface Sound {
  id: string;
  name: string;
  url: string;
  category: string;
  tags: string[];
  spellId: string | null;
  volume: number;
  isFavorite: number;
  createdAt: string;
}
export interface Campaign {
  id: string;
  name: string;
  description: string;
  mapImage?: string;
  createdAt: string;
  sessionCount?: number;
}

export interface Session {
  id: string;
  campaignId: string;
  name: string;
  date: string;
  notes: string;
  createdAt: string;
}

export interface FolderSettings {
  folder: string;
  backgroundImage?: string;
  musicUrl?: string;
}

export interface ParsedCreature {
  rawName: string;
  count: number;
  matchedId?: string;
  matchedName?: string;
  role?: 'combatant' | 'npc' | 'uncertain';
}

export interface ParsedEncounter {
  id?: string;
  name: string;
  chapter?: string;
  creatures: ParsedCreature[];
  description?: string;
}

export type LogEventType =
  | 'round_start' | 'turn_start'
  | 'damage' | 'heal'
  | 'condition_applied' | 'condition_removed'
  | 'creature_downed' | 'creature_stabilized'
  | 'death_save_pass' | 'death_save_fail' | 'death_save_nat20' | 'death_save_nat1'
  | 'encounter_end'
  | 'spell_cast' | 'action_used'
  | 'concentration_start' | 'concentration_end';

export interface LogEntry {
  id: string;
  round: number;
  type: LogEventType;
  actorName: string;
  actorId?: string;
  targetName?: string;
  targetId?: string;
  value?: number;
  detail?: string;
  actionName?: string;
  actionCategory?: 'attack' | 'spell' | 'ability' | 'custom';
  damageType?: string;
}

// ── Session Context Board ─────────────────────────────────────────────────────

export interface EntityListEntry {
  id: string;
  displayName: string;
  trueName?: string;
  status: 'frozen' | 'freed';
  notes?: string;
}

export interface EntityListData {
  entries: EntityListEntry[];
}

export interface StateMachineState {
  label: string;
  color: string; // bg-* Tailwind class, e.g. 'bg-blue-600'
}

export interface StateMachineData {
  entityName: string;
  states: StateMachineState[];
  currentStateIndex: number;
  timerEndsAt?: number; // epoch ms — present when a countdown is active
}

export interface ToggleData {
  values: Array<{ label: string; color: string }>;
  currentIndex: number;
}

// ── Item Tracker ──────────────────────────────────────────────────────────────
export interface ItemTrackerItem {
  id: string;
  name: string;
  location: string;
  states?: string[];          // cycle labels, e.g. ["Silver needles","Golden roses"]
  currentStateIndex?: number; // index into states[]
}
export interface ItemTrackerData {
  items: ItemTrackerItem[];
}

// ── True Names Reference ──────────────────────────────────────────────────────
export interface ReferenceEntry {
  id: string;
  label: string;    // common name shown always, e.g. "Zybilna (archfey)"
  value: string;    // true name, hidden until revealed
  hint?: string;    // optional note, e.g. "NOT Iggwilv, NOT Tasha"
  revealed: boolean;
}
export interface ReferenceData {
  entries: ReferenceEntry[];
}

// ── Faction Board ─────────────────────────────────────────────────────────────
export type NpcStatus = 'unknown' | 'active' | 'frozen' | 'freed' | 'fled' | 'defeated' | 'allied';
export interface FactionNpc {
  id: string;
  name: string;
  location: string;
  status: NpcStatus;
}
export interface Faction {
  id: string;
  name: string;
  color: string;   // Tailwind bg-* class, e.g. 'bg-red-700'
  npcs: FactionNpc[];
}
export interface FactionBoardData {
  factions: Faction[];
}

// ── Checklist ─────────────────────────────────────────────────────────────────
export interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
  source?: string;  // e.g. "From Thinnings, P15"
}
export interface ChecklistData {
  items: ChecklistItem[];
}

export type WidgetType = 'entity-list' | 'state-machine' | 'toggle' | 'item-tracker' | 'reference' | 'faction-board' | 'checklist';
export type SessionWidgetData = EntityListData | StateMachineData | ToggleData | ItemTrackerData | ReferenceData | FactionBoardData | ChecklistData;

export interface SessionWidget {
  id: string;
  type: WidgetType;
  title: string;
  collapsed: boolean;
  data: SessionWidgetData;
}

export interface SessionBoard {
  id: string;
  name: string;
  widgets: SessionWidget[];
  position: { x: number; y: number };
  minimized: boolean;
}

/** Returned by parseSessionBoard() — one entry per detected pattern */
export interface SessionBoardProposal {
  entityList?: {
    title: string;
    entries: Array<Omit<EntityListEntry, 'id'>>;
  };
  stateMachine?: {
    title: string;
    entityName: string;
    states: StateMachineState[];
  };
  toggle?: {
    title: string;
    values: Array<{ label: string; color: string }>;
  };
}
