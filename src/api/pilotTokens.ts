import { z } from 'zod';
import crypto from 'node:crypto';
import { createPilotToken } from '../db/repo';
import { hashPilotToken } from '../utils/hash';

const createPilotTokenSchema = z
  .object({
    institution_id: z.string().uuid(),
    expires_in_days: z.number().int().min(1).max(30).optional(),
  })
  .strict();

export type CreatePilotTokenResponse =
  | {
      pilot_token: string;
      institution_id: string;
      expires_at: string;
    }
  | {
      error: {
        code: 'REQUEST_INVALID' | 'UNKNOWN_ERROR';
        message: string;
        retryable: boolean;
      };
    };

export async function createPilotTokenHandler(
  input: unknown,
): Promise<CreatePilotTokenResponse> {
  try {
    const payload = createPilotTokenSchema.parse(input);
    const expiresInDays = payload.expires_in_days ?? 14;
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

    const pilotToken = generatePilotToken();
    const tokenHash = hashPilotToken(pilotToken);

    await createPilotToken({
      tokenHash,
      institutionId: payload.institution_id,
      expiresAt,
    });

    return {
      pilot_token: pilotToken,
      institution_id: payload.institution_id,
      expires_at: expiresAt.toISOString(),
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        error: {
          code: 'REQUEST_INVALID',
          message: error.issues.map((issue) => issue.message).join(' ') || 'Invalid request.',
          retryable: false,
        },
      };
    }

    return {
      error: {
        code: 'UNKNOWN_ERROR',
        message: 'Unexpected error while creating pilot token.',
        retryable: false,
      },
    };
  }
}

function generatePilotToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const raw = Buffer.from(bytes).toString('base64');
  return raw.replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
