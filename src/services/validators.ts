import { z } from "zod";
import { ACTIVITY_SCHEMA_VERSION } from "../config/schemas";

export const outlineSchema = z.object({
  activity_concept: z.string(),
  learning_outcomes: z.array(z.string()),
  materials: z.array(z.string()),
  step_plan: z.array(
    z.object({
      step: z.number().int(),
      label: z.string(),
      time_minutes: z.number().int(),
    }),
  ),
  adaptations_plan: z.object({
    easier: z.array(z.string()),
    harder: z.array(z.string()),
  }),
  safety_checks: z.array(z.string()),
});

export type Outline = z.infer<typeof outlineSchema>;

export type OutlineValidationResult =
  | { ok: true; outline: Outline }
  | { ok: false; errors: string[] };

export function validateOutline(input: unknown): OutlineValidationResult {
  const parsed = outlineSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) => issue.message),
    };
  }

  const outline = parsed.data;
  console.log(outline);
  const errors: string[] = [];

  if (outline.step_plan.length < 3) {
    errors.push("step_plan must have at least 5 steps.");
  }

  if (outline.materials.length < 3) {
    errors.push("materials must have at least 5 items.");
  }

  if (outline.safety_checks.length < 3) {
    errors.push("safety_checks must have at least 3 items.");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, outline };
}

export const finalActivitySchema = z
  .object({
    schema_version: z.literal(ACTIVITY_SCHEMA_VERSION),
    activity: z.object({
      title: z.string(),
      age_group: z.string(),
      duration_minutes: z.number().int(),
      group_size: z.number().int(),
      theme: z.string(),
      goal: z.string(),
      learning_outcomes: z.array(z.string()),
      materials: z.array(z.string()),
      steps: z.array(
        z.object({
          step: z.number().int(),
          instruction: z.string(),
          time_minutes: z.number().int(),
        }),
      ),
      adaptations: z.object({
        easier: z.array(z.string()),
        harder: z.array(z.string()),
      }),
      backup_plan: z.string(),
      teacher_tips: z.array(z.string()),
      safety_notes: z.array(z.string()),
    }),
  })
  .strict();

export type FinalActivity = z.infer<typeof finalActivitySchema>;

export type FinalValidationResult =
  | { ok: true; final: FinalActivity }
  | { ok: false; errors: string[] };

export function validateFinalActivity(input: unknown): FinalValidationResult {
  const parsed = finalActivitySchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) => issue.message),
    };
  }

  const finalJson = parsed.data;
  console.log(finalJson);
  const errors: string[] = [];

  if (finalJson.activity.steps.length === 0) {
    errors.push("steps must not be empty.");
  }

  if (finalJson.activity.materials.length === 0) {
    errors.push("materials must not be empty.");
  }

  if (finalJson.activity.safety_notes.length === 0) {
    errors.push("safety_notes must not be empty.");
  }

  const stepTotal = finalJson.activity.steps.reduce(
    (sum, step) => sum + step.time_minutes,
    0,
  );

  const duration = finalJson.activity.duration_minutes;
  if (Math.abs(stepTotal - duration) > 10) {
    errors.push("Sum of step time_minutes must be within ±10 minutes of duration.");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, final: finalJson };
}
