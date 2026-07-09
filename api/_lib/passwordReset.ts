import { createHash, randomBytes } from 'node:crypto';
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';

const tokensTable = tableInAppSchema('password_reset_tokens');

const RESET_TTL_MS = Number(process.env.PASSWORD_RESET_TTL_MINUTES || 60) * 60 * 1000;

export function generateResetToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createPasswordResetToken(userId: string): Promise<string> {
  const token = generateResetToken();
  const tokenHash = hashResetToken(token);
  const expiresAt = new Date(Date.now() + RESET_TTL_MS);

  await dbQuery(
    `update ${tokensTable} set used_at = now() where user_id = $1 and used_at is null`,
    [userId],
  );

  await dbQuery(
    `
    insert into ${tokensTable} (user_id, token_hash, expires_at)
    values ($1, $2, $3::timestamptz)
    `,
    [userId, tokenHash, expiresAt.toISOString()],
  );

  return token;
}

export async function consumePasswordResetToken(
  token: string,
): Promise<{ userId: string } | null> {
  const tokenHash = hashResetToken(token.trim());
  const { rows } = await dbQuery<{ user_id: string }>(
    `
    select user_id
    from ${tokensTable}
    where token_hash = $1
      and used_at is null
      and expires_at > now()
    limit 1
    `,
    [tokenHash],
  );
  const row = rows[0];
  if (!row) return null;

  await dbQuery(
    `update ${tokensTable} set used_at = now() where token_hash = $1`,
    [tokenHash],
  );

  return { userId: row.user_id };
}
