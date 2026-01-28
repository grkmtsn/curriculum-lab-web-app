import { createHmac } from 'node:crypto';

const MIN_SALT_LENGTH = 16;

export function getPilotTokenSalt(): string {
  const salt = process.env.PILOT_TOKEN_SALT;
  if (!salt || salt.trim().length < MIN_SALT_LENGTH) {
    throw new Error('PILOT_TOKEN_SALT must be set to a secure value.');
  }
  return salt;
}

export function hashPilotToken(pilotToken: string): string {
  const salt = getPilotTokenSalt();
  return createHmac('sha256', salt).update(pilotToken).digest('hex');
}
