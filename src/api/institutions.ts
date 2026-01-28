import { z } from 'zod';
import { createInstitution } from '../db/repo';

export const createInstitutionSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    city: z.string().trim().min(1).max(80).default('Bucharest'),
  })
  .strict();

export type CreateInstitutionResponse =
  | {
      id: string;
      name: string | null;
      city: string;
    }
  | {
      error: {
        code: 'REQUEST_INVALID' | 'UNKNOWN_ERROR';
        message: string;
        retryable: boolean;
      };
    };

export async function createInstitutionHandler(
  input: unknown,
): Promise<CreateInstitutionResponse> {
  try {
    const payload = createInstitutionSchema.parse(input);
    const institution = await createInstitution({
      name: payload.name ?? null,
      city: payload.city,
    });

    return {
      id: institution.id,
      name: institution.name,
      city: institution.city,
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
        message: 'Unexpected error while creating institution.',
        retryable: false,
      },
    };
  }
}
