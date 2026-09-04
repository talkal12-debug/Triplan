import type { WeatherProvider, WeatherResult } from "../types";

/** Offline weather: unknown. The planner then plans without weather and says so. */
export const mockWeather: WeatherProvider = {
  name: "mock-weather",
  async daily(): Promise<WeatherResult> {
    return { kind: "none", days: [], source: "demo" };
  },
};
