import { prisma } from '../../prisma/prisma';
import { todayKeyUtc } from '../utils/time';

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
