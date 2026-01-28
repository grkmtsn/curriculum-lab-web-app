import { randomUUID } from 'node:crypto';
import type { AppConfig } from '../config/loader';
import type { GenerateRequest } from '../middleware/validateRequest';
import { buildStage1Prompt, buildStage2Prompt } from './promptBuilder';
import { callOpenAIResponse, OpenAIClientError } from './openaiClient';
import { validateFinalActivity, validateOutline } from './validators';
import { checkNovelty } from './novelty';
import { logMetric } from '../utils/logger';

export type OrchestratorInput = {
  request: GenerateRequest;
  institutionId: string;
  config: AppConfig;
  recentConcepts?: string[];
  requestId?: string;
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
  const recentConcepts = input.recentConcepts ?? [];
  const noveltyThreshold = getNoveltyThreshold();
  let noveltyRetryUsed = false;
  const requestId = input.requestId ?? randomUUID();

  while (true) {
    const outline = await generateStage1Outline(input, recentConcepts, requestId);
    const finalActivity = await generateStage2Final(input, outline, requestId);

    if (input.request.regenerate && recentConcepts.length > 0) {
      const title = getFinalTitle(finalActivity);
      const concept = getOutlineConcept(outline);
      const novelty = checkNovelty({
        title,
        concept,
        recentConcepts,
        threshold: noveltyThreshold,
      });

      if (!novelty.ok) {
        logMetric('novelty.failed', {
          request_id: requestId,
          score: novelty.score,
          threshold: noveltyThreshold,
        });

        if (!noveltyRetryUsed) {
          noveltyRetryUsed = true;
          continue;
        }

        throw new OrchestratorError(
          'NOVELTY_CHECK_FAILED',
          'Generated activity too similar to recent concepts.',
          false,
        );
      }
    }

    return finalActivity;
  }
}

async function generateStage1Outline(
  input: OrchestratorInput,
  recentConcepts: string[],
  requestId: string,
) {
  const maxRetries = getMaxRetryStage1();
  let attempt = 0;
  let lastErrors: string[] = [];

  while (attempt <= maxRetries) {
    const startedAt = Date.now();
    try {
      const prompt = buildStage1Prompt({
        request: input.request,
        config: input.config,
        recentConcepts,
      });

      const response = await callOpenAIResponse({
        requestId,
        model: process.env.OPENAI_MODEL_STAGE1 ?? 'gpt-4.1',
        maxOutputTokens: getMaxOutputTokensStage1(),
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

      logMetric('stage1.success', {
        request_id: requestId,
        latency_ms: Date.now() - startedAt,
        retries: attempt,
      });

      return validation.outline;
    } catch (error) {
      const latencyMs = Date.now() - startedAt;
      logMetric('stage1.attempt_failed', {
        request_id: requestId,
        latency_ms: latencyMs,
        attempt,
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof OpenAIClientError) {
        throw new OrchestratorError(error.code, error.message, error.retryable);
      }

      if (attempt < maxRetries) {
        attempt += 1;
        continue;
      }

      logMetric('stage1.validation_failed', {
        request_id: requestId,
        errors: lastErrors,
      });

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

async function generateStage2Final(
  input: OrchestratorInput,
  outline: unknown,
  requestId: string,
) {
  const maxRetries = getMaxRetryStage2();
  let attempt = 0;
  let lastErrors: string[] = [];

  while (attempt <= maxRetries) {
    const startedAt = Date.now();
    try {
      const prompt = buildStage2Prompt({
        request: input.request,
        outlineJson: outline,
      });

      const response = await callOpenAIResponse({
        requestId,
        model: process.env.OPENAI_MODEL_STAGE2 ?? 'gpt-4.1',
        maxOutputTokens: getMaxOutputTokensStage2(),
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

      let finalJson: unknown;
      try {
        finalJson = JSON.parse(outputText);
      } catch {
        lastErrors = ['Final activity is not valid JSON.'];
        throw new Error('Invalid JSON');
      }

      const validation = validateFinalActivity(finalJson);
      if (!validation.ok) {
        lastErrors = validation.errors;
        throw new Error('Final validation failed');
      }

      logMetric('stage2.success', {
        request_id: requestId,
        latency_ms: Date.now() - startedAt,
        retries: attempt,
      });

      return validation.final;
    } catch (error) {
      const latencyMs = Date.now() - startedAt;
      logMetric('stage2.attempt_failed', {
        request_id: requestId,
        latency_ms: latencyMs,
        attempt,
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof OpenAIClientError) {
        throw new OrchestratorError(error.code, error.message, error.retryable);
      }

      if (attempt < maxRetries) {
        attempt += 1;
        continue;
      }

      logMetric('stage2.validation_failed', {
        request_id: requestId,
        errors: lastErrors,
      });

      throw new OrchestratorError(
        'FINAL_VALIDATION_FAILED',
        lastErrors.join(' '),
        false,
      );
    }
  }

  throw new OrchestratorError(
    'FINAL_VALIDATION_FAILED',
    'Final validation failed.',
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
  return Math.min(value, 2);
}

function getMaxRetryStage2(): number {
  const value = Number.parseInt(process.env.MAX_RETRY_STAGE2 ?? '1', 10);
  if (!Number.isFinite(value) || value < 0) {
    return 1;
  }
  return Math.min(value, 1);
}

function getNoveltyThreshold(): number {
  const value = Number.parseFloat(process.env.NOVELTY_THRESHOLD ?? '0.6');
  if (!Number.isFinite(value) || value <= 0) {
    return 0.6;
  }
  return value;
}

function getMaxOutputTokensStage1(): number {
  const value = Number.parseInt(process.env.MAX_OUTPUT_TOKENS_STAGE1 ?? '800', 10);
  if (!Number.isFinite(value) || value <= 0) {
    return 800;
  }
  return value;
}

function getMaxOutputTokensStage2(): number {
  const value = Number.parseInt(process.env.MAX_OUTPUT_TOKENS_STAGE2 ?? '1200', 10);
  if (!Number.isFinite(value) || value <= 0) {
    return 1200;
  }
  return value;
}

function getFinalTitle(finalActivity: unknown): string {
  if (!finalActivity || typeof finalActivity !== 'object') {
    return '';
  }
  const activity = (finalActivity as { activity?: unknown }).activity;
  if (!activity || typeof activity !== 'object') {
    return '';
  }
  const title = (activity as { title?: unknown }).title;
  return typeof title === 'string' ? title : '';
}

function getOutlineConcept(outline: unknown): string {
  if (!outline || typeof outline !== 'object') {
    return '';
  }
  const concept = (outline as { activity_concept?: unknown }).activity_concept;
  return typeof concept === 'string' ? concept : '';
}
