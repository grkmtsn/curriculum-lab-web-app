export function startOfDayUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function todayKeyUtc(date: Date = new Date()): string {
  return startOfDayUtc(date).toISOString().slice(0, 10);
}

export const RATE_LIMIT_PER_DAY = Number.parseInt(
  process.env.RATE_LIMIT_PER_DAY ?? "10",
  10,
);

if (!Number.isFinite(RATE_LIMIT_PER_DAY) || RATE_LIMIT_PER_DAY <= 0) {
  throw new Error("RATE_LIMIT_PER_DAY must be a positive integer.");
}
