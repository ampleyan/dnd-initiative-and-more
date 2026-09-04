import { ParsedCreature, ParsedEncounter, SessionBoardProposal, StateMachineState } from '../types';

// ── Creature role classifier ──────────────────────────────────────────────────

const COMBAT_SIGNALS: RegExp[] = [
  /\b(attacks?|ambushes?|lurks?|patrols?|defends?|pursues?|threatens?|charges?|assaults?)\b/i,
  /\b(hostile|enemy|enemies|foe|foes|combat|fight|battle|encounter)\b/i,
  /\b(cr\s*\d|challenge rating)\b/i,
  /\b(\d+d\d+|\d+\s*[xX×]\s*\d+|two|three|four|five|six|seven|eight|nine|ten|a\s+pair\s+of|a\s+pack\s+of|a\s+group\s+of|a\s+band\s+of)\b/i,
];

const NPC_SIGNALS: RegExp[] = [
  /\b(greets?|offers?|explains?|asks?|welcomes?|thanks?|tells?|requests?|invites?|warns?)\b/i,
  /\b(friendly|ally|allies|helpful|quest|information|reward|contact)\b/i,
  /\b(is\s+a|are\s+a|works?\s+as|serves?\s+as|lives?\s+in|resides?|dwells?)\b/i,
  /\b(can\s+be\s+persuaded|will\s+help|may\s+assist|agrees?\s+to)\b/i,
];

export function classifyCreatureRole(
  rawName: string,
  sectionText: string,
): 'combatant' | 'npc' | 'uncertain' {
  // Short-circuit: explicit 5etools creature tag → always combatant
  const tagPattern = new RegExp(`\\{@creature\\s+${rawName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
  if (tagPattern.test(sectionText)) return 'combatant';

  // Short-circuit: table row containing the name → always combatant
  const tablePattern = new RegExp(`^\\|[^\\n]*${rawName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'im');
  if (tablePattern.test(sectionText)) return 'combatant';

  // Extract context window: find the sentence containing rawName + adjacent sentence
  const sentences = sectionText.split(/(?<=[.!?])\s+/);
  const nameRe = new RegExp(rawName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const idx = sentences.findIndex(s => nameRe.test(s));
  const context = idx >= 0
    ? sentences.slice(Math.max(0, idx - 1), idx + 2).join(' ')
    : sectionText.slice(0, 400);

  let score = 0;
  for (const re of COMBAT_SIGNALS) if (re.test(context)) score++;
  for (const re of NPC_SIGNALS) if (re.test(context)) score--;

  if (score > 0) return 'combatant';
  if (score < 0) return 'npc';
  return 'uncertain';
}

// ── Number words → digits ─────────────────────────────────────────────────────
const WORD_NUM: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10, dozen: 12,
};

function parseCount(s: string): number {
  const n = parseInt(s);
  if (!isNaN(n)) return n;
  return WORD_NUM[s.toLowerCase()] ?? 1;
}

// ── False-positive filter — game terms that appear in bold but aren't creatures
const NON_CREATURES = new Set([
  'detect magic', 'animate objects', 'speak with animals', 'calm emotions',
  'silence', 'speak with dead', 'remove curse', 'awaken', 'misty step',
  'fly', 'invisibility', 'hold person', 'charm person', 'thunderwave',
]);

function isLikelyCreature(name: string): boolean {
  const n = name.toLowerCase().trim();
  if (n.length < 3) return false;
  if (NON_CREATURES.has(n)) return false;
  // Magic items / spells tend to be italicized in source; when bold they're usually creatures
  // Short conjunctions / prepositions aren't creatures
  if (/^(the|a|an|this|that|for|of|in|and|or|but|with|from|its|their)$/.test(n)) return false;
  return true;
}

// ── Creature extraction from a set of text lines ──────────────────────────────
//
// Three patterns (applied to every line):
//
// 1. Count word/digit + bold lowercase
//    "three **giant goats**"  → {count:3, rawName:"giant goats"}
//    "Eight **goblins**"      → {count:8, rawName:"goblins"}
//    "a **cyclops**"          → {count:1, rawName:"cyclops"}
//
// 2. Bare bold lowercase (creature type reference, no preceding count)
//    "**galeb duhr** erupts"  → {count:1, rawName:"galeb duhr"}
//    "**shadow** stat block"  → {count:1, rawName:"shadow"}
//
// 3. DM-prep patterns (legacy, kept for handwritten notes)
//    "**2x Bullywugs**"       → {count:2, rawName:"Bullywugs"}
//    "**Annis Hag** - CR 6"   → {count:1, rawName:"Annis Hag"}
//    "### CREATURE NAME"      → {count:1, rawName:"CREATURE NAME"}
//
// 4. 5etools {@creature Name} tag
//    "{@creature Amidor the Dandelion|WBtW|Amidor}" → {count:1, rawName:"Amidor the Dandelion"}

// Matches: (number/word) **lowercase-starting bold**
const RE_COUNT_BOLD =
  /\b(\d+|[Aa]n?|[Oo]ne|[Tt]wo|[Tt]hree|[Ff]our|[Ff]ive|[Ss]ix|[Ss]even|[Ee]ight|[Nn]ine|[Tt]en)\s+\*\*([a-z][^*\n]{1,60}?)\*\*/g;

// Matches: **lowercase-starting bold** (no count prefix required)
const RE_BARE_BOLD = /\*\*([a-z][^*\n]{1,60}?)\*\*/g;

// DM-prep: **2x Name** or - **2x Name**
const RE_DM_COUNT = /\*\*(\d+)[xX×]?\s+(.+?)\*\*/;
const RE_DM_BULLET = /[-*]\s+\*\*(\d+)[xX×]?\s+(.+?)\*\*/;

// DM-prep: **Name** - CR X (NPC block definition)
const RE_DM_NPC = /^\*\*(.+?)\*\*\s*[-–]\s*CR\s*([\d/]+)/i;
const RE_DM_H3 = /^###\s+(.+)/;

// 5etools: {@creature Name|...}
const RE_AT_CREATURE = /\{@creature ([^|}\n]+)/g;

function extractCreaturesFromLines(lines: string[]): ParsedCreature[] {
  const seen = new Map<string, ParsedCreature>();

  const add = (rawName: string, count: number) => {
    const key = rawName.toLowerCase().trim();
    if (!isLikelyCreature(rawName)) return;
    if (!seen.has(key)) seen.set(key, { rawName: rawName.trim(), count });
  };

  for (const line of lines) {
    // Pattern 1: count-prefixed bold
    const re1 = new RegExp(RE_COUNT_BOLD.source, 'g');
    let m: RegExpExecArray | null;
    while ((m = re1.exec(line)) !== null) add(m[2], parseCount(m[1]));

    // Pattern 2: bare bold lowercase
    const re2 = new RegExp(RE_BARE_BOLD.source, 'g');
    while ((m = re2.exec(line)) !== null) add(m[1], 1);

    // Pattern 3a: DM-prep **2x Name**
    const dm = line.match(RE_DM_COUNT);
    if (dm) add(dm[2], parseInt(dm[1]));

    // Pattern 3b: DM-prep bullet - **2x Name**
    const db = line.match(RE_DM_BULLET);
    if (db) add(db[2], parseInt(db[1]));

    // Pattern 3c: DM-prep **Name** - CR X
    const dn = line.match(RE_DM_NPC);
    if (dn) add(dn[1], 1);

    // Pattern 3d: DM-prep ### CREATURE NAME (all-caps heading = NPC block)
    const dh = line.match(RE_DM_H3);
    if (dh) {
      const name = dh[1].trim();
      if (name === name.toUpperCase() && name.length > 2) add(name, 1);
    }

    // Pattern 4: {@creature Name}
    const re4 = new RegExp(RE_AT_CREATURE.source, 'g');
    while ((m = re4.exec(line)) !== null) add(m[1], 1);
  }

  return Array.from(seen.values());
}

// ── Section parsing ───────────────────────────────────────────────────────────
//
// Headings to SKIP (meta content, not encounters):
const SKIP_SECTION = /^(running this|features of|navigating|lost things|overview|map of|development|treasure|secrets|connections|dm guidance|backstory|history|appendix|sidebar|table of|index|read.aloud|roleplaying|adjusting|common player|pacing|alternate|post.encounter|long.term|what (he|she|they) (want|knows|has)|combat stat|ability score|combat tactics|sample dialogue|background|personality|speech|mannerism|introduction|credits|conclusion|aftermath)/i;

// Heading levels that represent individual encounters
const ENCOUNTER_LEVEL_MIN = 3; // ### and ####

interface Section {
  level: number;
  name: string;
  parent: string | undefined;
  lines: string[];
}

function parseSections(text: string): Section[] {
  const lines = text.split('\n');
  const result: Section[] = [];
  let current: Section | null = null;
  const stack: { level: number; name: string }[] = [];

  for (const line of lines) {
    const hm = line.match(/^(#{1,4})\s+(.+)/);
    if (hm) {
      if (current) result.push(current);
      const level = hm[1].length;
      const name = hm[2].trim();
      // Pop stack entries at same or deeper level
      while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
      const parent = stack.length ? stack[stack.length - 1].name : undefined;
      stack.push({ level, name });
      current = { level, name, parent, lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) result.push(current);
  return result;
}

// ── DM description extraction ─────────────────────────────────────────────────

function stripMarkdown(s: string): string {
  return s
    .replace(/\*\*\*(.+?)\*\*\*/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\{@\w+ ([^|}\n]+)[^}\n]*\}/g, '$1')
    .trim();
}

function truncate(s: string, max = 420): string {
  if (s.length <= max) return s;
  return s.slice(0, max).replace(/\s\S+$/, '') + '…';
}

function extractDescription(lines: string[]): string | undefined {
  const readAloud: string[] = [];
  for (const line of lines) {
    if (line.startsWith('>>')) {
      const content = line.replace(/^>>\s*/, '').trim();
      if (content) readAloud.push(content);
    }
  }
  if (readAloud.length > 0) return truncate(readAloud.join(' '));

  for (const line of lines) {
    const s = line.trim();
    if (!s) continue;
    if (s.startsWith('#') || s.startsWith('!') || s.startsWith('|') ||
        s.startsWith('```') || s.startsWith('>')) continue;
    if (/^[-*]\s/.test(s)) continue;
    const text = stripMarkdown(s);
    if (text.length < 20) continue;
    return truncate(text);
  }
  return undefined;
}

// ── Foundry Journal JSON Parser ─────────────────────────────────────────────

// ── Mapping prefixes to location names ─────────────────────────────────────────
const LOCATION_MAP: Record<string, string> = {
  'B': 'Brigganock Mine',
  'C': 'Motherhorn',
  'D': 'Downfall',
  'L': 'Loomlurch',
  'M': 'Motherhorn',
  'P': 'Palace of Heart\'s Desire',
  'W': 'Wayward Pool',
  'H': 'Hither',
  'T': 'Thither',
  'Y': 'Yon',
};

function getFolderFromPrefix(prefix: string): string | undefined {
  const code = prefix.charAt(0).toUpperCase();
  return LOCATION_MAP[code];
}

export function parseFoundryJournal(text: string): ParsedEncounter[] {
  try {
    const data = JSON.parse(text);
    const encountersByLocation: Record<string, ParsedEncounter> = {};

    // Support both single JournalEntry and an array of them
    const entries = Array.isArray(data) ? data : [data];

    for (const entry of entries) {
      for (const page of entry.pages || []) {
        const html = page.text?.content || '';
        // Simple table parser for ⚔️ Encounter Prep or similar
        const tables = html.match(/<table[\s\S]*?<\/table>/g) || [];
        
        for (const table of tables) {
          // Check if it's an encounter table by checking headers
          if (!table.includes('Creature') || !table.includes('Count')) continue;
          
          const rows = table.match(/<tr[\s\S]*?<\/tr>/g) || [];
          for (const row of rows) {
            const cells = row.match(/<td[\s\S]*?<\/td>/g);
            if (!cells || cells.length < 4) continue;
            
            const creatureRaw = cells[0].replace(/<[^>]*>/g, '').trim();
            const countRaw = cells[3].replace(/<[^>]*>/g, '').trim();
            const locationRaw = cells[4]?.replace(/<[^>]*>/g, '').trim() || 'Unknown';
            
            // Handle counts like "12+", "25", "3 (x3 reading in chairs)"
            const countMatch = countRaw.match(/(\d+)/);
            const count = countMatch ? parseInt(countMatch[1]) : 1;
            
            // Extract location(s) - handle comma separated, ampersand, or plus
            const locations = locationRaw.split(/[,&+]| and /).map(l => l.trim()).filter(l => l.length > 0);
            
            for (const loc of locations) {
              // Normalize location name (e.g., "M7 (x3)" -> "M7")
              const cleanLoc = loc.split(' ')[0].trim();
              if (!encountersByLocation[cleanLoc]) {
                encountersByLocation[cleanLoc] = {
                  name: cleanLoc,
                  chapter: getFolderFromPrefix(cleanLoc) || entry.name || 'Foundry Import',
                  creatures: []
                };
              }
              
              // Deduplication logic: Check if this creature already exists for this location
              const existing = encountersByLocation[cleanLoc].creatures.find(c => c.rawName === creatureRaw);

              if (existing) {
                // Use Math.max because different pages might list the same creatures for the same location
                existing.count = Math.max(existing.count, count);
              } else {
                encountersByLocation[cleanLoc].creatures.push({
                  rawName: creatureRaw,
                  count: count
                });
              }
            }
          }
        }
      }
    }
    
    return Object.values(encountersByLocation);
  } catch (e) {
    console.error('Failed to parse Foundry Journal JSON:', e);
    return [];
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

export function parseMarkdown(text: string): ParsedEncounter[] {
  const sections = parseSections(text);
  const seen = new Set<string>();
  const encounters: ParsedEncounter[] = [];

  for (const section of sections) {
    const nameLower = section.name.toLowerCase();

    // ── DM-prep: explicit encounter headers (any level) ──────────────────────
    const isExplicitEncounter =
      /^(encounter[:\s]|combat encounter)/i.test(section.name) ||
      /^(key npcs|key npcs & creatures|creatures|npcs)$/i.test(section.name);

    // ── 5etools/chapter: any h3/h4 section not in the skip list ─────────────
    const isSectionEncounter =
      section.level >= ENCOUNTER_LEVEL_MIN && !SKIP_SECTION.test(section.name);

    if (!isExplicitEncounter && !isSectionEncounter) continue;

    const creatures = extractCreaturesFromLines(section.lines);
    if (creatures.length === 0) continue;

    const sectionText = section.lines.join('\n');
    for (const creature of creatures) {
      creature.role = classifyCreatureRole(creature.rawName, sectionText);
    }

    // Detect location prefix like "M1:", "D6:", "L1-L"
    const prefixMatch = section.name.match(/^([A-Z]\d+[a-z-]*)[:.]?\s+/i);
    const prefix = prefixMatch ? prefixMatch[1] : undefined;

    // Strip location prefixes from section names
    const encName = section.name
      .replace(/^[A-Z]\d+[a-z-]*(:|\.|\s+)\s*/i, '')
      .replace(/^encounter[:\s]*/i, '')
      .trim();

    const dedupKey = (prefix ? prefix + '-' : '') + encName.toLowerCase();
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);

    const displayName = prefix ? `${prefix}: ${encName}` : encName;

    encounters.push({
      name: displayName,
      chapter: (prefix ? getFolderFromPrefix(prefix) : undefined) || section.parent || 'General',
      creatures,
      description: extractDescription(section.lines),
    });
  }

  return encounters;
}

// ── Session Board Parser ──────────────────────────────────────────────────────

const RE_STASIS_LINE = /frozen in time|temporal stasis|frozen in temporal stasis|was frozen|is frozen/i;
const RE_BOLD_ANY = /\*\*([A-Za-z][^*\n]{0,50}?)\*\*/g;
const RE_JABBERWOCK = /jabberwock/i;
const RE_SLEEPING = /asleep|sleeping|sound asleep/i;
const RE_CROWN_LOCK = /crown[^.]{0,80}lock|crown lock/i;

const TRUE_NAME_TRIGGERS: Array<{ detect: RegExp; subject: string; trueName: string }> = [
  { detect: /Natasha/, subject: 'Zybilna', trueName: 'Natasha' },
];

export function parseSessionBoard(text: string): SessionBoardProposal {
  const lines = text.split('\n');
  const proposal: SessionBoardProposal = {};

  // True name lookup
  const trueNameMap: Record<string, string> = {};
  for (const trigger of TRUE_NAME_TRIGGERS) {
    if (trigger.detect.test(text)) {
      trueNameMap[trigger.subject] = trigger.trueName;
    }
  }

  // Entity List: stasis detection
  const stasisEntries: Array<{ displayName: string; trueName?: string; status: 'frozen' | 'freed' }> = [];
  const stasisSeen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    if (!RE_STASIS_LINE.test(lines[i])) continue;

    const window = [lines[i - 1] ?? '', lines[i], lines[i + 1] ?? ''].join(' ');
    const re = new RegExp(RE_BOLD_ANY.source, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(window)) !== null) {
      const name = m[1].trim();
      const key = name.toLowerCase();
      if (stasisSeen.has(key) || !isLikelyCreature(name)) continue;
      stasisSeen.add(key);
      stasisEntries.push({
        displayName: name,
        trueName: trueNameMap[name],
        status: 'frozen',
      });
    }
  }

  if (stasisEntries.length > 0) {
    proposal.entityList = { title: 'Temporal Stasis', entries: stasisEntries };
  }

  // State Machine: jabberwock
  if (RE_JABBERWOCK.test(text) && RE_SLEEPING.test(text)) {
    const states: StateMachineState[] = [
      { label: 'Asleep', color: 'bg-blue-600' },
      { label: 'Awake', color: 'bg-amber-500' },
      { label: 'Fled', color: 'bg-green-600' },
    ];
    proposal.stateMachine = { title: 'Jabberwock', entityName: 'Jabberwock', states };
  }

  // Toggle: crown lock
  if (RE_CROWN_LOCK.test(text)) {
    proposal.toggle = {
      title: 'Crown',
      values: [
        { label: 'Unplaced', color: 'bg-zinc-500' },
        { label: 'Envy (Lion) — lion doors open', color: 'bg-yellow-500' },
        { label: 'Wrath (Hart) — hart doors open', color: 'bg-slate-400' },
      ],
    };
  }

  return proposal;
}

