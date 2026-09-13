import type { PlayerViewWeather } from './playerViewSettings';

export interface WeatherFxConfig {
  asset: string;
  lightning: boolean;
}

const WEATHER_FX_CONFIG: Record<PlayerViewWeather, WeatherFxConfig> = {
  none: { asset: '', lightning: false },
  snow: { asset: '/weather/snow.webp', lightning: false },
  rain: { asset: '/weather/rain.webp', lightning: false },
  storm: { asset: '/weather/thunderstorm.webp', lightning: true },
  ash: { asset: '/weather/ashfall.webp', lightning: false },
  fog: { asset: '/weather/overcast.webp', lightning: false },
  motes: { asset: '/weather/clearSky.webp', lightning: false },
  leaves: { asset: '/weather/highWinds.webp', lightning: false },
  sand: { asset: '/weather/scorchingHeat.webp', lightning: false },
};

export function getWeatherFxConfig(weather: PlayerViewWeather): WeatherFxConfig {
  return WEATHER_FX_CONFIG[weather];
}
