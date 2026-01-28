import { RATE_LIMIT_PER_DAY } from '../utils/time';
import { incrementDailyRateLimit } from '../db/repo';

export type RateLimitResult = {
  remaining: number;
  limit: number;
  count: number;
};

export class RateLimitError extends Error {
  public readonly code: 'RATE_LIMITED';
  public readonly retryable: boolean;

  constructor(message: string) {
    super(message);
    this.code = 'RATE_LIMITED';
    this.retryable = true;
  }
}

export async function enforceRateLimit(institutionId: string): Promise<RateLimitResult> {
  const limit = RATE_LIMIT_PER_DAY;
  const { count } = await incrementDailyRateLimit(institutionId);

  if (count > limit) {
    throw new RateLimitError('Daily generation limit reached for this pilot token.');
  }

  return {
    remaining: Math.max(limit - count, 0),
    limit,
    count,
  };
}
