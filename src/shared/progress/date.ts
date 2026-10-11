/** Stable ISO calendar day in IST, independent of the host timezone. */
export function istDate(now = new Date()): string {
  return new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10);
}
