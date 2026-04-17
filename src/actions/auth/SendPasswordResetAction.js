import { createHash, randomBytes } from 'node:crypto';
import mailTransport from '../../config/mail.js';
import db from '../../config/database.js';

const findUserByEmail = db.prepare(`
  SELECT id, name, email
  FROM users
  WHERE email = ?
  LIMIT 1
`);

const clearExpiredPasswordResets = db.prepare(`
  DELETE FROM password_resets
  WHERE expires_at <= CURRENT_TIMESTAMP
`);

const clearUserPasswordResets = db.prepare(`
  DELETE FROM password_resets
  WHERE user_id = ?
`);

const insertPasswordReset = db.prepare(`
  INSERT INTO password_resets (user_id, token_hash, expires_at)
  VALUES (?, ?, datetime('now', '+1 hour'))
`);

const createTokenHash = (token) => createHash('sha256').update(token).digest('hex');

export default class SendPasswordResetAction {
  async execute(email) {
    clearExpiredPasswordResets.run();

    const user = findUserByEmail.get(email);

    if (!user) {
      return true;
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = createTokenHash(token);

    db.transaction(() => {
      clearUserPasswordResets.run(user.id);
      insertPasswordReset.run(user.id, tokenHash);
    })();

    const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
    const resetUrl = new URL('/auth/reset-password', appUrl);
    resetUrl.searchParams.set('token', token);

    await mailTransport.sendMail({
      from: process.env.MAIL_FROM_ADDRESS ?? 'noreply@todo.local',
      to: user.email,
      subject: 'Reset your Todo password',
      text: `Hello ${user.name}, reset your password using this link: ${resetUrl.toString()}`,
      html: `
        <p>Hello ${user.name},</p>
        <p>Reset your password using the link below:</p>
        <p><a href="${resetUrl.toString()}">${resetUrl.toString()}</a></p>
      `,
    });

    return true;
  }
}
