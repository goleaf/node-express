import bcrypt from 'bcryptjs';
import TrackEventAction from '../TrackEventAction.js';
import db from '../../config/database.js';

const insertUser = db.prepare(`
  INSERT INTO users (name, email, password_hash)
  VALUES (?, ?, ?)
`);

const findUserById = db.prepare(`
  SELECT id, name, email, avatar, theme_preference, default_priority, default_view, onboarding_completed, created_at, updated_at
  FROM users
  WHERE id = ?
  LIMIT 1
`);

const trackEventAction = new TrackEventAction();

export default class RegisterUserAction {
  async execute(name, email, password) {
    const passwordHash = await bcrypt.hash(password, 12);
    const result = insertUser.run(name, email, passwordHash);
    const userId = Number(result.lastInsertRowid);
    const user = findUserById.get(userId);

    await trackEventAction.execute(userId, 'user_registered');

    return user;
  }
}
