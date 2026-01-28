import { createFileRoute } from '@tanstack/react-router'
import { health } from '../../api/health';

export const Route = createFileRoute('/api/health')({
  server: {
    handlers: {
      GET: () => {
        const payload = health();
        return new Response(JSON.stringify(payload), {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        });
      },
    }
  }
});
