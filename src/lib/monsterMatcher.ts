import { MonsterTemplate, ParsedCreature } from '../types';

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[a.length][b.length];
}

export function matchCreatures(
  creatures: ParsedCreature[],
  library: MonsterTemplate[]
): ParsedCreature[] {
  const index = library.map(m => ({ id: m.id, name: m.name, norm: normalize(m.name) }));

  return creatures.map(c => {
    const norm = normalize(c.rawName);

    const exact = index.find(m => m.norm === norm);
    if (exact) return { ...c, matchedId: exact.id, matchedName: exact.name };

    const sub = index.find(m => m.norm.includes(norm) || norm.includes(m.norm));
    if (sub) return { ...c, matchedId: sub.id, matchedName: sub.name };

    if (norm.length > 4) {
      let best: typeof index[0] | null = null;
      let bestDist = 4;
      for (const m of index) {
        const dist = levenshtein(norm, m.norm);
        if (dist < bestDist) { best = m; bestDist = dist; }
      }
      if (best) return { ...c, matchedId: best.id, matchedName: best.name };
    }

    return c;
  });
}
