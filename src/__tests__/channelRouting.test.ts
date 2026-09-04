import { describe, it, expect } from 'vitest';
import { resolveChannels } from '../hooks/useSoundboard';

describe('resolveChannels', () => {
  it('center pan → FL + FR', () => {
    expect(resolveChannels(0, 0)).toEqual([0, 1]);
  });
  it('hard left front → FL', () => {
    expect(resolveChannels(-0.8, 0.2)).toEqual([0]);
  });
  it('hard left back → SL', () => {
    expect(resolveChannels(-0.8, -0.8)).toEqual([4]);
  });
  it('hard right front → FR', () => {
    expect(resolveChannels(0.8, 0.2)).toEqual([1]);
  });
  it('hard right back → SR', () => {
    expect(resolveChannels(0.8, -0.8)).toEqual([5]);
  });
  it('forward center → C', () => {
    expect(resolveChannels(0, -0.8)).toEqual([2]);
  });
});
