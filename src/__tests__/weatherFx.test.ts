import { describe, expect, it } from 'vitest';
import { getWeatherFxConfig } from '../lib/weatherFx';

describe('getWeatherFxConfig', () => {
  it('uses the Weather FX thunderstorm asset with lightning enabled', () => {
    expect(getWeatherFxConfig('storm')).toEqual({
      asset: '/weather/thunderstorm.webp',
      lightning: true,
    });
  });

  it('uses the matching Weather FX asset for rain', () => {
    expect(getWeatherFxConfig('rain')).toEqual({
      asset: '/weather/rain.webp',
      lightning: false,
    });
  });
});
