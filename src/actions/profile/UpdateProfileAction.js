import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import UserModel from '../../models/UserModel.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../..');
const publicDir = path.join(rootDir, 'public');
const avatarUploadDir = path.join(publicDir, 'uploads', 'avatars');

const extensionByMimeType = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

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

export default class UpdateProfileAction {
  async execute(userId, data, file) {
    const existingUser = UserModel.findById(userId);

    if (!existingUser) {
      return null;
    }

    const updatePayload = {
      name: data.name,
      email: data.email,
    };

    if (file) {
      await mkdir(avatarUploadDir, { recursive: true });

      const extension = extensionByMimeType[file.mimetype] || path.extname(file.originalname || '') || '.bin';
      const fileName = `${randomUUID()}${extension}`;
      const relativePath = path.posix.join('/uploads/avatars', fileName);
      const absolutePath = path.join(avatarUploadDir, fileName);

      await writeFile(absolutePath, file.buffer);
      await removePublicFile(existingUser.avatar);
      updatePayload.avatar = relativePath;
    }

    return UserModel.update(userId, updatePayload);
  }
}
