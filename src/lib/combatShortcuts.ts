export function getCombatTurnShortcut(key: string, shiftKey: boolean): 'next' | 'previous' | null {
  if (key !== ' ') return null;
  return shiftKey ? 'previous' : 'next';
}

export function isInteractiveShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return target.closest('button, input, textarea, select, summary, a, [role="button"], [role="menuitem"], [contenteditable="true"]') !== null;
}
