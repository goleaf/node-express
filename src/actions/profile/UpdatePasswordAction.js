import bcrypt from 'bcryptjs';
import UserModel from '../../models/UserModel.js';

const regenerateSession = (session) =>
  new Promise((resolve, reject) => {
    session.regenerate((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

export default class UpdatePasswordAction {
  async execute(userId, newPassword, session) {
    const passwordHash = await bcrypt.hash(newPassword, 12);
    const updatedUser = UserModel.update(userId, {
      password_hash: passwordHash,
    });

    if (session) {
      await regenerateSession(session);
      const { password_hash, ...publicUser } = updatedUser;
      session.userId = publicUser.id;
      session.user = publicUser;
    }

    return true;
  }
}
