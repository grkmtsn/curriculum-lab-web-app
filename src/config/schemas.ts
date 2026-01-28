import { z } from "zod";

export const ACTIVITY_SCHEMA_VERSION = "activity.v1";

const ageGroupSchema = z.object({
  label: z.string(),
  development_focus: z.array(z.string()),
  constraints: z.array(z.string()),
  pedagogical_notes: z.array(z.string()),
});

const themeSchema = z.object({
  label: z.string(),
  learning_outcomes: z.array(z.string()),
  suggested_activity_types: z.array(z.string()),
  materials_pool: z.array(z.string()),
});

export const ageGroupsConfigSchema = z.record(ageGroupSchema);
export const themesConfigSchema = z.record(themeSchema);

export const activityTemplatesConfigSchema = z.object({
  schema_version: z.literal(ACTIVITY_SCHEMA_VERSION),
  required_sections: z.array(z.string()),
  style_rules: z.array(z.string()),
  min_steps: z.number().int().positive().optional(),
  min_materials: z.number().int().positive().optional(),
  time_tolerance_minutes: z.number().int().positive().optional(),
});

export const safetyRulesConfigSchema = z.array(z.string());

export type AgeGroupsConfig = z.infer<typeof ageGroupsConfigSchema>;
export type ThemesConfig = z.infer<typeof themesConfigSchema>;
export type ActivityTemplatesConfig = z.infer<typeof activityTemplatesConfigSchema>;
export type SafetyRulesConfig = z.infer<typeof safetyRulesConfigSchema>;
