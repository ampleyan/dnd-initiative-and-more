import type { MappedEntity } from '../components/import/helpers';

export type ImportDiffStatus = 'new' | 'update' | 'unchanged';
export type ImportSource = 'foundry' | 'ddb' | 'manual';

export interface ImportProvenance {
  source: ImportSource;
  importedAt: string;
}

export interface ImportPreviewItem {
  entity: MappedEntity;
  status: ImportDiffStatus;
  existingId?: string;
  provenance: ImportProvenance;
}

export interface ImportPreview {
  items: ImportPreviewItem[];
  counts: { new: number; update: number; unchanged: number };
}

function normalizeKey(entity: MappedEntity): string {
  return `${entity.type}:${(entity.name ?? '').trim().toLowerCase().replace(/\s+/g, ' ')}`;
}

function dataEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function buildImportPreview(
  incoming: MappedEntity[],
  existing: MappedEntity[],
  provenance: ImportProvenance,
): ImportPreview {
  const byDataId = new Map<string, MappedEntity>();
  const byKey = new Map<string, MappedEntity>();

  for (const e of existing) {
    if (e.data?.id) byDataId.set(String(e.data.id), e);
    byKey.set(normalizeKey(e), e);
  }

  const counts = { new: 0, update: 0, unchanged: 0 };
  const items: ImportPreviewItem[] = incoming.map(entity => {
    const dataId = entity.data?.id ? String(entity.data.id) : null;
    const match = (dataId && byDataId.get(dataId)) || byKey.get(normalizeKey(entity));

    let status: ImportDiffStatus;
    let existingId: string | undefined;

    if (!match) {
      status = 'new';
    } else {
      existingId = match.id;
      status = dataEqual(entity.data, match.data) ? 'unchanged' : 'update';
    }

    counts[status] += 1;
    return { entity, status, existingId, provenance };
  });

  return { items, counts };
}

export function applyImportSelections(
  preview: ImportPreview,
  selectedIds: Set<string>,
): MappedEntity[] {
  return preview.items
    .filter(item => selectedIds.has(item.entity.id))
    .map(item => item.entity);
}
