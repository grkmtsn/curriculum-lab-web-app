import { createFileRoute } from '@tanstack/react-router'
import type { GenerateActivityResponse } from '../../api/generateActivity';
import { generateActivity } from '../../api/generateActivity';

export const Route = createFileRoute('/api/generate-activity')({

  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: unknown;

        try {
          payload = await request.json();
        } catch {
          const errorResponse: GenerateActivityResponse = {
            error: {
              code: 'REQUEST_INVALID',
              message: 'Invalid JSON body.',
              retryable: false,
            },
          };

          return jsonResponse(errorResponse, 400);
        }

        const result = await generateActivity(payload);
        return jsonResponse(result, statusFromResult(result));
      },
    }
  }
});

function statusFromResult(result: GenerateActivityResponse): number {
  if (!('error' in result)) {
    return 200;
  }

  switch (result.error.code) {
    case 'REQUEST_INVALID':
      return 400;
    case 'TOKEN_MISSING':
    case 'TOKEN_INVALID':
    case 'TOKEN_EXPIRED':
    case 'TOKEN_REVOKED':
      return 401;
    case 'RATE_LIMITED':
      return 429;
    case 'OPENAI_TIMEOUT':
    case 'OPENAI_ERROR':
    case 'OUTLINE_VALIDATION_FAILED':
    case 'FINAL_VALIDATION_FAILED':
    case 'NOVELTY_CHECK_FAILED':
    case 'UNKNOWN_ERROR':
    default:
      return 500;
  }
}

function jsonResponse(body: GenerateActivityResponse, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });
}
