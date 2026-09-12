import { describe, expect, it } from 'vitest';
import { buildImportPreview, applyImportSelections } from '../lib/importDiff';
import type { MappedEntity } from '../components/import/helpers';
import type { ImportProvenance } from '../lib/importDiff';

const provenance: ImportProvenance = { source: 'foundry', importedAt: '2026-09-12T00:00:00.000Z' };

function makeEntity(overrides: Partial<MappedEntity> & { id: string; name: string }): MappedEntity {
  return {
    type: 'Monster',
    format: 'JSON (5etools)',
    status: 'detected',
    data: { id: overrides.id, name: overrides.name },
    ...overrides,
  };
}

describe('buildImportPreview', () => {
  it('returns empty preview for empty inputs', () => {
    const preview = buildImportPreview([], [], provenance);
    expect(preview.items).toHaveLength(0);
    expect(preview.counts).toEqual({ new: 0, update: 0, unchanged: 0 });
  });

  it('classifies all items as new when no existing entities', () => {
    const incoming = [
      makeEntity({ id: 'a', name: 'Goblin' }),
      makeEntity({ id: 'b', name: 'Orc' }),
    ];
    const preview = buildImportPreview(incoming, [], provenance);
    expect(preview.items).toHaveLength(2);
    expect(preview.items.every(i => i.status === 'new')).toBe(true);
    expect(preview.counts).toEqual({ new: 2, update: 0, unchanged: 0 });
  });

  it('classifies as update when incoming data.id matches existing data.id', () => {
    const incoming = [makeEntity({ id: 'a', name: 'Goblin', data: { id: 'a', name: 'Goblin', hp: 8 } })];
    const existing = [makeEntity({ id: 'a', name: 'Goblin', data: { id: 'a', name: 'Goblin', hp: 7 } })];
    const preview = buildImportPreview(incoming, existing, provenance);
    expect(preview.items[0].status).toBe('update');
    expect(preview.items[0].existingId).toBe('a');
    expect(preview.counts).toEqual({ new: 0, update: 1, unchanged: 0 });
  });

  it('classifies as unchanged when data content is identical', () => {
    const data = { id: 'a', name: 'Goblin', hp: 7 };
    const incoming = [makeEntity({ id: 'a', name: 'Goblin', data })];
    const existing = [makeEntity({ id: 'a', name: 'Goblin', data })];
    const preview = buildImportPreview(incoming, existing, provenance);
    expect(preview.items[0].status).toBe('unchanged');
    expect(preview.counts).toEqual({ new: 0, update: 0, unchanged: 1 });
  });

  it('attaches provenance to every item', () => {
    const incoming = [makeEntity({ id: 'x', name: 'Troll' })];
    const preview = buildImportPreview(incoming, [], provenance);
    expect(preview.items[0].provenance).toEqual(provenance);
  });

  it('falls back to name+type matching when data.id is absent', () => {
    const incoming = [makeEntity({ id: 'r1', name: 'Troll', data: { name: 'Troll', hp: 84 } })];
    const existing = [makeEntity({ id: 'r2', name: 'Troll', data: { name: 'Troll', hp: 84 } })];
    const preview = buildImportPreview(incoming, existing, provenance);
    expect(preview.items[0].status).toBe('unchanged');
    expect(preview.items[0].existingId).toBe('r2');
  });

  it('handles mixed statuses correctly', () => {
    const incoming = [
      makeEntity({ id: 'a', name: 'Goblin', data: { id: 'a', name: 'Goblin', hp: 8 } }),
      makeEntity({ id: 'b', name: 'Orc', data: { id: 'b', name: 'Orc', hp: 15 } }),
      makeEntity({ id: 'c', name: 'Troll' }),
    ];
    const existing = [
      makeEntity({ id: 'a', name: 'Goblin', data: { id: 'a', name: 'Goblin', hp: 7 } }),
      makeEntity({ id: 'b', name: 'Orc', data: { id: 'b', name: 'Orc', hp: 15 } }),
    ];
    const preview = buildImportPreview(incoming, existing, provenance);
    expect(preview.counts).toEqual({ new: 1, update: 1, unchanged: 1 });
  });

  it('uses ddb source in provenance', () => {
    const ddbProvenance: ImportProvenance = { source: 'ddb', importedAt: '2026-09-12T01:00:00.000Z' };
    const incoming = [makeEntity({ id: 'x', name: 'Dragon' })];
    const preview = buildImportPreview(incoming, [], ddbProvenance);
    expect(preview.items[0].provenance.source).toBe('ddb');
  });
});

describe('applyImportSelections', () => {
  it('returns only entities whose ids are in the selection set', () => {
    const incoming = [
      makeEntity({ id: 'a', name: 'Goblin' }),
      makeEntity({ id: 'b', name: 'Orc' }),
      makeEntity({ id: 'c', name: 'Troll' }),
    ];
    const preview = buildImportPreview(incoming, [], provenance);
    const result = applyImportSelections(preview, new Set(['a', 'c']));
    expect(result).toHaveLength(2);
    expect(result.map(e => e.id)).toEqual(expect.arrayContaining(['a', 'c']));
  });

  it('returns empty array when selection is empty', () => {
    const incoming = [makeEntity({ id: 'a', name: 'Goblin' })];
    const preview = buildImportPreview(incoming, [], provenance);
    expect(applyImportSelections(preview, new Set())).toHaveLength(0);
  });

  it('returns all items when all ids are selected', () => {
    const incoming = [
      makeEntity({ id: 'a', name: 'Goblin' }),
      makeEntity({ id: 'b', name: 'Orc' }),
    ];
    const preview = buildImportPreview(incoming, [], provenance);
    const result = applyImportSelections(preview, new Set(['a', 'b']));
    expect(result).toHaveLength(2);
  });

  it('ignores ids not present in preview', () => {
    const incoming = [makeEntity({ id: 'a', name: 'Goblin' })];
    const preview = buildImportPreview(incoming, [], provenance);
    const result = applyImportSelections(preview, new Set(['a', 'z']));
    expect(result).toHaveLength(1);
  });

  it('is deterministic — same input always produces same output', () => {
    const incoming = [
      makeEntity({ id: 'a', name: 'Goblin' }),
      makeEntity({ id: 'b', name: 'Orc' }),
    ];
    const preview = buildImportPreview(incoming, [], provenance);
    const r1 = applyImportSelections(preview, new Set(['a', 'b']));
    const r2 = applyImportSelections(preview, new Set(['a', 'b']));
    expect(r1).toEqual(r2);
  });
});
