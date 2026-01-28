import { randomUUID } from 'node:crypto';
import { loadConfig } from '../config/loader';
import { ACTIVITY_SCHEMA_VERSION } from '../config/schemas';
import { enforceRateLimit, RateLimitError } from '../middleware/rateLimit';
import { verifyPilotToken, PilotTokenError } from '../middleware/pilotAuth';
import {
  RequestValidationError,
  validateGenerateRequest,
} from '../middleware/validateRequest';
import { orchestrateActivity, OrchestratorError, type OrchestratorResult } from '../services/orchestrator';
import { logInfo, logMetric, logWarn } from '../utils/logger';

export type GenerateActivitySuccess = {
  schema_version: typeof ACTIVITY_SCHEMA_VERSION;
  activity: OrchestratorResult;
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

  try {
    const request = validateGenerateRequest(input);
    const authResult = await verifyPilotToken(request.pilot_token);

    await enforceRateLimit(authResult.institutionId);

    const config = loadConfig();
    const activity = await orchestrateActivity({
      request,
      institutionId: authResult.institutionId,
      config,
      requestId,
    });

    logMetric('request.success', {
      request_id: requestId,
      latency_ms: Date.now() - startedAt,
    });

    return {
      schema_version: ACTIVITY_SCHEMA_VERSION,
      activity,
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
