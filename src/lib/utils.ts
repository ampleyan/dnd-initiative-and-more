import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** UUID v4 — works in both secure (HTTPS) and non-secure (HTTP) contexts */
export function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback: manual RFC 4122 v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

/** Cleans 5etools/Improved Initiative markup tags like {@h}, {@atk mw}, etc. */
export function clean5eTags(text: string): string {
  if (!text) return '';
  return text
    .replace(/\{@atk\s+(mw|rw|ms|rs)\}/gi, (m, g) => {
      switch (g.toLowerCase()) {
        case 'mw': return 'Melee Weapon Attack:';
        case 'rw': return 'Ranged Weapon Attack:';
        case 'ms': return 'Melee Spell Attack:';
        case 'rs': return 'Ranged Spell Attack:';
        default: return m;
      }
    })
    .replace(/\{@hit\s+([^}]+)\}/gi, '+$1')
    .replace(/\{@h\}/gi, 'Hit: ')
    .replace(/\{@dc\s+([^}]+)\}/gi, 'DC $1')
    .replace(/\{@damage\s+([^}]+)\}/gi, '$1')
    .replace(/\{@dice\s+([^}|]+)(?:\|[^}]*)?\}/gi, '$1')
    .replace(/\{@scaledamage\s+[^|]+\|[^|]+\|([^}]+)\}/gi, '$1')
    .replace(/\{@filter\s+([^|]+)\|[^}]*\}/gi, '$1')
    .replace(/\{@creature\s+([^|]+)\|?[^}]*\}/gi, '$1')
    .replace(/\{@spell\s+([^|]+)\|?[^}]*\}/gi, '$1')
    .replace(/\{@item\s+([^|]+)\|?[^}]*\}/gi, '$1')
    .replace(/\{@condition\s+([^|]+)\|?[^}]*\}/gi, '$1')
    .replace(/\{@skill\s+([^|]+)\|?[^}]*\}/gi, '$1')
    .replace(/\{@sense\s+([^|]+)\|?[^}]*\}/gi, '$1')
    .replace(/\{@note\s+([^}]+)\}/gi, '$1')
    // Generic fallback for any other {@tag content}
    .replace(/\{@\w+\s+([^}|]+)(?:\|[^}]*)?\}/gi, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}
