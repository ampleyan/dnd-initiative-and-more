/**
 * Tests for classifySpell — the function that determines badges shown
 * on spells in the RightSidebar (ATK / SAV / HEL / BUFF / UTIL + SELF / AOE / FOE etc.)
 *
 * We copy the function here so it can be tested in isolation without mounting
 * the full React component. If the logic in RightSidebar changes, update this copy too.
 */
import { describe, it, expect } from 'vitest';
import type { Spell } from '../types';

type SpellType = 'attack' | 'save' | 'heal' | 'buff' | 'utility';
type SpellTarget = 'self' | 'touch' | 'aoe' | 'ally' | 'enemy' | 'any';

function classifySpell(s: Spell): { isConcentration: boolean; type: SpellType; target: SpellTarget } {
  const desc = s.description.toLowerCase();
  const dur  = (s.duration ?? '').toLowerCase();
  const rng  = (s.range   ?? '').toLowerCase();

  const isConcentration = /\bconcentration\b/.test(dur);
  const isAttack = /\bspell attack\b|\battack roll\b|\branged spell attack\b|\bmelee spell attack\b/.test(desc);
  const isSave   = /\bsaving throw\b|\bmust (make|succeed on)/.test(desc);
  const isHeal   = /\bregain.{0,30}hit point|hit point.{0,20}regain|\bheals?\b.{0,20}\bhit\b/.test(desc);
  const isBuff   = !isAttack && !isSave && !isHeal && (
    /\badvantage\b.{0,40}\b(attack|ability|saving)\b|\bresistance\b.{0,30}\bdamage\b|\bbonus\b.{0,30}\b(ac|armor|attack|save|check)\b|\btemporary hit point\b/.test(desc) ||
    ['abjuration', 'enchantment'].includes(s.school.toLowerCase())
  );
  const type: SpellType = isHeal ? 'heal' : isAttack ? 'attack' : isSave ? 'save' : isBuff ? 'buff' : 'utility';

  const isSelf   = rng === 'self' || rng.startsWith('self (');
  const isTouch  = rng === 'touch';
  const isAoe    = /\b\d+.?-?foot.*(radius|cone|cube|line|sphere|cylinder)\b|\beach (creature|target)\b|\ball creature/.test(desc) || /\b(cone|radius|cube|line|sphere)\b/.test(rng);
  const isAlly   = /\bwilling creature\b|\bfriendly (creature|target)\b/.test(desc);
  const isEnemy  = (isAttack || isSave) && !isAlly && !isSelf;
  const target: SpellTarget = isSelf ? 'self' : isTouch ? 'touch' : isAoe ? 'aoe' : isAlly ? 'ally' : isEnemy ? 'enemy' : 'any';

  return { isConcentration, type, target };
}

function spell(overrides: Partial<Spell>): Spell {
  return {
    id: 'test-spell',
    name: 'Test Spell',
    level: 1,
    school: 'Evocation',
    description: '',
    time: '1 action',
    range: '60 feet',
    duration: 'Instantaneous',
    components: 'V, S',
    ...overrides,
  } as Spell;
}

// ── Type classification ───────────────────────────────────────────────────────
describe('classifySpell — type', () => {
  it('classifies a ranged spell attack as "attack"', () => {
    const s = spell({ description: 'Make a ranged spell attack against the target.' });
    expect(classifySpell(s).type).toBe('attack');
  });

  it('classifies a melee spell attack as "attack"', () => {
    const s = spell({ description: 'Make a melee spell attack against a creature within reach.' });
    expect(classifySpell(s).type).toBe('attack');
  });

  it('classifies a saving throw spell as "save"', () => {
    const s = spell({ description: 'Each creature must make a Constitution saving throw.' });
    expect(classifySpell(s).type).toBe('save');
  });

  it('classifies a healing spell as "heal"', () => {
    const s = spell({ description: 'A creature you touch regains 2d8+3 hit points.' });
    expect(classifySpell(s).type).toBe('heal');
  });

  it('classifies a buff (advantage) spell correctly', () => {
    const s = spell({ description: 'The target gains advantage on attack rolls.' });
    expect(classifySpell(s).type).toBe('buff');
  });

  it('classifies resistance buff correctly', () => {
    const s = spell({ description: 'The target gains resistance to fire damage.' });
    expect(classifySpell(s).type).toBe('buff');
  });

  it('classifies Abjuration school as buff', () => {
    const s = spell({ school: 'Abjuration', description: 'Wards a creature.' });
    expect(classifySpell(s).type).toBe('buff');
  });

  it('classifies utility spell as "utility"', () => {
    const s = spell({ description: 'You detect all traps within range.' });
    expect(classifySpell(s).type).toBe('utility');
  });

  it('heal takes priority over attack when description mentions both', () => {
    const s = spell({ description: 'Make a melee spell attack. The target regains hit points equal to the damage dealt.' });
    expect(classifySpell(s).type).toBe('heal');
  });
});

// ── Concentration ─────────────────────────────────────────────────────────────
describe('classifySpell — concentration', () => {
  it('detects concentration in duration', () => {
    const s = spell({ duration: 'Concentration, up to 1 minute' });
    expect(classifySpell(s).isConcentration).toBe(true);
  });

  it('returns false for non-concentration duration', () => {
    const s = spell({ duration: 'Instantaneous' });
    expect(classifySpell(s).isConcentration).toBe(false);
  });

  it('returns false for "1 hour" duration', () => {
    const s = spell({ duration: '1 hour' });
    expect(classifySpell(s).isConcentration).toBe(false);
  });
});

// ── Target classification ─────────────────────────────────────────────────────
describe('classifySpell — target', () => {
  it('classifies "self" range as self', () => {
    const s = spell({ range: 'Self' });
    expect(classifySpell(s).target).toBe('self');
  });

  it('classifies "self (30-foot cone)" as self', () => {
    const s = spell({ range: 'Self (30-foot cone)' });
    expect(classifySpell(s).target).toBe('self');
  });

  it('classifies "Touch" range as touch', () => {
    const s = spell({ range: 'Touch' });
    expect(classifySpell(s).target).toBe('touch');
  });

  it('classifies cone AoE as aoe', () => {
    const s = spell({ description: 'Each creature in a 30-foot cone must make a Dexterity saving throw.' });
    expect(classifySpell(s).target).toBe('aoe');
  });

  it('classifies radius AoE as aoe', () => {
    const s = spell({ description: 'Each creature in a 20-foot radius must succeed on a saving throw.' });
    expect(classifySpell(s).target).toBe('aoe');
  });

  it('classifies "willing creature" as ally', () => {
    const s = spell({ description: 'You touch a willing creature and grant it advantage.' });
    expect(classifySpell(s).target).toBe('ally');
  });

  it('classifies an attack roll spell as enemy', () => {
    const s = spell({ description: 'Make a ranged spell attack against one creature.', range: '120 feet' });
    expect(classifySpell(s).target).toBe('enemy');
  });

  it('classifies a utility spell at range as "any"', () => {
    const s = spell({ description: 'You detect the presence of magic within range.', range: '30 feet' });
    expect(classifySpell(s).target).toBe('any');
  });
});

// ── Real spell examples ───────────────────────────────────────────────────────
describe('classifySpell — real spells', () => {
  it('Fireball: save + aoe', () => {
    const fireball = spell({
      name: 'Fireball',
      school: 'Evocation',
      range: '150 feet',
      description: 'A bright streak flashes from your pointing finger to a point you choose within range and then blossoms with a low roar into an explosion of flame. Each creature in a 20-foot-radius sphere centered on that point must make a Dexterity saving throw.',
    });
    const result = classifySpell(fireball);
    expect(result.type).toBe('save');
    expect(result.target).toBe('aoe');
  });

  it('Cure Wounds: heal + touch', () => {
    const cureWounds = spell({
      name: 'Cure Wounds',
      school: 'Evocation',
      range: 'Touch',
      description: 'A creature you touch regains a number of hit points equal to 1d8 + your spellcasting ability modifier.',
    });
    const result = classifySpell(cureWounds);
    expect(result.type).toBe('heal');
    expect(result.target).toBe('touch');
  });

  it('Bless: buff + ally + concentration', () => {
    const bless = spell({
      name: 'Bless',
      school: 'Enchantment',
      range: '30 feet',
      duration: 'Concentration, up to 1 minute',
      description: 'You bless up to three creatures of your choice within range. The target gains a d4 bonus to attack rolls and saving throws.',
    });
    const result = classifySpell(bless);
    expect(result.type).toBe('buff');
    expect(result.isConcentration).toBe(true);
  });

  it('Fire Bolt: attack + enemy', () => {
    const fireBolt = spell({
      name: 'Fire Bolt',
      school: 'Evocation',
      range: '120 feet',
      description: 'You hurl a mote of fire at a creature or object within range. Make a ranged spell attack against the target.',
    });
    const result = classifySpell(fireBolt);
    expect(result.type).toBe('attack');
    expect(result.target).toBe('enemy');
  });
});
