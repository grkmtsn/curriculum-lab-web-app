import { z } from "zod";
import { loadConfig } from "../config/loader";

const ENERGY_LEVELS = ["calm", "medium", "active"] as const;
const CURRICULUM_STYLES = [
  "Play-based",
  "Montessori-inspired",
  "Reggio-inspired",
  "Mixed",
] as const;

const DURATION_OPTIONS = [30, 45, 60] as const;
const GROUP_SIZE_MIN = 2;
const GROUP_SIZE_MAX = 30;
const PILOT_TOKEN_MIN_LENGTH = 32;
const PILOT_TOKEN_MAX_LENGTH = 128;
const PILOT_TOKEN_REGEX = /^[A-Za-z0-9_-]+$/;

export type GenerateRequest = {
  pilot_token: string;
  age_group: string;
  duration_minutes: number;
  theme: string;
  group_size: number;
  energy_level?: (typeof ENERGY_LEVELS)[number];
  curriculum_style?: (typeof CURRICULUM_STYLES)[number];
  regenerate?: boolean;
};

export class RequestValidationError extends Error {
  public readonly code: "REQUEST_INVALID";
  public readonly retryable: boolean;

  constructor(message: string) {
    super(message);
    this.code = "REQUEST_INVALID";
    this.retryable = false;
  }
}

export function validateGenerateRequest(input: unknown): GenerateRequest {
  const config = loadConfig();
  const allowedAgeGroups = new Set(Object.keys(config.ageGroups));
  const allowedThemes = new Set(Object.keys(config.themes));

  const schema = z
    .object({
      pilot_token: z
        .string()
        .trim()
        .min(PILOT_TOKEN_MIN_LENGTH)
        .max(PILOT_TOKEN_MAX_LENGTH)
        .regex(PILOT_TOKEN_REGEX, "Invalid pilot_token format."),
      age_group: z
        .string()
        .trim()
        .refine((value) => allowedAgeGroups.has(value), {
          message: "Unsupported age_group.",
        }),
      duration_minutes: z
        .number()
        .int()
        .refine(
          (value) =>
            DURATION_OPTIONS.includes(value as (typeof DURATION_OPTIONS)[number]),
          {
            message: "Unsupported duration_minutes.",
          },
        ),
      theme: z
        .string()
        .trim()
        .refine((value) => allowedThemes.has(value), {
          message: "Unsupported theme.",
        }),
      group_size: z.number().int().min(GROUP_SIZE_MIN).max(GROUP_SIZE_MAX),
      energy_level: z.enum(ENERGY_LEVELS).optional(),
      curriculum_style: z.enum(CURRICULUM_STYLES).optional(),
      regenerate: z.boolean().optional().default(false),
    })
    .strict();

  try {
    return schema.parse(input);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.issues.map((issue) => issue.message).join(" ");
      throw new RequestValidationError(message || "Invalid request.");
    }
    throw error;
  }
}
