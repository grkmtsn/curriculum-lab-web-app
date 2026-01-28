import fs from "node:fs";
import path from "node:path";
import {
  activityTemplatesConfigSchema,
  ageGroupsConfigSchema,
  safetyRulesConfigSchema,
  themesConfigSchema,
  type ActivityTemplatesConfig,
  type AgeGroupsConfig,
  type SafetyRulesConfig,
  type ThemesConfig,
} from "./schemas";

export type AppConfig = {
  ageGroups: AgeGroupsConfig;
  themes: ThemesConfig;
  activityTemplates: ActivityTemplatesConfig;
  safetyRules: SafetyRulesConfig;
};

let cachedConfig: AppConfig | null = null;

const CONFIG_DIR = path.resolve(process.cwd(), "config");

function readJsonFile<T>(filename: string): T {
  const fullPath = path.join(CONFIG_DIR, filename);
  const raw = fs.readFileSync(fullPath, "utf-8");
  return JSON.parse(raw) as T;
}

export function loadConfig(): AppConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const ageGroupsRaw = readJsonFile<unknown>("age_groups.json");
  const themesRaw = readJsonFile<unknown>("themes.json");
  const templatesRaw = readJsonFile<unknown>("activity_templates.json");
  const safetyRulesRaw = readJsonFile<unknown>("safety_rules.json");

  const ageGroups = ageGroupsConfigSchema.parse(ageGroupsRaw);
  const themes = themesConfigSchema.parse(themesRaw);
  const activityTemplates = activityTemplatesConfigSchema.parse(templatesRaw);
  const safetyRules = safetyRulesConfigSchema.parse(safetyRulesRaw);

  cachedConfig = {
    ageGroups,
    themes,
    activityTemplates,
    safetyRules,
  };

  return cachedConfig;
}

export function getConfig(): AppConfig {
  return loadConfig();
}

export function clearConfigCache(): void {
  cachedConfig = null;
}
