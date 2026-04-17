import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import db from '../../config/database.js';
import TaskModel from '../../models/TaskModel.js';
import UserModel from '../../models/UserModel.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../..');
const publicDir = path.join(rootDir, 'public');

const listUserFilesStatement = db.prepare(`
  SELECT file_path
  FROM attachments
  WHERE task_id IN (
    SELECT id
    FROM tasks
    WHERE user_id = ?
  )
`);

const destroySession = (session) =>
  new Promise((resolve, reject) => {
    session.destroy((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

const removePublicFile = async (relativePath) => {
  if (!relativePath) {
    return;
  }

  const normalizedPath = String(relativePath).replace(/^\/+/, '');
  const absolutePath = path.resolve(publicDir, normalizedPath);

  if (!absolutePath.startsWith(publicDir)) {
    return;
  }

  try {
    await unlink(absolutePath);
  } catch {
    // ignore missing files
  }
};

export default class DeleteAccountAction {
  async execute(userId, session) {
    const user = UserModel.findById(userId);
    const attachmentFiles = listUserFilesStatement.all(userId).map((row) => row.file_path);

    TaskModel.softDeleteAllByUserId(userId);

    await Promise.all([
      removePublicFile(user?.avatar),
      ...attachmentFiles.map((filePath) => removePublicFile(filePath)),
    ]);

    UserModel.delete(userId);
    await destroySession(session);

    return true;
  }
}
