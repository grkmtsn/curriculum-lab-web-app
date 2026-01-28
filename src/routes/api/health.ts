import { createFileRoute } from '@tanstack/react-router'
import { randomUUID } from 'node:crypto';
import { createAPIFileRoute } from '@tanstack/start/api';
import { health } from '../../api/health';
import { logInfo } from '../../utils/logger';

export const Route = createAPIFileRoute('/api/health')({
  GET: () => {
    const requestId = randomUUID();
    logInfo('request.received', { request_id: requestId, path: '/api/health' });

    const payload = health();
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'x-request-id': requestId,
      },
    });
  },
});
