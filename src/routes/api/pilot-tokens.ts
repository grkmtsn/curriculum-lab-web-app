import { createFileRoute } from '@tanstack/react-router';
import { randomUUID } from 'node:crypto';
import { createPilotTokenHandler } from '../../api/pilotTokens';
import type { CreatePilotTokenResponse } from '../../api/pilotTokens';
import { logInfo } from '../../utils/logger';
import { getCorsHeaders, getSecurityHeaders } from '../../utils/http';

export const Route = createFileRoute('/api/pilot-tokens')({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => {
        return new Response(null, {
          status: 204,
          headers: {
            ...getSecurityHeaders(),
            ...getCorsHeaders(request),
          },
        });
      },
      POST: async ({ request }) => {
        const requestId = randomUUID();
        let payload: unknown;

        try {
          payload = await request.json();
        } catch {
          const errorResponse: CreatePilotTokenResponse = {
            error: {
              code: 'REQUEST_INVALID',
              message: 'Invalid JSON body.',
              retryable: false,
            },
          };

          return jsonResponse(errorResponse, 400, requestId, request);
        }

        logInfo('request.received', { request_id: requestId, path: '/api/pilot-tokens' });

        const result = await createPilotTokenHandler(payload);
        return jsonResponse(result, statusFromResult(result), requestId, request);
      },
    },
  },
});

function statusFromResult(result: CreatePilotTokenResponse): number {
  if (!('error' in result)) {
    return 201;
  }

  switch (result.error.code) {
    case 'REQUEST_INVALID':
      return 400;
    case 'UNKNOWN_ERROR':
    default:
      return 500;
  }
}

function jsonResponse(
  body: CreatePilotTokenResponse,
  status: number,
  requestId: string,
  request: Request,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'x-request-id': requestId,
      ...getSecurityHeaders(),
      ...getCorsHeaders(request),
    },
  });
}
