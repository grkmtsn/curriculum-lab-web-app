import OpenAI from 'openai';
import { logInfo, logWarn } from '../utils/logger';
import { ResponseInput } from 'openai/resources/responses/responses.js';

const DEFAULT_MODEL = 'gpt-4.1';
const DEFAULT_TIMEOUT_MS = 25000;
const MAX_RETRY_DELAY_MS = 4000;

export type OpenAIRequestOptions = {
  requestId: string;
  model?: string;
  input: string | ResponseInput;
  timeoutMs?: number;
  maxRetries?: number;
  metadata?: Record<string, string>;
};

export type OpenAIResponse = {
  id?: string;
  [key: string]: unknown;
};

export class OpenAIClientError extends Error {
  public readonly code: 'OPENAI_TIMEOUT' | 'OPENAI_ERROR';
  public readonly retryable: boolean;

  constructor(code: 'OPENAI_TIMEOUT' | 'OPENAI_ERROR', message: string, retryable: boolean) {
    super(message);
    this.code = code;
    this.retryable = retryable;
  }
}

let cachedClient: OpenAI | null = null;

function getClient(): OpenAI {
  if (cachedClient) {
    return cachedClient;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new OpenAIClientError('OPENAI_ERROR', 'OPENAI_API_KEY is not set.', false);
  }

  cachedClient = new OpenAI({ apiKey });
  return cachedClient;
}

export async function callOpenAIResponse(
  options: OpenAIRequestOptions,
): Promise<OpenAIResponse> {
  const {
    requestId,
    model = DEFAULT_MODEL,
    input,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxRetries = 0,
    metadata,
  } = options;

  const payload = {
    model,
    input,
    metadata,
  };

  logInfo('openai.request.start', { request_id: requestId, model });

  let attempt = 0;
  while (true) {
    try {
      const client = getClient();
      const response = (await withTimeout(
        () => client.responses.create(payload),
        timeoutMs
      )) as unknown as OpenAIResponse;

      logInfo('openai.request.success', {
        request_id: requestId,
        response_id: response.id ?? 'unknown',
      });

      return response;
    } catch (error) {
      if (error instanceof OpenAIClientError) {
        if (error.retryable && attempt < maxRetries) {
          await sleepWithBackoff(attempt);
          attempt += 1;
          continue;
        }
        throw error;
      }

      if (attempt < maxRetries) {
        await sleepWithBackoff(attempt);
        attempt += 1;
        continue;
      }

      logWarn('openai.request.error', {
        request_id: requestId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new OpenAIClientError('OPENAI_ERROR', 'OpenAI request failed.', true);
    }
  }
}

class TimeoutError extends Error {}

async function withTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutHandle: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      fn(),
      new Promise<T>((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new TimeoutError()), timeoutMs);
      }),
    ]);
  } catch (error) {
    if (error instanceof TimeoutError) {
      throw new OpenAIClientError('OPENAI_TIMEOUT', 'OpenAI request timed out.', true);
    }
    throw error;
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

function sleepWithBackoff(attempt: number): Promise<void> {
  const delay = Math.min(500 * Math.pow(2, attempt), MAX_RETRY_DELAY_MS);
  return new Promise((resolve) => setTimeout(resolve, delay));
}
