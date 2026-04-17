import { createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import db from '../../config/database.js';

const clearExpiredPasswordResets = db.prepare(`
  DELETE FROM password_resets
  WHERE expires_at <= CURRENT_TIMESTAMP
`);

const findPasswordReset = db.prepare(`
  SELECT id, user_id
  FROM password_resets
  WHERE token_hash = ?
    AND expires_at > CURRENT_TIMESTAMP
  LIMIT 1
`);

const updateUserPassword = db.prepare(`
  UPDATE users
  SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
  WHERE id = ?
`);

const clearUserPasswordResets = db.prepare(`
  DELETE FROM password_resets
  WHERE user_id = ?
`);

const createTokenHash = (token) => createHash('sha256').update(token).digest('hex');

export default class ResetPasswordAction {
  async execute(token, password) {
    clearExpiredPasswordResets.run();

    const passwordReset = findPasswordReset.get(createTokenHash(token));

    if (!passwordReset) {
      return false;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    db.transaction(() => {
      updateUserPassword.run(passwordHash, passwordReset.user_id);
      clearUserPasswordResets.run(passwordReset.user_id);
    })();

    return true;
  }
}
