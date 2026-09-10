import { describe, expect, it } from 'vitest';
import { getCombatTurnShortcut, isInteractiveShortcutTarget } from '../lib/combatShortcuts';

describe('combat turn shortcuts', () => {
  it('maps Space to next turn and Shift+Space to previous turn', () => {
    expect(getCombatTurnShortcut(' ', false)).toBe('next');
    expect(getCombatTurnShortcut(' ', true)).toBe('previous');
  });

  it('does not capture shortcuts from interactive controls', () => {
    const button = document.createElement('button');
    const input = document.createElement('input');
    const plainText = document.createElement('p');
    const buttonIcon = document.createElement('span');
    button.append(buttonIcon);

    expect(isInteractiveShortcutTarget(button)).toBe(true);
    expect(isInteractiveShortcutTarget(buttonIcon)).toBe(true);
    expect(isInteractiveShortcutTarget(input)).toBe(true);
    expect(isInteractiveShortcutTarget(plainText)).toBe(false);
  });
});
