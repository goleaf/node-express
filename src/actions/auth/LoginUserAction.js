import bcrypt from 'bcryptjs';
import db from '../../config/database.js';

const findUserByEmail = db.prepare(`
  SELECT id, name, email, avatar, theme_preference, default_priority, default_view, onboarding_completed, created_at, updated_at, password_hash
  FROM users
  WHERE email = ?
  LIMIT 1
`);

const insertLoginAttempt = db.prepare(`
  INSERT INTO login_attempts (email, ip_address)
  VALUES (?, ?)
`);

const countRecentLoginAttempts = db.prepare(`
  SELECT COUNT(*) AS total
  FROM login_attempts
  WHERE email = ?
    AND attempted_at >= datetime('now', '-15 minutes')
`);

const clearLoginAttempts = db.prepare(`
  DELETE FROM login_attempts
  WHERE email = ?
`);

const toPublicUser = (user) => {
  const { password_hash, ...publicUser } = user;
  return publicUser;
};

const saveSession = (session) =>
  new Promise((resolve, reject) => {
    session.save((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

export default class LoginUserAction {
  async execute(email, password, session) {
    const user = findUserByEmail.get(email);
    const passwordMatches = user ? await bcrypt.compare(password, user.password_hash) : false;

    if (!user || !passwordMatches) {
      insertLoginAttempt.run(email, session.requestIp ?? 'unknown');

      const attempts = countRecentLoginAttempts.get(email)?.total ?? 0;

      if (attempts >= 10) {
        const error = new Error('Too many login attempts. Please wait 15 minutes and try again.');
        error.statusCode = 429;
        throw error;
      }

      return null;
    }

    clearLoginAttempts.run(email);

    const publicUser = toPublicUser(user);
    session.userId = publicUser.id;
    session.user = publicUser;
    delete session.requestIp;

    await saveSession(session);

    return publicUser;
  }
}
