export type DamageType =
  | 'fire' | 'cold' | 'lightning' | 'thunder' | 'acid' | 'poison'
  | 'radiant' | 'necrotic' | 'force' | 'psychic'
  | 'slashing' | 'piercing' | 'bludgeoning'
  | 'heal' | 'generic';

export const DAMAGE_TYPES_REGEX = /\b(slashing|piercing|bludgeoning|fire|cold|lightning|thunder|acid|poison|radiant|necrotic|force|psychic)\b/i;

export function extractDamageType(description: string): DamageType | undefined {
  const match = description.match(DAMAGE_TYPES_REGEX);
  return match ? (match[1].toLowerCase() as DamageType) : undefined;
}

export interface FlashColors {
  glow: string;
  border: string;
  bg: string;
  particle: string;
}

export const DAMAGE_COLORS: Record<DamageType, FlashColors> = {
  fire:        { glow: 'rgba(249,115,22,.5)',  border: 'rgba(249,115,22,.7)',  bg: 'rgba(249,115,22,.18)',  particle: '#f97316' },
  cold:        { glow: 'rgba(56,189,248,.45)', border: 'rgba(56,189,248,.65)', bg: 'rgba(56,189,248,.15)',  particle: '#38bdf8' },
  lightning:   { glow: 'rgba(253,224,71,.5)',  border: 'rgba(253,224,71,.7)',  bg: 'rgba(253,224,71,.17)',  particle: '#fde047' },
  thunder:     { glow: 'rgba(168,85,247,.45)', border: 'rgba(168,85,247,.65)', bg: 'rgba(168,85,247,.15)',  particle: '#a855f7' },
  acid:        { glow: 'rgba(132,204,22,.45)', border: 'rgba(132,204,22,.65)', bg: 'rgba(132,204,22,.15)',  particle: '#84cc16' },
  poison:      { glow: 'rgba(16,185,129,.4)',  border: 'rgba(16,185,129,.6)',  bg: 'rgba(16,185,129,.13)',  particle: '#10b981' },
  radiant:     { glow: 'rgba(251,191,36,.5)',  border: 'rgba(251,191,36,.7)',  bg: 'rgba(251,191,36,.18)',  particle: '#fbbf24' },
  necrotic:    { glow: 'rgba(71,85,105,.5)',   border: 'rgba(71,85,105,.7)',   bg: 'rgba(71,85,105,.2)',    particle: '#475569' },
  force:       { glow: 'rgba(99,102,241,.45)', border: 'rgba(99,102,241,.65)', bg: 'rgba(99,102,241,.15)',  particle: '#6366f1' },
  psychic:     { glow: 'rgba(236,72,153,.45)', border: 'rgba(236,72,153,.65)', bg: 'rgba(236,72,153,.15)',  particle: '#ec4899' },
  slashing:    { glow: 'rgba(239,68,68,.35)',  border: 'rgba(239,68,68,.55)',  bg: 'rgba(239,68,68,.15)',   particle: '#ef4444' },
  piercing:    { glow: 'rgba(239,68,68,.35)',  border: 'rgba(239,68,68,.55)',  bg: 'rgba(239,68,68,.15)',   particle: '#ef4444' },
  bludgeoning: { glow: 'rgba(239,68,68,.35)',  border: 'rgba(239,68,68,.55)',  bg: 'rgba(239,68,68,.15)',   particle: '#ef4444' },
  heal:        { glow: 'rgba(52,211,153,.3)',  border: 'rgba(52,211,153,.5)',  bg: 'rgba(52,211,153,.1)',   particle: '#34d399' },
  generic:     { glow: 'rgba(239,68,68,.35)',  border: 'rgba(239,68,68,.55)',  bg: 'rgba(239,68,68,.15)',   particle: '#ef4444' },
};
