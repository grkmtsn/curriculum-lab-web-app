import type { AppConfig } from '../config/loader';
import type { GenerateRequest } from '../middleware/validateRequest';

export type OrchestratorInput = {
  request: GenerateRequest;
  institutionId: string;
  config: AppConfig;
};

export type OrchestratorResult = unknown;

export class OrchestratorError extends Error {
  public readonly code:
    | 'OPENAI_TIMEOUT'
    | 'OPENAI_ERROR'
    | 'OUTLINE_VALIDATION_FAILED'
    | 'FINAL_VALIDATION_FAILED'
    | 'NOVELTY_CHECK_FAILED';
  public readonly retryable: boolean;

  constructor(
    code:
      | 'OPENAI_TIMEOUT'
      | 'OPENAI_ERROR'
      | 'OUTLINE_VALIDATION_FAILED'
      | 'FINAL_VALIDATION_FAILED'
      | 'NOVELTY_CHECK_FAILED',
    message: string,
    retryable: boolean,
  ) {
    super(message);
    this.code = code;
    this.retryable = retryable;
  }
}

export async function orchestrateActivity(
  _input: OrchestratorInput,
): Promise<OrchestratorResult> {
  throw new OrchestratorError('OPENAI_ERROR', 'LLM orchestrator not implemented.', true);
}
