import { randomUUID } from "node:crypto";
import { Prisma } from "../../prisma/generated/client";
import { loadConfig } from "../config/loader";
import { ACTIVITY_SCHEMA_VERSION } from "../config/schemas";
import { createGeneration, listRecentGenerations } from "../db/repo";
import { PilotTokenError, verifyPilotToken } from "../middleware/pilotAuth";
import { enforceRateLimit, RateLimitError } from "../middleware/rateLimit";
import {
  RequestValidationError,
  validateGenerateRequest,
} from "../middleware/validateRequest";
import { orchestrateActivity, OrchestratorError } from "../services/orchestrator";
import type { FinalActivity } from "../services/validators";
import { logInfo, logMetric, logWarn } from "../utils/logger";
import { similarityScore } from "../services/novelty";

export type GenerateActivitySuccess = {
  schema_version: typeof ACTIVITY_SCHEMA_VERSION;
  activity: FinalActivity["activity"];
};

export type GenerateActivityError = {
  error: {
    code:
      | "TOKEN_MISSING"
      | "TOKEN_INVALID"
      | "TOKEN_EXPIRED"
      | "TOKEN_REVOKED"
      | "RATE_LIMITED"
      | "REQUEST_INVALID"
      | "OPENAI_TIMEOUT"
      | "OPENAI_ERROR"
      | "OUTLINE_VALIDATION_FAILED"
      | "FINAL_VALIDATION_FAILED"
      | "NOVELTY_CHECK_FAILED"
      | "UNKNOWN_ERROR";
    message: string;
    retryable: boolean;
  };
};

export type GenerateActivityResponse = GenerateActivitySuccess | GenerateActivityError;

export async function generateActivity(
  input: unknown,
  requestId: string = randomUUID(),
): Promise<GenerateActivityResponse> {
  const startedAt = Date.now();
  logInfo("request.start", { request_id: requestId, path: "/api/generate-activity" });

  let requestPayload: ReturnType<typeof validateGenerateRequest> | null = null;
  let institutionId: string | null = null;
  let outlineJson: Prisma.JsonValue | null = null;
  let finalJson: Prisma.JsonValue | null = null;

  try {
    const request = validateGenerateRequest(input);
    requestPayload = request;
    const authResult = await verifyPilotToken(request.pilot_token);
    institutionId = authResult.institutionId;

    await enforceRateLimit(authResult.institutionId);

    const config = loadConfig();

    if (!request.regenerate) {
      const cached = await findMostSimilarGeneration(authResult.institutionId, request);
      if (cached) {
        logMetric("generation.cache_hit", {
          request_id: requestId,
          generation_id: cached.id,
        });
        return {
          schema_version: ACTIVITY_SCHEMA_VERSION,
          activity: cached.activity,
        };
      }
    }
    const result = await orchestrateActivity({
      request,
      institutionId: authResult.institutionId,
      config,
      requestId,
    });

    finalJson = result.activity;
    outlineJson = result.outline;

    logMetric("request.success", {
      request_id: requestId,
      latency_ms: Date.now() - startedAt,
    });

    if (requestPayload && institutionId) {
      await createGeneration({
        institutionId,
        requestPayload,
        outlineJson,
        finalJson,
        validationPass: true,
        latencyMs: Date.now() - startedAt,
        modelName:
          process.env.OPENAI_MODEL_STAGE2 ?? process.env.OPENAI_MODEL_STAGE1 ?? null,
        regenerateFlag: request.regenerate ?? false,
        errorCode: null,
      });
    }

    return {
      schema_version: ACTIVITY_SCHEMA_VERSION,
      activity: result.activity,
    };
  } catch (error) {
    if (error instanceof RateLimitError) {
      logMetric("rate_limit.triggered", {
        request_id: requestId,
      });
    }

    if (error instanceof RequestValidationError) {
      logMetric("request.validation_failed", {
        request_id: requestId,
      });
    }

    if (error instanceof OrchestratorError) {
      logWarn("request.orchestration_failed", {
        request_id: requestId,
        code: error.code,
      });
    }

    const mapped = mapGenerateError(error);
    logMetric("request.failed", {
      request_id: requestId,
      code: mapped.error.code,
      latency_ms: Date.now() - startedAt,
    });

    if (requestPayload && institutionId) {
      await createGeneration({
        institutionId,
        requestPayload,
        outlineJson,
        finalJson,
        validationPass: false,
        latencyMs: Date.now() - startedAt,
        modelName:
          process.env.OPENAI_MODEL_STAGE2 ?? process.env.OPENAI_MODEL_STAGE1 ?? null,
        regenerateFlag: requestPayload.regenerate ?? false,
        errorCode: mapped.error.code,
      });
    }

    return mapped;
  }
}

async function findMostSimilarGeneration(
  institutionId: string,
  request: ReturnType<typeof validateGenerateRequest>,
) {
  const recent = await listRecentGenerations(institutionId, 30);
  const candidates = recent.filter((record) =>
    matchesRequestPayload(record.requestPayload, request),
  );

  if (candidates.length === 0) {
    return null;
  }

  const seed = candidates[0];
  const seedText = `${extractTitle(seed.finalJson)} ${extractConcept(seed.outlineJson)}`.trim();
  if (!seedText) {
    return null;
  }

  let best = seed;
  let bestScore = -1;

  for (const record of candidates) {
    const text = `${extractTitle(record.finalJson)} ${extractConcept(record.outlineJson)}`.trim();
    if (!text) {
      continue;
    }
    const score = similarityScore(seedText, text);
    if (score > bestScore) {
      bestScore = score;
      best = record;
    }
  }

  const activity = extractActivity(best.finalJson);
  if (!activity) {
    return null;
  }

  return { id: best.id, activity };
}

function matchesRequestPayload(
  payload: unknown,
  request: ReturnType<typeof validateGenerateRequest>,
): boolean {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  const data = payload as Record<string, unknown>;
  return (
    data.age_group === request.age_group &&
    data.duration_minutes === request.duration_minutes &&
    data.theme === request.theme &&
    data.group_size === request.group_size &&
    (data.energy_level ?? null) === (request.energy_level ?? null) &&
    (data.curriculum_style ?? null) === (request.curriculum_style ?? null)
  );
}

function extractTitle(finalJson: unknown): string {
  if (!finalJson || typeof finalJson !== "object") {
    return "";
  }
  const title = (finalJson as { title?: unknown }).title;
  return typeof title === "string" ? title : "";
}

function extractConcept(outlineJson: unknown): string {
  if (!outlineJson || typeof outlineJson !== "object") {
    return "";
  }
  const concept = (outlineJson as { activity_concept?: unknown }).activity_concept;
  return typeof concept === "string" ? concept : "";
}

function extractActivity(finalJson: unknown): FinalActivity["activity"] | null {
  if (!finalJson || typeof finalJson !== "object") {
    return null;
  }
  return finalJson as FinalActivity["activity"];
}

function mapGenerateError(error: unknown): GenerateActivityError {
  if (error instanceof PilotTokenError) {
    return {
      error: {
        code: error.code,
        message: error.message,
        retryable: error.retryable,
      },
    };
  }

  if (error instanceof RequestValidationError) {
    return {
      error: {
        code: error.code,
        message: error.message,
        retryable: error.retryable,
      },
    };
  }

  if (error instanceof RateLimitError) {
    return {
      error: {
        code: error.code,
        message: error.message,
        retryable: error.retryable,
      },
    };
  }

  if (error instanceof OrchestratorError) {
    return {
      error: {
        code: error.code,
        message: error.message,
        retryable: error.retryable,
      },
    };
  }

  return {
    error: {
      code: "UNKNOWN_ERROR",
      message: "Unexpected error while generating activity.",
      retryable: false,
    },
  };
}
