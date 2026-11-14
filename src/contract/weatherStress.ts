import type { WeatherForecast } from "./types";

/** Explicit scenario sensitivity, not a learned outage probability. */
export function weatherStress(forecast: WeatherForecast | undefined, tick: number) {
  const hour = Math.floor(tick / 6);
  if (!forecast || hour < 0 || hour >= 3) return 0;
  const wind = Math.min(1, Math.max(0, (forecast.windSpeed[hour] - 12) / 13));
  const rain = Math.min(1, Math.max(0, (forecast.precipitation[hour] - 5) / 15));
  return Math.max(wind, rain);
}
