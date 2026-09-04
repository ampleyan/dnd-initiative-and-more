import { describe, it, expect } from 'vitest';
import { classifyCreatureRole } from '../lib/adventureParser';

describe('classifyCreatureRole', () => {
  it('returns combatant when count word precedes creature', () => {
    expect(classifyCreatureRole('goblin', 'Three goblins attack the party from the north.')).toBe('combatant');
  });

  it('returns combatant for attack verbs', () => {
    expect(classifyCreatureRole('shadow', 'A shadow lurks in the corner, attacking anyone who enters.')).toBe('combatant');
  });

  it('returns combatant for hostile words', () => {
    expect(classifyCreatureRole('guard', 'The guards are hostile and will fight on sight.')).toBe('combatant');
  });

  it('returns npc for greeting verbs', () => {
    expect(classifyCreatureRole('innkeeper', 'The innkeeper greets the party and offers them rooms for the night.')).toBe('npc');
  });

  it('returns npc for friendly context', () => {
    expect(classifyCreatureRole('elf', 'The friendly elf explains the history of the forest.')).toBe('npc');
  });

  it('returns npc for being-role constructions', () => {
    expect(classifyCreatureRole('volo', 'Volo is a well-known author who lives in Waterdeep.')).toBe('npc');
  });

  it('returns combatant for {@creature} tag', () => {
    expect(classifyCreatureRole('goblin', 'The room contains {@creature goblin} creatures waiting to ambush.')).toBe('combatant');
  });

  it('returns combatant for table row (pipe prefix)', () => {
    expect(classifyCreatureRole('orc', '| 1d6 | orc | patrol the bridge |')).toBe('combatant');
  });

  it('returns uncertain for neutral context', () => {
    expect(classifyCreatureRole('guard', 'The guard stands near the gate.')).toBe('uncertain');
  });

  it('returns uncertain when no signals present', () => {
    expect(classifyCreatureRole('dragon', 'The dragon is mentioned in the legend.')).toBe('uncertain');
  });
});
