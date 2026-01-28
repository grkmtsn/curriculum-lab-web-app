import { prisma } from '../../prisma/prisma';

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
