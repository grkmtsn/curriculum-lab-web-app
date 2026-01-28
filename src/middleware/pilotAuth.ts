import { findPilotTokenByHash } from "../db/repo";
import { hashPilotToken } from "../utils/hash";

export type PilotAuthResult = {
  institutionId: string;
  tokenHash: string;
};

export class PilotTokenError extends Error {
  public readonly code:
    | "TOKEN_MISSING"
    | "TOKEN_INVALID"
    | "TOKEN_EXPIRED"
    | "TOKEN_REVOKED";
  public readonly retryable: boolean;

  constructor(
    code: "TOKEN_MISSING" | "TOKEN_INVALID" | "TOKEN_EXPIRED" | "TOKEN_REVOKED",
    message: string,
    retryable = false,
  ) {
    super(message);
    this.code = code;
    this.retryable = retryable;
  }
}

const MIN_PILOT_TOKEN_LENGTH = 32;
const MAX_PILOT_TOKEN_LENGTH = 128;
const PILOT_TOKEN_REGEX = /^[A-Za-z0-9_-]+$/;

export async function verifyPilotToken(pilotToken: string): Promise<PilotAuthResult> {
  const token = pilotToken?.trim();
  if (
    !token ||
    token.length < MIN_PILOT_TOKEN_LENGTH ||
    token.length > MAX_PILOT_TOKEN_LENGTH ||
    !PILOT_TOKEN_REGEX.test(token)
  ) {
    throw new PilotTokenError("TOKEN_MISSING", "Pilot token is missing.");
  }

  const tokenHash = hashPilotToken(token);
  const record = await findPilotTokenByHash(tokenHash);

  if (!record) {
    throw new PilotTokenError("TOKEN_INVALID", "Pilot token is invalid.");
  }

  if (record.revokedAt) {
    throw new PilotTokenError("TOKEN_REVOKED", "Pilot token has been revoked.");
  }

  const now = new Date();
  if (record.expiresAt.getTime() <= now.getTime()) {
    throw new PilotTokenError("TOKEN_EXPIRED", "Pilot token has expired.", true);
  }

  return {
    institutionId: record.institutionId,
    tokenHash: record.tokenHash,
  };
}
