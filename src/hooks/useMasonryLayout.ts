import { useEffect, useState, useCallback } from 'react';
import { prepare, layout } from '@chenglou/pretext';

export interface MasonryPosition {
  top: number;
  left: number;
  height: number;
}

export interface MasonryResult {
  positions: MasonryPosition[];
  totalHeight: number;
}

export function useMasonryLayout<T>(
  items: T[],
  getText: (item: T) => string,
  columns: number,
  columnWidth: number,
  gap: number,
  font: string,
  lineHeight: number,
  cardFixedHeight: number,
): MasonryResult {
  const [result, setResult] = useState<MasonryResult>({ positions: [], totalHeight: 0 });

  const compute = useCallback(() => {
    if (items.length === 0) {
      setResult({ positions: [], totalHeight: 0 });
      return;
    }

    const columnHeights = Array<number>(columns).fill(0);
    const newPositions: MasonryPosition[] = [];

    for (const item of items) {
      const text = getText(item);
      const prepared = prepare(text, font);
      const { height: textHeight } = layout(prepared, columnWidth - 32, lineHeight);
      const cardHeight = Math.max(textHeight + cardFixedHeight, 80);

      const colIndex = columnHeights.indexOf(Math.min(...columnHeights));
      const left = colIndex * (columnWidth + gap);
      const top = columnHeights[colIndex];

      newPositions.push({ top, left, height: cardHeight });
      columnHeights[colIndex] += cardHeight + gap;
    }

    setResult({
      positions: newPositions,
      totalHeight: Math.max(...columnHeights),
    });
  }, [items, getText, columns, columnWidth, gap, font, lineHeight, cardFixedHeight]);

  useEffect(() => {
    document.fonts.ready.then(compute);
  }, [compute]);

  return result;
}
