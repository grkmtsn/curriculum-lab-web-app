import { createFileRoute } from '@tanstack/react-router'
import { randomUUID } from 'node:crypto';
import { createInstitutionHandler } from '../../api/institutions';
import type { CreateInstitutionResponse } from '../../api/institutions';
import { logInfo } from '../../utils/logger';

export const Route = createFileRoute('/api/institutions')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const requestId = randomUUID();
        let payload: unknown;

        try {
          payload = await request.json();
        } catch {
          const errorResponse: CreateInstitutionResponse = {
            error: {
              code: 'REQUEST_INVALID',
              message: 'Invalid JSON body.',
              retryable: false,
            },
          };

          return jsonResponse(errorResponse, 400, requestId);
        }

        logInfo('request.received', { request_id: requestId, path: '/api/institutions' });

        const result = await createInstitutionHandler(payload);
        return jsonResponse(result, statusFromResult(result), requestId);
      },
    }
  }
});

function statusFromResult(result: CreateInstitutionResponse): number {
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

function jsonResponse(body: CreateInstitutionResponse, status: number, requestId: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'x-request-id': requestId,
    },
  });
}
