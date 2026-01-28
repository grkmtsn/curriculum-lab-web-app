import { z } from 'zod';

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
  const errors: string[] = [];

  if (outline.step_plan.length < 5) {
    errors.push('step_plan must have at least 5 steps.');
  }

  if (outline.materials.length < 5) {
    errors.push('materials must have at least 5 items.');
  }

  if (outline.safety_checks.length < 3) {
    errors.push('safety_checks must have at least 3 items.');
  }

  if (containsNonEnglish(outline)) {
    errors.push('Outline must be English only.');
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, outline };
}

function containsNonEnglish(outline: Outline): boolean {
  const values: string[] = [];

  values.push(outline.activity_concept);
  values.push(...outline.learning_outcomes);
  values.push(...outline.materials);
  values.push(...outline.safety_checks);

  outline.step_plan.forEach((step) => values.push(step.label));
  values.push(...outline.adaptations_plan.easier);
  values.push(...outline.adaptations_plan.harder);

  return values.some((value) => /[^\x00-\x7F]/.test(value));
}
