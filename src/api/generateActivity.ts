import { randomUUID } from 'node:crypto';
import { loadConfig } from '../config/loader';
import { ACTIVITY_SCHEMA_VERSION } from '../config/schemas';
import { enforceRateLimit, RateLimitError } from '../middleware/rateLimit';
import { verifyPilotToken, PilotTokenError } from '../middleware/pilotAuth';
import {
  RequestValidationError,
  validateGenerateRequest,
} from '../middleware/validateRequest';
import { orchestrateActivity, OrchestratorError } from '../services/orchestrator';
import type { FinalActivity } from '../services/validators';
import { logInfo, logMetric, logWarn } from '../utils/logger';
import { createGeneration } from '../db/repo';
import { Prisma } from '../../prisma/generated/client';

export type GenerateActivitySuccess = {
  schema_version: typeof ACTIVITY_SCHEMA_VERSION;
  activity: FinalActivity['activity'];
};

export type GenerateActivityError = {
  error: {
    code:
      | 'TOKEN_MISSING'
      | 'TOKEN_INVALID'
      | 'TOKEN_EXPIRED'
      | 'TOKEN_REVOKED'
      | 'RATE_LIMITED'
      | 'REQUEST_INVALID'
      | 'OPENAI_TIMEOUT'
      | 'OPENAI_ERROR'
      | 'OUTLINE_VALIDATION_FAILED'
      | 'FINAL_VALIDATION_FAILED'
      | 'NOVELTY_CHECK_FAILED'
      | 'UNKNOWN_ERROR';
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
  logInfo('request.start', { request_id: requestId, path: '/api/generate-activity' });

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
    const result = await orchestrateActivity({
      request,
      institutionId: authResult.institutionId,
      config,
      requestId,
    });

    finalJson = result.activity;
    outlineJson = result.outline;

    logMetric('request.success', {
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
        modelName: process.env.OPENAI_MODEL_STAGE2 ?? process.env.OPENAI_MODEL_STAGE1 ?? null,
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
      logMetric('rate_limit.triggered', {
        request_id: requestId,
      });
    }

    if (error instanceof RequestValidationError) {
      logMetric('request.validation_failed', {
        request_id: requestId,
      });
    }

    if (error instanceof OrchestratorError) {
      logWarn('request.orchestration_failed', {
        request_id: requestId,
        code: error.code,
      });
    }

    const mapped = mapGenerateError(error);
    logMetric('request.failed', {
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
        modelName: process.env.OPENAI_MODEL_STAGE2 ?? process.env.OPENAI_MODEL_STAGE1 ?? null,
        regenerateFlag: requestPayload.regenerate ?? false,
        errorCode: mapped.error.code,
      });
    }

    return mapped;
  }
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
      code: 'UNKNOWN_ERROR',
      message: 'Unexpected error while generating activity.',
      retryable: false,
    },
  };
}
