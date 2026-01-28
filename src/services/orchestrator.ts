import { randomUUID } from 'node:crypto';
import type { AppConfig } from '../config/loader';
import type { GenerateRequest } from '../middleware/validateRequest';
import { buildStage1Prompt } from './promptBuilder';
import { callOpenAIResponse, OpenAIClientError } from './openaiClient';
import { validateOutline } from './validators';

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
  input: OrchestratorInput,
): Promise<OrchestratorResult> {
  const outline = await generateStage1Outline(input);

  // Stage 2 not implemented yet.
  throw new OrchestratorError(
    'FINAL_VALIDATION_FAILED',
    'Stage 2 generation not implemented.',
    false,
  );
}

async function generateStage1Outline(input: OrchestratorInput) {
  const maxRetries = getMaxRetryStage1();
  const requestId = randomUUID();
  let attempt = 0;
  let lastErrors: string[] = [];

  while (attempt <= maxRetries) {
    try {
      const prompt = buildStage1Prompt({
        request: input.request,
        config: input.config,
      });

      const response = await callOpenAIResponse({
        requestId,
        model: process.env.OPENAI_MODEL_STAGE1 ?? 'gpt-4.1',
        input: [
          {
            role: 'system',
            content: [{ type: 'input_text', text: prompt.system }],
          },
          {
            role: 'user',
            content: [{ type: 'input_text', text: prompt.user }],
          },
        ],
      });

      const outputText = extractOutputText(response);
      if (!outputText) {
        lastErrors = ['OpenAI response did not include text output.'];
        throw new Error('Missing output text');
      }

      let outlineJson: unknown;
      try {
        outlineJson = JSON.parse(outputText);
      } catch {
        lastErrors = ['Outline is not valid JSON.'];
        throw new Error('Invalid JSON');
      }

      const validation = validateOutline(outlineJson);
      if (!validation.ok) {
        lastErrors = validation.errors;
        throw new Error('Outline validation failed');
      }

      return validation.outline;
    } catch (error) {
      if (error instanceof OpenAIClientError) {
        throw new OrchestratorError(error.code, error.message, error.retryable);
      }

      if (attempt < maxRetries) {
        attempt += 1;
        continue;
      }

      throw new OrchestratorError(
        'OUTLINE_VALIDATION_FAILED',
        lastErrors.join(' '),
        false,
      );
    }
  }

  throw new OrchestratorError(
    'OUTLINE_VALIDATION_FAILED',
    'Outline validation failed.',
    false,
  );
}

function extractOutputText(response: unknown): string | null {
  if (!response || typeof response !== 'object') {
    return null;
  }

  const anyResponse = response as Record<string, unknown>;
  if (typeof anyResponse.output_text === 'string') {
    return anyResponse.output_text;
  }

  const output = anyResponse.output;
  if (Array.isArray(output)) {
    for (const item of output) {
      if (item && typeof item === 'object') {
        const content = (item as { content?: unknown }).content;
        if (Array.isArray(content)) {
          for (const part of content) {
            if (part && typeof part === 'object' && (part as { type?: unknown }).type === 'output_text') {
              const text = (part as { text?: unknown }).text;
              if (typeof text === 'string') {
                return text;
              }
            }
          }
        }
      }
    }
  }

  return null;
}

function getMaxRetryStage1(): number {
  const value = Number.parseInt(process.env.MAX_RETRY_STAGE1 ?? '2', 10);
  if (!Number.isFinite(value) || value < 0) {
    return 2;
  }
  return value;
}
