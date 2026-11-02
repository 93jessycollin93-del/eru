/**
 * Air temperature. Engine-agnostic. The setting is late autumn: cold nights,
 * cool days. Weather (rain, wind) will modify this in a later session.
 */
export function airTemperature(minuteOfDay: number, day: number, sheltered: boolean): number {
  const h = minuteOfDay / 60;
  // Coldest just before dawn (5:00), warmest mid-afternoon (15:00).
  const daily = Math.cos(((h - 15) / 24) * Math.PI * 2);
  // Autumn gets a little colder every day.
  let t = 8.5 + daily * 5.5 - Math.min(6, (day - 1) * 0.3);
  if (sheltered) t = Math.min(18, t + 7);
  return t;
}
