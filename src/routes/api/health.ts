import { createFileRoute } from "@tanstack/react-router";
import { randomUUID } from "node:crypto";
import { health } from "../../api/health";
import { getCorsHeaders, getSecurityHeaders } from "../../utils/http";
import { logInfo } from "../../utils/logger";

export const Route = createFileRoute("/api/health")({
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
      GET: ({ request }) => {
        const requestId = randomUUID();
        logInfo("request.received", { request_id: requestId, path: "/api/health" });

        const payload = health();
        return new Response(JSON.stringify(payload), {
          status: 200,
          headers: {
            "content-type": "application/json",
            "x-request-id": requestId,
            ...getSecurityHeaders(),
            ...getCorsHeaders(request),
          },
        });
      },
    },
  },
});
