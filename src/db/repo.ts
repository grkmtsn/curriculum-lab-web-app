import { Prisma } from "../../prisma/generated/client";
import { prisma } from "../../prisma/prisma";
import { todayKeyUtc } from "../utils/time";

export type PilotTokenRecord = {
  tokenHash: string;
  institutionId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
};

export async function findPilotTokenByHash(
  tokenHash: string,
): Promise<PilotTokenRecord | null> {
  const record = await prisma.pilotToken.findUnique({
    where: { tokenHash },
  });

  if (!record) {
    return null;
  }

  return {
    tokenHash: record.tokenHash,
    institutionId: record.institutionId,
    expiresAt: record.expiresAt,
    revokedAt: record.revokedAt,
    createdAt: record.createdAt,
  };
}

export type RateLimitRecord = {
  institutionId: string;
  date: string;
  count: number;
};

export async function incrementDailyRateLimit(
  institutionId: string,
): Promise<RateLimitRecord> {
  const date = todayKeyUtc();

  const record = await prisma.rateLimit.upsert({
    where: {
      institutionId_date: {
        institutionId,
        date,
      },
    },
    update: {
      count: { increment: 1 },
    },
    create: {
      institutionId,
      date,
      count: 1,
    },
  });

  return {
    institutionId: record.institutionId,
    date: record.date,
    count: record.count,
  };
}

export type CreateInstitutionInput = {
  name?: string | null;
  city: string;
};

export type InstitutionRecord = {
  id: string;
  name: string | null;
  city: string;
  createdAt: Date;
};

export async function createInstitution(
  input: CreateInstitutionInput,
): Promise<InstitutionRecord> {
  const record = await prisma.institution.create({
    data: {
      name: input.name ?? null,
      city: input.city,
    },
  });

  return {
    id: record.id,
    name: record.name,
    city: record.city,
    createdAt: record.createdAt,
  };
}

export type CreatePilotTokenInput = {
  tokenHash: string;
  institutionId: string;
  expiresAt: Date;
};

export type PilotTokenCreateResult = {
  tokenHash: string;
  institutionId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
};

export async function createPilotToken(
  input: CreatePilotTokenInput,
): Promise<PilotTokenCreateResult> {
  const record = await prisma.pilotToken.create({
    data: {
      tokenHash: input.tokenHash,
      institutionId: input.institutionId,
      expiresAt: input.expiresAt,
    },
  });

  return {
    tokenHash: record.tokenHash,
    institutionId: record.institutionId,
    expiresAt: record.expiresAt,
    revokedAt: record.revokedAt,
    createdAt: record.createdAt,
  };
}

export type CreateGenerationInput = {
  institutionId: string;
  requestPayload: Prisma.InputJsonValue;
  outlineJson: Prisma.InputJsonValue | null;
  finalJson: Prisma.InputJsonValue | null;
  validationPass: boolean;
  latencyMs?: number | null;
  modelName?: string | null;
  regenerateFlag: boolean;
  errorCode?: string | null;
};

export type GenerationRecord = {
  id: string;
  institutionId: string;
  createdAt: Date;
  requestPayload: Prisma.JsonValue;
  outlineJson: Prisma.JsonValue | null;
  finalJson: Prisma.JsonValue | null;
  validationPass: boolean;
  latencyMs: number | null;
  modelName: string | null;
  regenerateFlag: boolean;
  errorCode: string | null;
};

export async function createGeneration(
  input: CreateGenerationInput,
): Promise<GenerationRecord> {
  const record = await prisma.generation.create({
    data: {
      institutionId: input.institutionId,
      requestPayload: input.requestPayload,
      outlineJson: input.outlineJson ?? Prisma.JsonNull,
      finalJson: input.finalJson ?? Prisma.JsonNull,
      validationPass: input.validationPass,
      latencyMs: input.latencyMs ?? null,
      modelName: input.modelName ?? null,
      regenerateFlag: input.regenerateFlag,
      errorCode: input.errorCode ?? null,
    },
  });

  return {
    id: record.id,
    institutionId: record.institutionId,
    createdAt: record.createdAt,
    requestPayload: record.requestPayload,
    outlineJson: record.outlineJson,
    finalJson: record.finalJson,
    validationPass: record.validationPass,
    latencyMs: record.latencyMs,
    modelName: record.modelName,
    regenerateFlag: record.regenerateFlag,
    errorCode: record.errorCode,
  };
}

export async function listRecentGenerations(
  institutionId: string,
  limit = 20,
): Promise<GenerationRecord[]> {
  const records = await prisma.generation.findMany({
    where: { institutionId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return records.map((record) => ({
    id: record.id,
    institutionId: record.institutionId,
    createdAt: record.createdAt,
    requestPayload: record.requestPayload,
    outlineJson: record.outlineJson,
    finalJson: record.finalJson,
    validationPass: record.validationPass,
    latencyMs: record.latencyMs,
    modelName: record.modelName,
    regenerateFlag: record.regenerateFlag,
    errorCode: record.errorCode,
  }));
}
