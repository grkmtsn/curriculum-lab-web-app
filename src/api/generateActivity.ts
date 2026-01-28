import { loadConfig } from '../config/loader';
import { ACTIVITY_SCHEMA_VERSION } from '../config/schemas';
import { enforceRateLimit, RateLimitError } from '../middleware/rateLimit';
import { verifyPilotToken, PilotTokenError } from '../middleware/pilotAuth';
import {
  RequestValidationError,
  validateGenerateRequest,
} from '../middleware/validateRequest';
import { orchestrateActivity, OrchestratorError } from '../services/orchestrator';

export type GenerateActivitySuccess = {
  schema_version: typeof ACTIVITY_SCHEMA_VERSION;
  activity: unknown;
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

export async function generateActivity(input: unknown): Promise<GenerateActivityResponse> {
  try {
    const request = validateGenerateRequest(input);
    const authResult = await verifyPilotToken(request.pilot_token);

    await enforceRateLimit(authResult.institutionId);

    const config = loadConfig();
    const activity = await orchestrateActivity({
      request,
      institutionId: authResult.institutionId,
      config,
    });

    return {
      schema_version: ACTIVITY_SCHEMA_VERSION,
      activity,
    };
  } catch (error) {
    return mapGenerateError(error);
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
