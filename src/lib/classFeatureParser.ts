/** Flatten 5etools recursive entries into plain text */
function flattenEntries(entries: any[]): string {
  if (!entries) return '';
  return entries.map(e => {
    if (typeof e === 'string') return e.replace(/\{@\w+ ([^}|]+)[^}]*\}/g, '$1');
    if (typeof e !== 'object' || !e) return '';
    const name = e.name ? `${e.name}: ` : '';
    if (e.entries) return name + flattenEntries(e.entries);
    if (e.items) return name + flattenEntries(e.items);
    if (e.entry) return name + flattenEntries([e.entry]);
    if (e.rows) return name + e.rows.map((r: any[]) => r.join(' | ')).join('\n');
    return '';
  }).filter(Boolean).join(' ');
}

export interface ParsedClassFeature {
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

/** Parse a 5etools class JSON file and return flat ClassFeature objects */
export function parse5etoolsClassFile(json: any): ParsedClassFeature[] {
  const PRIORITY_SOURCES = ['XPHB', 'XMM'];
  const seen = new Map<string, ParsedClassFeature>();

  const process = (feature: any, isSubclass: boolean) => {
    if (!feature.name || !feature.className) return;
    if (feature.isClassFeatureVariant) return; // skip optional variants
    const description = flattenEntries(feature.entries ?? []);
    const parsed: ParsedClassFeature = {
      id: `${feature.className}-${feature.subclassShortName ?? ''}-${feature.name}-${feature.level}-${feature.source}`.replace(/\s+/g, '_').toLowerCase(),
      name: feature.name,
      className: feature.className,
      classSource: feature.classSource ?? feature.source,
      level: feature.level ?? 1,
      source: feature.source ?? 'PHB',
      description,
      subclassName: feature.subclassShortName ?? undefined,
      isSubclass,
    };
    const key = `${feature.className}|${feature.subclassShortName ?? ''}|${feature.name}|${feature.level}`;
    const existing = seen.get(key);
    if (!existing || (PRIORITY_SOURCES.includes(parsed.source) && !PRIORITY_SOURCES.includes(existing.source))) {
      seen.set(key, parsed);
    }
  };

  (json.classFeature ?? []).forEach((f: any) => process(f, false));
  (json.subclassFeature ?? []).forEach((f: any) => process(f, true));

  return Array.from(seen.values());
}
